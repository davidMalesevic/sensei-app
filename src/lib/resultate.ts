import "server-only";

import { and, asc, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  klasse,
  modul,
  resultatAbgabe,
  resultatAufgabe,
  resultatImport,
  resultatPerson,
  sequenz,
  sequenzAblauf,
} from "@/db/schema";
import { parseResultateXlsx, ohneVorlage } from "@/lib/smartlearn-resultate";

/**
 * Auswertung der Smartlearn-Resultate.
 *
 * Wie im übrigen Projekt: **erst deterministisch, KI nur wo nötig.** Alles in
 * dieser Datei rechnet ohne KI — Vollständigkeit, automatische Korrektur der
 * Auswahlaufgaben, Ähnlichkeit zwischen Abgaben, das Klassenbild und die
 * Verknüpfung mit dem geplanten Unterrichtstag.
 *
 * Die Benutzer-ID ist überall Pflichtparameter, damit die Funktionen auch
 * ausserhalb einer Session (Hintergrundlauf) benutzbar bleiben und niemand
 * sie versehentlich ungefiltert aufruft.
 */

// ─── Import ───────────────────────────────────────────────────────────────

export type ImportErgebnis =
  | { ok: true; importId: string; lernende: number; aufgaben: number; abgaben: number }
  | { ok: false; fehler: string };

export async function importiereResultate(
  benutzerId: string,
  modulId: string,
  dateiname: string,
  bytes: Uint8Array
): Promise<ImportErgebnis> {
  const eigenesModul = await db.query.modul.findFirst({
    where: and(eq(modul.id, modulId), eq(modul.benutzerId, benutzerId)),
    columns: { id: true, nummer: true },
  });
  if (!eigenesModul) return { ok: false, fehler: "Modul nicht gefunden." };

  let daten;
  try {
    daten = parseResultateXlsx(bytes);
  } catch (e) {
    return { ok: false, fehler: `Datei konnte nicht gelesen werden: ${e}` };
  }

  if (daten.spalten.length === 0) {
    return { ok: false, fehler: "Keine Abgabe-Spalten im Export gefunden." };
  }
  if (daten.modulNummer !== null && daten.modulNummer !== eigenesModul.nummer) {
    return {
      ok: false,
      fehler: `Der Export gehört zu Modul ${daten.modulNummer}, nicht zu Modul ${eigenesModul.nummer}.`,
    };
  }

  // Klasse über das Kürzel aus der Durchführung, wenn es sie gibt.
  let klasseId: string | null = null;
  if (daten.klassenKuerzel) {
    const k = await db.query.klasse.findFirst({
      where: and(
        eq(klasse.benutzerId, benutzerId),
        eq(klasse.bezeichnung, daten.klassenKuerzel)
      ),
      columns: { id: true },
    });
    klasseId = k?.id ?? null;
  }

  const [imp] = await db
    .insert(resultatImport)
    .values({
      benutzerId,
      modulId,
      klasseId,
      durchfuehrung: daten.durchfuehrung,
      klassenKuerzel: daten.klassenKuerzel,
      exportDatum: daten.exportDatum,
      dateiname,
    })
    .returning({ id: resultatImport.id });

  const aufgaben = await db
    .insert(resultatAufgabe)
    .values(
      daten.spalten.map((s) => ({
        importId: imp.id,
        spalte: s.spalte,
        laCode: s.laCode,
        aufgabeNr: s.aufgabeNr,
        art: s.art,
        frage: s.frage,
        musterloesung: s.musterloesung,
      }))
    )
    .returning({ id: resultatAufgabe.id, spalte: resultatAufgabe.spalte });

  const aufgabeVon = new Map(aufgaben.map((a) => [a.spalte, a.id]));
  const vorlageVon = new Map(daten.spalten.map((s) => [s.spalte, s.musterloesung]));

  let abgabenZahl = 0;
  for (const p of daten.personen) {
    const [person] = await db
      .insert(resultatPerson)
      .values({
        importId: imp.id,
        nachname: p.nachname,
        vorname: p.vorname,
        email: p.email,
        istLehrperson: p.istLehrperson,
      })
      .returning({ id: resultatPerson.id });

    const zeilen = Object.entries(p.abgaben)
      .map(([spalte, text]) => {
        const aufgabeId = aufgabeVon.get(spalte);
        if (!aufgabeId) return null;
        return {
          personId: person.id,
          aufgabeId,
          text,
          textBereinigt: ohneVorlage(text, vorlageVon.get(spalte) ?? null),
        };
      })
      .filter((z): z is NonNullable<typeof z> => z !== null);

    if (zeilen.length > 0) {
      await db.insert(resultatAbgabe).values(zeilen);
      abgabenZahl += zeilen.length;
    }
  }

  return {
    ok: true,
    importId: imp.id,
    lernende: daten.personen.filter((p) => !p.istLehrperson).length,
    aufgaben: daten.spalten.length,
    abgaben: abgabenZahl,
  };
}

