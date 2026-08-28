"use server";

import { db } from "@/db";
import { sequenz, klasse, klasseAlias, modul } from "@/db/schema";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseIcs, fasseZusammen, type IcsTermin } from "@/lib/ics";
import { benutzerId } from "@/lib/dal";
import { lehrjahrFuerModul } from "@/lib/modul-lehrjahr";

export type KlassenZuordnung = {
  kuerzel: string;
  anzahl: number;
  /** Bereits gespeicherter Alias oder Namensvorschlag; null = braucht Entscheid */
  vorschlagKlasseId: string | null;
  /** true, wenn die Zuordnung aus einem früheren Import stammt */
  bekannt: boolean;
};

export type ModulStatus = {
  nummer: number;
  bezeichnung: string | null;
  anzahl: number;
  vorhanden: boolean;
};

export type AnalyseErgebnis =
  | { ok: false; fehler: string }
  | {
      ok: true;
      anzahlTermine: number;
      vonDatum: string | null;
      bisDatum: string | null;
      ohneModul: number;
      klassen: KlassenZuordnung[];
      module: ModulStatus[];
      klassenListe: { id: string; bezeichnung: string }[];
    };

export type ImportErgebnis =
  | { ok: false; fehler: string }
  | {
      ok: true;
      neu: number;
      aktualisiert: number;
      unveraendert: number;
      uebersprungen: number;
      verwaist: number;
    };