// ─── Gemeinsame Ladefunktion ──────────────────────────────────────────────

async function ladeImport(benutzerId: string, importId: string) {
  const imp = await db.query.resultatImport.findFirst({
    where: and(
      eq(resultatImport.id, importId),
      eq(resultatImport.benutzerId, benutzerId)
    ),
  });
  if (!imp) return null;

  const [personen, aufgaben] = await Promise.all([
    db.select().from(resultatPerson).where(eq(resultatPerson.importId, importId)),
    db
      .select()
      .from(resultatAufgabe)
      .where(eq(resultatAufgabe.importId, importId))
      .orderBy(asc(resultatAufgabe.laCode), asc(resultatAufgabe.spalte)),
  ]);

  const abgaben =
    aufgaben.length > 0
      ? await db
          .select()
          .from(resultatAbgabe)
          .where(
            inArray(
              resultatAbgabe.aufgabeId,
              aufgaben.map((a) => a.id)
            )
          )
      : [];

  return { imp, personen, aufgaben, abgaben };
}

// ─── Vollständigkeit ──────────────────────────────────────────────────────

export type Vollstaendigkeit = {
  personId: string;
  name: string;
  email: string;
  geloest: number;
  gesamt: number;
  /** Pro LA-Code: gelöst von wie vielen. */
  proLa: { laCode: string; geloest: number; gesamt: number }[];
};

export async function getVollstaendigkeit(
  benutzerId: string,
  importId: string
): Promise<Vollstaendigkeit[]> {
  const geladen = await ladeImport(benutzerId, importId);
  if (!geladen) return [];
  const { personen, aufgaben, abgaben } = geladen;

  const laVon = new Map(aufgaben.map((a) => [a.id, a.laCode ?? "ohne LA"]));
  const proPerson = new Map<string, Set<string>>();
  for (const ab of abgaben) {
    if (!ab.textBereinigt.trim()) continue;
    if (!proPerson.has(ab.personId)) proPerson.set(ab.personId, new Set());
    proPerson.get(ab.personId)!.add(ab.aufgabeId);
  }

  const laGesamt = new Map<string, number>();
  for (const a of aufgaben) {
    const la = a.laCode ?? "ohne LA";
    laGesamt.set(la, (laGesamt.get(la) ?? 0) + 1);
  }

  // Lehrpersonen tragen die Musterlösung und gehören nicht in die Statistik.
  return personen
    .filter((p) => !p.istLehrperson)
    .map((p) => {
      const meine = proPerson.get(p.id) ?? new Set<string>();
      const proLaZahl = new Map<string, number>();
      for (const id of meine) {
        const la = laVon.get(id) ?? "ohne LA";
        proLaZahl.set(la, (proLaZahl.get(la) ?? 0) + 1);
      }
      return {
        personId: p.id,
        name: `${p.vorname} ${p.nachname}`.trim(),
        email: p.email,
        geloest: meine.size,
        gesamt: aufgaben.length,
        proLa: [...laGesamt.entries()]
          .map(([laCode, gesamt]) => ({
            laCode,
            geloest: proLaZahl.get(laCode) ?? 0,
            gesamt,
          }))
          .sort((a, b) => a.laCode.localeCompare(b.laCode)),
      };
    })
    .sort((a, b) => a.geloest - b.geloest);
}

// ─── Klassenbild ──────────────────────────────────────────────────────────

export type AufgabeBild = {
  aufgabeId: string;
  laCode: string | null;
  aufgabeNr: string | null;
  art: string;
  frage: string;
  geloestVon: number;
  lernende: number;
  /** Nur bei Auswahlaufgaben mit Musterlösung: wie viele richtig. */
  richtig: number | null;
};

/** Auswahlaufgaben lassen sich gegen die Musterlösung stur vergleichen. */
function istAuswahl(art: string) {
  return art === "multipleChoice" || art === "matrixChoice";
}

function normalisiereAntwort(s: string) {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

export async function getKlassenbild(
  benutzerId: string,
  importId: string
): Promise<AufgabeBild[]> {
  const geladen = await ladeImport(benutzerId, importId);
  if (!geladen) return [];
  const { personen, aufgaben, abgaben } = geladen;

  const lernendeIds = new Set(
    personen.filter((p) => !p.istLehrperson).map((p) => p.id)
  );

  const proAufgabe = new Map<string, typeof abgaben>();
  for (const ab of abgaben) {
    if (!lernendeIds.has(ab.personId)) continue;
    if (!proAufgabe.has(ab.aufgabeId)) proAufgabe.set(ab.aufgabeId, []);
    proAufgabe.get(ab.aufgabeId)!.push(ab);
  }

  return aufgaben.map((a) => {
    const meine = (proAufgabe.get(a.id) ?? []).filter((x) => x.textBereinigt.trim());
    let richtig: number | null = null;

    if (istAuswahl(a.art) && a.musterloesung) {
      const soll = normalisiereAntwort(a.musterloesung);
      richtig = meine.filter((x) => normalisiereAntwort(x.text) === soll).length;
    }

    return {
      aufgabeId: a.id,
      laCode: a.laCode,
      aufgabeNr: a.aufgabeNr,
      art: a.art,
      frage: a.frage ?? "",
      geloestVon: meine.length,
      lernende: lernendeIds.size,
      richtig,
    };
  });
}

// ─── Ähnlichkeit zwischen Abgaben ─────────────────────────────────────────

/** Wortdreiergruppen — robuster gegen Umstellungen als reiner Zeichenvergleich. */
function trigramme(s: string): Set<string> {
  const w = normalisiereAntwort(s)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

export function aehnlichkeit(a: string, b: string): number {
  const A = trigramme(a);
  const B = trigramme(b);
  if (A.size === 0 || B.size === 0) return 0;
  let schnitt = 0;
  for (const t of A) if (B.has(t)) schnitt++;
  return schnitt / (A.size + B.size - schnitt);
}

export type Textgruppe = {
  aufgabeId: string;
  laCode: string | null;
  aufgabeNr: string | null;
  frage: string;
  /** Der geteilte Text, gekürzt. */
  text: string;
  namen: string[];
  /** Anteil der Klasse, der diesen Text trägt. */
  anteil: number;
};

export type Duplikate = {
  /** Kleine Gruppen — die sind es, die man anschauen will. */
  auffaellig: Textgruppe[];
  /**
   * Gruppen, die einen grossen Teil der Klasse umfassen. Das ist mit hoher
   * Wahrscheinlichkeit vorgegebener Text — eine Definition im Auftrag, eine
   * Tabellenvorlage — und **kein Abschreiben**.
   */
  vorgegeben: Textgruppe[];
};

/**
 * Auffällig ähnliche Abgaben.
 *
 * Bewusst **Gruppen statt Paare**. Am echten Export lieferte der paarweise
 * Vergleich 138 Treffer, von denen fast alle daher rührten, dass ein Text bei
 * 12 oder 13 von 12 Lernenden identisch war — also vorgegeben. Als Paare
 * gezählt ergibt das 66 Meldungen für einen einzigen Sachverhalt.
 *
 * Deshalb: gleiche Texte werden zu Gruppen zusammengelegt, und Gruppen, die
 * mehr als `vorgabeAnteil` der Klasse umfassen, gelten als vorgegeben. Übrig
 * bleiben die kleinen Gruppen — im Beispielexport zwei statt 138.
 *
 * Verglichen wird der **bereinigte** Text; Lehrpersonen bleiben draussen,
 * ihre Zellen *sind* die Musterlösung.
 *
 * Das Ergebnis ist Material zum Anschauen, kein Urteil.
 */
export async function findeDuplikate(
  benutzerId: string,
  importId: string,
  schwelle = 0.75,
  vorgabeAnteil = 0.4
): Promise<Duplikate> {
  const geladen = await ladeImport(benutzerId, importId);
  if (!geladen) return { auffaellig: [], vorgegeben: [] };
  const { personen, aufgaben, abgaben } = geladen;

  const nameVon = new Map(
    personen.map((p) => [p.id, `${p.vorname} ${p.nachname}`.trim()])
  );
  const lernende = personen.filter((p) => !p.istLehrperson);
  const lernendeIds = new Set(lernende.map((p) => p.id));
  const aufgabeVon = new Map(aufgaben.map((a) => [a.id, a]));

  const proAufgabe = new Map<string, typeof abgaben>();
  for (const ab of abgaben) {
    if (!lernendeIds.has(ab.personId)) continue;
    const a = aufgabeVon.get(ab.aufgabeId);
    // Auswahlaufgaben sind naturgemäss identisch — nur Freitext vergleichen.
    if (!a || istAuswahl(a.art) || a.art === "fileUpload") continue;
    if (ab.textBereinigt.trim().length < 60) continue; // zu kurz für eine Aussage
    if (!proAufgabe.has(ab.aufgabeId)) proAufgabe.set(ab.aufgabeId, []);
    proAufgabe.get(ab.aufgabeId)!.push(ab);
  }

  const auffaellig: Textgruppe[] = [];
  const vorgegeben: Textgruppe[] = [];

  for (const [aufgabeId, liste] of proAufgabe) {
    const a = aufgabeVon.get(aufgabeId)!;

    // Gruppen bilden: wer zu einer bestehenden Gruppe ähnlich genug ist,
    // kommt dazu; sonst beginnt eine neue.
    const gruppen: { text: string; ids: string[] }[] = [];
    for (const ab of liste) {
      const treffer = gruppen.find(
        (g) => aehnlichkeit(g.text, ab.textBereinigt) >= schwelle
      );
      if (treffer) treffer.ids.push(ab.personId);
      else gruppen.push({ text: ab.textBereinigt, ids: [ab.personId] });
    }

    for (const g of gruppen) {
      if (g.ids.length < 2) continue;
      const anteil = g.ids.length / Math.max(1, lernende.length);
      const eintrag: Textgruppe = {
        aufgabeId,
        laCode: a.laCode,
        aufgabeNr: a.aufgabeNr,
        frage: a.frage ?? "",
        text: g.text,
        namen: g.ids.map((id) => nameVon.get(id) ?? "?").sort(),
        anteil,
      };
      if (anteil > vorgabeAnteil) vorgegeben.push(eintrag);
      else auffaellig.push(eintrag);
    }
  }

  const nachGroesse = (x: Textgruppe, y: Textgruppe) =>
    y.namen.length - x.namen.length;
  return {
    auffaellig: auffaellig.sort(nachGroesse),
    vorgegeben: vorgegeben.sort(nachGroesse),
  };
}

// ─── Verknüpfung mit dem Unterrichtstag ───────────────────────────────────

/**
 * Der Ablauf nennt die Aufgabe als Text (`Aufgabe 2 – Fehlersuche`), der
 * Export als blosse Zahl (`2`). Für den Vergleich zählt die erste Zahl.
 */
export function normalisiereAufgabenNr(s: string | null): string | null {
  if (!s) return null;
  const m = /(\d+(?:\.\d+)?)/.exec(s);
  return m ? m[1] : null;
}

export type GeplantAm = {
  aufgabeId: string;
  laCode: string | null;
  aufgabeNr: string | null;
  /** Unterrichtstage, an denen diese Aufgabe im Ablauf stand. */
  tage: { datum: string | null; klasse: string; sequenzId: string }[];
};

/**
 * Wann stand diese Aufgabe in der Planung?
 *
 * Nur lesend über `sequenz_ablauf.refCode` und `refAufgabe` — der Ablauf wird
 * nicht angefasst. Ob die Aufgabe *an* diesem Tag gelöst wurde, sagt erst der
 * Vergleich zweier Importe; ein einzelner Export trägt keine Zeitstempel.
 */
export async function getGeplantAm(
  benutzerId: string,
  importId: string
): Promise<GeplantAm[]> {
  const geladen = await ladeImport(benutzerId, importId);
  if (!geladen) return [];
  const { imp, aufgaben } = geladen;

  const schritte = await db
    .select({
      refCode: sequenzAblauf.refCode,
      refAufgabe: sequenzAblauf.refAufgabe,
      datum: sequenz.startDatum,
      sequenzId: sequenz.id,
      klasse: klasse.bezeichnung,
    })
    .from(sequenzAblauf)
    .innerJoin(sequenz, eq(sequenzAblauf.sequenzId, sequenz.id))
    .innerJoin(klasse, eq(sequenz.klasseId, klasse.id))
    .where(
      and(
        eq(sequenz.benutzerId, benutzerId),
        eq(sequenz.modulId, imp.modulId),
        ...(imp.klasseId ? [eq(sequenz.klasseId, imp.klasseId)] : [])
      )
    )
    .orderBy(asc(sequenz.startDatum));

  return aufgaben.map((a) => {
    const nr = normalisiereAufgabenNr(a.aufgabeNr);
    const tage = schritte
      .filter(
        (s) =>
          s.refCode === a.laCode &&
          (nr === null || normalisiereAufgabenNr(s.refAufgabe) === nr)
      )
      .map((s) => ({ datum: s.datum, klasse: s.klasse, sequenzId: s.sequenzId }));

    return { aufgabeId: a.id, laCode: a.laCode, aufgabeNr: a.aufgabeNr, tage };
  });
}

// ─── Verlauf über mehrere Importe ─────────────────────────────────────────

export type Verlauf = {
  importId: string;
  exportDatum: string | null;
  createdAt: Date;
  geloest: number;
  gesamt: number;
  /** Gegenüber dem vorherigen Import dazugekommen. */
  neu: number | null;
};

/**
 * Was zwischen zwei Importen dazugekommen ist.
 *
 * Der Export trägt keine Zeitstempel pro Antwort — die Differenz zweier
 * Momentaufnahmen ist die einzige ehrliche Auskunft darüber, *wann* etwas
 * gelöst wurde. Genau auf das Intervall zwischen den Importen.
 */
export async function getVerlauf(
  benutzerId: string,
  modulId: string
): Promise<Verlauf[]> {
  const importe = await db
    .select()
    .from(resultatImport)
    .where(
      and(
        eq(resultatImport.benutzerId, benutzerId),
        eq(resultatImport.modulId, modulId)
      )
    )
    .orderBy(asc(resultatImport.createdAt));

  const out: Verlauf[] = [];
  let vorher: number | null = null;

  for (const imp of importe) {
    const daten = await ladeImport(benutzerId, imp.id);
    if (!daten) continue;
    const lernendeIds = new Set(
      daten.personen.filter((p) => !p.istLehrperson).map((p) => p.id)
    );
    const geloest = daten.abgaben.filter(
      (a) => lernendeIds.has(a.personId) && a.textBereinigt.trim()
    ).length;
    const gesamt = daten.aufgaben.length * lernendeIds.size;

    out.push({
      importId: imp.id,
      exportDatum: imp.exportDatum,
      createdAt: imp.createdAt,
      geloest,
      gesamt,
      neu: vorher === null ? null : geloest - vorher,
    });
    vorher = geloest;
  }

  return out;
}

/** Die Importe eines Moduls, neueste zuerst. */
export async function getImporte(benutzerId: string, modulId?: string) {
  return db
    .select({
      id: resultatImport.id,
      durchfuehrung: resultatImport.durchfuehrung,
      klassenKuerzel: resultatImport.klassenKuerzel,
      exportDatum: resultatImport.exportDatum,
      dateiname: resultatImport.dateiname,
      createdAt: resultatImport.createdAt,
      modulId: resultatImport.modulId,
      modulNummer: modul.nummer,
    })
    .from(resultatImport)
    .innerJoin(modul, eq(resultatImport.modulId, modul.id))
    .where(
      and(
        eq(resultatImport.benutzerId, benutzerId),
        ...(modulId ? [eq(resultatImport.modulId, modulId)] : [])
      )
    )
    .orderBy(desc(resultatImport.createdAt));
}