/** "EDB24a" und "EDB24A" sollen als dasselbe erkannt werden. */
function normalisiere(text: string): string {
  return text.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Liest den Export und bereitet den Zuordnungsschritt vor: welche Kürzel sind
 * bekannt, welche Module fehlen, wie viele Sequenzen entstehen.
 */
export async function analysiereStundenplan(
  inhalt: string
): Promise<AnalyseErgebnis> {
  const bId = await benutzerId();

  let termine: IcsTermin[];
  try {
    termine = parseIcs(inhalt);
  } catch {
    return { ok: false, fehler: "Die Datei konnte nicht gelesen werden." };
  }

  if (termine.length === 0) {
    return {
      ok: false,
      fehler:
        "Keine Termine gefunden. Ist das ein WebUntis-Kalenderexport (.ics)?",
    };
  }

  const uebersicht = fasseZusammen(termine);

  const [klassenListe, aliasse, vorhandeneModule] = await Promise.all([
    db
      .select({ id: klasse.id, bezeichnung: klasse.bezeichnung })
      .from(klasse)
      .where(eq(klasse.benutzerId, bId)),
    db.select().from(klasseAlias).where(eq(klasseAlias.benutzerId, bId)),
    db.select({ nummer: modul.nummer }).from(modul).where(eq(modul.benutzerId, bId)),
  ]);

  const aliasMap = new Map(aliasse.map((a) => [a.kuerzel, a.klasseId]));
  const nachName = new Map(
    klassenListe.map((k) => [normalisiere(k.bezeichnung), k.id])
  );
  const modulNummern = new Set(vorhandeneModule.map((m) => m.nummer));

  const klassen: KlassenZuordnung[] = uebersicht.klassenKuerzel.map((k) => {
    const gespeichert = aliasMap.get(k.kuerzel) ?? null;
    return {
      kuerzel: k.kuerzel,
      anzahl: k.anzahl,
      vorschlagKlasseId: gespeichert ?? nachName.get(normalisiere(k.kuerzel)) ?? null,
      bekannt: gespeichert !== null,
    };
  });

  return {
    ok: true,
    anzahlTermine: termine.length,
    vonDatum: uebersicht.vonDatum,
    bisDatum: uebersicht.bisDatum,
    ohneModul: uebersicht.ohneModul,
    klassen,
    module: uebersicht.module.map((m) => ({
      ...m,
      vorhanden: modulNummern.has(m.nummer),
    })),
    klassenListe: klassenListe.sort((a, b) =>
      a.bezeichnung.localeCompare(b.bezeichnung)
    ),
  };
}

/**
 * Legt aus dem Export die Sequenzen an. Idempotent über (kalenderKurs, datum):
 * ein erneuter Import derselben Datei ändert nichts, ein aktualisierter Export
 * korrigiert Zeiten und Räume.
 *
 * Termine ohne zugeordnete Klasse werden übersprungen, nicht geraten.
 */
export async function importiereStundenplan(
  inhalt: string,
  zuordnungen: { kuerzel: string; klasseId: string }[]
): Promise<ImportErgebnis> {
  const bId = await benutzerId();

  let termine: IcsTermin[];
  try {
    termine = parseIcs(inhalt);
  } catch {
    return { ok: false, fehler: "Die Datei konnte nicht gelesen werden." };
  }
  if (termine.length === 0) {
    return { ok: false, fehler: "Keine Termine im Export gefunden." };
  }

  // 1) Zuordnungen festhalten, damit der nächste Import sie kennt.
  for (const z of zuordnungen) {
    if (!z.klasseId) continue;
    await db
      .insert(klasseAlias)
      .values({ benutzerId: bId, kuerzel: z.kuerzel, klasseId: z.klasseId })
      .onConflictDoUpdate({
        // Eindeutig ist das Kürzel nur innerhalb eines Kontos.
        target: [klasseAlias.benutzerId, klasseAlias.kuerzel],
        set: { klasseId: z.klasseId },
      });
  }

  const aliasse = await db
    .select()
    .from(klasseAlias)
    .where(eq(klasseAlias.benutzerId, bId));
  const klasseVon = new Map(aliasse.map((a) => [a.kuerzel, a.klasseId]));

  // 2) Module sicherstellen und fehlende Bezeichnungen aus dem Kalender füllen.
  const modulInfos = new Map<number, string | null>();
  for (const t of termine) {
    if (t.modulNummer === null) continue;
    if (!modulInfos.has(t.modulNummer) || !modulInfos.get(t.modulNummer)) {
      modulInfos.set(t.modulNummer, t.modulBezeichnung);
    }
  }

  const vorhandene = await db
    .select()
    .from(modul)
    .where(eq(modul.benutzerId, bId));
  const modulIdVon = new Map(vorhandene.map((m) => [m.nummer, m.id]));

  for (const [nummer, bezeichnung] of modulInfos) {
    const vorhanden = vorhandene.find((m) => m.nummer === nummer);
    if (!vorhanden) {
      const [neu] = await db
        .insert(modul)
        .values({
          benutzerId: bId,
          nummer,
          bezeichnung,
          // Der Kalender kennt nur die Nummer; das Lehrjahr kommt aus dem
          // Modulbaukasten, damit die Gruppierung im Bildungsplan stimmt.
          lehrjahr: lehrjahrFuerModul(nummer),
        })
        .returning({ id: modul.id });
      modulIdVon.set(nummer, neu.id);
    } else if (!vorhanden.bezeichnung && bezeichnung) {
      await db
        .update(modul)
        .set({ bezeichnung })
        .where(and(eq(modul.id, vorhanden.id), eq(modul.benutzerId, bId)));
    }
  }

  // 3) Bestehende Kalender-Sequenzen laden (Idempotenz-Schlüssel).
  const kurse = [...new Set(termine.map((t) => t.kursSchluessel))];
  const bestehende = await db
    .select()
    .from(sequenz)
    .where(
      and(eq(sequenz.benutzerId, bId), inArray(sequenz.kalenderKurs, kurse))
    );

  const schluessel = (kurs: string, datum: string) => `${kurs}|${datum}`;
  const bestandVon = new Map(
    bestehende
      .filter((s) => s.kalenderKurs && s.startDatum)
      .map((s) => [schluessel(s.kalenderKurs!, s.startDatum!), s])
  );

  const anzulegen: (typeof sequenz.$inferInsert)[] = [];
  let aktualisiert = 0;
  let unveraendert = 0;
  let uebersprungen = 0;
  const gesehen = new Set<string>();

  for (const t of termine) {
    const klasseId = klasseVon.get(t.klassenKuerzel);
    if (!klasseId) {
      uebersprungen++;
      continue;
    }

    const modulId = t.modulNummer !== null ? modulIdVon.get(t.modulNummer) ?? null : null;
    const titel =
      t.modulNummer !== null
        ? `Modul ${t.modulNummer}${t.modulBezeichnung ? ` – ${t.modulBezeichnung}` : ""}`
        : t.klassenKuerzel;

    const key = schluessel(t.kursSchluessel, t.datum);
    gesehen.add(key);
    const vorhanden = bestandVon.get(key);

    if (!vorhanden) {
      anzulegen.push({
        benutzerId: bId,
        titel,
        klasseId,
        modulId,
        startDatum: t.datum,
        endDatum: t.datum,
        kalenderKurs: t.kursSchluessel,
        startZeit: t.startZeit,
        endZeit: t.endZeit,
        lektionen: t.lektionen,
        raum: t.raum,
      });
      continue;
    }

    const geaendert =
      vorhanden.startZeit !== t.startZeit ||
      vorhanden.endZeit !== t.endZeit ||
      vorhanden.lektionen !== t.lektionen ||
      vorhanden.raum !== t.raum ||
      vorhanden.klasseId !== klasseId ||
      vorhanden.modulId !== modulId;

    if (!geaendert) {
      unveraendert++;
      continue;
    }

    await db
      .update(sequenz)
      .set({
        klasseId,
        modulId,
        startZeit: t.startZeit,
        endZeit: t.endZeit,
        lektionen: t.lektionen,
        raum: t.raum,
        updatedAt: new Date(),
      })
      .where(and(eq(sequenz.id, vorhanden.id), eq(sequenz.benutzerId, bId)));
    aktualisiert++;
  }

  if (anzulegen.length > 0) {
    await db.insert(sequenz).values(anzulegen);
  }

  // 4) Sequenzen melden, die im Export nicht mehr vorkommen — aber nicht
  //    löschen: dort könnte bereits Planung drinstecken.
  const verwaist = bestehende.filter(
    (s) =>
      s.kalenderKurs &&
      s.startDatum &&
      !gesehen.has(schluessel(s.kalenderKurs, s.startDatum))
  ).length;

  revalidatePath("/stundenplan");
  revalidatePath("/sequenzen");

  return {
    ok: true,
    neu: anzulegen.length,
    aktualisiert,
    unveraendert,
    uebersprungen,
    verwaist,
  };
}

/** Übersicht der importierten Sequenzen für die Stundenplan-Seite. */
export async function getStundenplanUebersicht() {
  const bId = await benutzerId();

  const eintraege = await db.query.sequenz.findMany({
    where: and(eq(sequenz.benutzerId, bId), isNotNull(sequenz.kalenderKurs)),
    orderBy: (s, { asc }) => [asc(s.startDatum), asc(s.startZeit)],
    with: { klasse: true, modul: true },
  });

  const aliasse = await db
    .select({
      kuerzel: klasseAlias.kuerzel,
      bezeichnung: klasse.bezeichnung,
    })
    .from(klasseAlias)
    .innerJoin(klasse, eq(klasseAlias.klasseId, klasse.id))
    .where(eq(klasseAlias.benutzerId, bId))
    .orderBy(klasseAlias.kuerzel);

  return { eintraege, aliasse };
}

/** Eine gespeicherte Kürzel-Zuordnung wieder entfernen. */
export async function loescheAlias(kuerzel: string) {
  const bId = await benutzerId();
  await db
    .delete(klasseAlias)
    .where(
      and(eq(klasseAlias.kuerzel, kuerzel), eq(klasseAlias.benutzerId, bId))
    );
  revalidatePath("/stundenplan");
}
