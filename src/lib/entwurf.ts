import "server-only";

/**
 * Der Entwurfsgenerator als gewöhnliches Servermodul, NICHT als
 * `"use server"`-Datei.
 *
 * Jede Funktion nimmt die Benutzer-ID als ersten Parameter. Läge das in einer
 * Server-Action-Datei, könnte jeder angemeldete Browser sie mit einer fremden
 * ID aufrufen. Die Actions in `src/app/sequenzen/entwurf-actions.ts` holen die
 * ID aus der Session; der Nachtlauf reicht sie pro Benutzer herein.
 */

import { db } from "@/db";
import { sequenz, sequenzAblauf, klasse } from "@/db/schema";
import { and, asc, count, desc, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { getWochenstoff, type Wochenstoff } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";
import { holeVorherigenUebertrag } from "@/lib/uebertrag";

/**
 * Entwurfsgenerator (`erstellungsprozess.md`, Abschnitt 5).
 *
 * Die Arbeitsteilung ist die ganze Idee:
 *
 * - **Fakten** — Aufgabennummern, LA-Codes, Slidebereiche — stammen aus dem
 *   Material. Sie werden hier serverseitig gesetzt; die KI bekommt sie nur als
 *   nummerierte Liste und darf sie ausschliesslich *referenzieren*. Damit kann
 *   sie eine Aufgabennummer nicht erfinden und keine umformulieren.
 * - **Vorschläge** — Vorwissensaktivierung, Praxisbezug, Dramaturgie — kommen
 *   von der KI und sind als solche markiert.
 *
 * Phasenmodelle (AVIVA/PADUA) steuern den Vorschlag über den Prompt, erscheinen
 * aber nie als Tabelle in der Oberfläche.
 */

/** Gehört die Sequenz diesem Konto? */
async function eigeneSequenz(bId: string, sequenzId: string) {
  return db.query.sequenz.findFirst({
    where: and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)),
    columns: { id: true },
  });
}

/**
 * `sequenz_ablauf` trägt keinen eigenen Besitzer — die Zeile gehört dem, dem
 * ihre Sequenz gehört. Ohne diesen Join käme man mit einer geratenen UUID an
 * fremde Ablaufschritte.
 */
async function eigeneAblaufZeile(bId: string, zeilenId: string) {
  const [z] = await db
    .select({ id: sequenzAblauf.id, sequenzId: sequenzAblauf.sequenzId })
    .from(sequenzAblauf)
    .innerJoin(sequenz, eq(sequenzAblauf.sequenzId, sequenz.id))
    .where(and(eq(sequenzAblauf.id, zeilenId), eq(sequenz.benutzerId, bId)))
    .limit(1);
  return z ?? null;
}

type Fakt = {
  id: string;
  typ: "theorie" | "aufgabe";
  titel: string;
  text: string | null;
  refCode: string | null;
  refAufgabe: string | null;
  refSeiteVon: number | null;
  refSeiteBis: number | null;
};

type KiSchritt = {
  typ?: string;
  faktId?: string;
  titel?: string;
  text?: string;
};

const ERLAUBTE_TYPEN = [
  "einstieg",
  "praxisbezug",
  "theorie",
  "aufgabe",
  "besprechung",
  "abschluss",
  "frei",
] as const;

type AblaufTyp = (typeof ERLAUBTE_TYPEN)[number];

/** Sammelt, was in dieser Woche belegbar ansteht. */
function sammleFakten(stoff: Wochenstoff, erledigt: string[]): Fakt[] {
  const fakten: Fakt[] = [];

  for (const b of stoff.bloecke) {
    if (b.slides) {
      fakten.push({
        id: `theorie-${b.schluessel}`,
        typ: "theorie",
        titel: b.slides.von
          ? `${b.slides.titel}, Slide ${b.slides.von}${b.slides.bis ? `–${b.slides.bis}` : ""}`
          : b.slides.titel,
        text: null,
        refCode: null,
        refAufgabe: null,
        refSeiteVon: b.slides.von,
        refSeiteBis: b.slides.bis,
      });
    }

    for (const a of b.auftraege) {
      // Manche Module nummerieren ihre Aufgaben gar nicht (dort heissen sie
      // schlicht «Neue Aufgabe»). Dann ist der Lern- und Arbeitsauftrag selbst
      // die Einheit, die die Lehrperson der Klasse nennt.
      if (a.aufgaben.length === 0) {
        fakten.push({
          id: `aufgabe-${fakten.length}`,
          typ: "aufgabe",
          titel: a.code,
          text: a.aufgabenstellung?.slice(0, 400) ?? null,
          refCode: a.code,
          refAufgabe: null,
          refSeiteVon: null,
          refSeiteBis: null,
        });
        continue;
      }

      for (const auf of a.aufgaben) {
        const marke = `${a.code} · ${auf.bezeichnung}`;
        if (erledigt.includes(marke)) continue; // letzte Woche erledigt

        const teil =
          auf.teilaufgaben.length > 0
            ? ` (${auf.teilaufgaben.map((t) => t.bezeichnung).join(", ")})`
            : "";

        fakten.push({
          id: `aufgabe-${fakten.length}`,
          typ: "aufgabe",
          titel: `${auf.bezeichnung}${teil}`,
          text: auf.text?.slice(0, 400) ?? null,
          refCode: a.code,
          refAufgabe: auf.bezeichnung,
          refSeiteVon: null,
          refSeiteBis: null,
        });
      }
    }
  }

  return fakten;
}

async function phasenmodellWissen(): Promise<string> {
  const modelle = await db.query.phasenmodell.findMany({
    with: {
      phasenTemplates: { orderBy: (t, { asc: a }) => [a(t.sortierung)] },
    },
    orderBy: (p, { asc: a }) => [a(p.name)],
  });

  return modelle
    .map(
      (m) =>
        `${m.name}: ` +
        m.phasenTemplates
          .map((t) => `${t.kuerzel} (${t.bezeichnung})`)
          .join(" → ")
    )
    .join("\n");
}

function bauePrompt(opts: {
  klasse: string;
  lektionen: number;
  modul: string;
  ziel: string | null;
  lbHinweis: string | null;
  stand: string | null;
  fakten: Fakt[];
  didaktik: string;
}): string {
  const faktenListe =
    opts.fakten.length > 0
      ? opts.fakten
          .map((f) => `  ${f.id}: [${f.typ}] ${f.titel}`)
          .join("\n")
      : "  (keine)";

  return `Du planst eine Unterrichtssequenz an einer Schweizer Berufsfachschule.

RAHMEN
  Klasse: ${opts.klasse}
  Umfang: ${opts.lektionen} Lektionen à 45 Minuten
  Modul: ${opts.modul}
  Wochenziel: ${opts.ziel ?? "nicht hinterlegt"}
${opts.lbHinweis ? `  Leistungsbeurteilung diese Woche: ${opts.lbHinweis}\n` : ""}${opts.stand ? `  Stand aus der letzten Lektion: ${opts.stand}\n` : ""}
FAKTEN (aus dem Unterrichtsmaterial, unveränderlich)
${faktenListe}

DIDAKTISCHE MODELLE (als Orientierung, nicht ausgeben)
${opts.didaktik}

AUFGABE
Erstelle einen Ablauf von 6 bis 10 Schritten.

Regeln:
1. Der erste Schritt ist IMMER eine Aktivierung des Vorwissens (typ "einstieg").
2. Danach folgt in der Regel ein Praxisbezug (typ "praxisbezug"): ein konkreter
   Bezug zum Lehrbetrieb der Lernenden im digitalen Business.
3. Fakten werden NUR referenziert, niemals umformuliert: dafür
   {"typ":"fakt","faktId":"<id>"}. Erfinde keine Aufgabennummern, keine
   LA-Codes und keine Slidezahlen.
4. Verwende möglichst alle Fakten, in sinnvoller Reihenfolge.
5. Nach Arbeitsphasen gehört eine Besprechung (typ "besprechung").
6. Der letzte Schritt ist ein Abschluss (typ "abschluss").
7. Die Dramaturgie darfst du variieren — ${opts.lektionen} Lektionen brauchen
   einen anderen Rhythmus als eine Doppellektion.
8. Formuliere knapp: die Lehrperson überfliegt das im Unterricht in Sekunden.
   Ein bis zwei Sätze pro Schritt, kein Fliesstext.

Antworte AUSSCHLIESSLICH mit JSON in dieser Form:
{"ablauf":[
  {"typ":"einstieg","titel":"kurzer Titel","text":"ein bis zwei Sätze"},
  {"typ":"fakt","faktId":"aufgabe-0"},
  {"typ":"besprechung","titel":"...","text":"..."}
]}`;
}

/**
 * Erzeugt den Ablaufentwurf für eine Sequenz. Bestätigte Abläufe werden nur
 * mit `force` überschrieben — dort steckt bereits die Durchsicht drin.
 */
export async function erzeugeEntwurf(
  bId: string,
  sequenzId: string,
  options?: { force?: boolean }
): Promise<{ ok: boolean; schritte?: number; fehler?: string }> {
  const seq = await db.query.sequenz.findFirst({
    where: and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)),
    with: { klasse: true, modul: true },
  });

  if (!seq) return { ok: false, fehler: "Sequenz nicht gefunden." };
  if (seq.status === "bestaetigt" && !options?.force) {
    return { ok: false, fehler: "Ablauf ist bereits bestätigt." };
  }
  if (!seq.modulId) return { ok: false, fehler: "Der Sequenz fehlt das Modul." };

  const kw = getKWFromDateString(seq.startDatum);
  if (kw === null) return { ok: false, fehler: "Der Sequenz fehlt das Datum." };

  const stoff = await getWochenstoff(bId, seq.modulId, kw);
  if (!stoff || stoff.ohneModulplan) {
    return {
      ok: false,
      fehler: `Für KW ${kw} gibt es keinen Modulplan-Eintrag — ohne ihn ist nicht bestimmbar, welcher Block ansteht.`,
    };
  }

  // Der Eintrag existiert, nennt aber keinen Block — dann ist der Modulplan
  // ohne Blockbezug importiert worden und die Kette KW ⇒ Block ⇒ LA ⇒ Aufgaben
  // reisst. Ohne diese Prüfung lief die Erzeugung stillschweigend weiter und
  // lieferte eine Lektion, die vollständig aus KI-Vorschlägen bestand: die
  // Lehrperson hielt eine erfundene Stunde für eine geplante.
  if (stoff.bloecke.length === 0) {
    return {
      ok: false,
      fehler:
        `Der Modulplan-Eintrag für KW ${kw} nennt keinen Block — daraus lässt ` +
        `sich keine Aufgabe bestimmen. Den Modulplan neu importieren (der ` +
        `Smartlearn-Export als HTML trägt die Blockspalte).`,
    };
  }

  const stand = await holeVorherigenUebertrag(
    bId,
    seq.klasseId,
    seq.modulId,
    seq.startDatum,
    sequenzId
  );

  const fakten = sammleFakten(stoff, stand?.uebertragErledigt ?? []);

  // Kein einziger Fakt heisst: alles aus diesem Block ist laut Übertrag
  // erledigt, oder der Aufgabenbaum fehlt. Beides ist eine Aussage, die die
  // Lehrperson lesen soll — die KI würde sonst eine Lektion aus dem Nichts
  // bauen. Die KI ordnet und formuliert, sie erfindet keine Fakten.
  if (fakten.length === 0) {
    return {
      ok: false,
      fehler:
        `Für KW ${kw} steht in ${stoff.bloecke.map((b) => `Block ${b.schluessel}`).join(" und ")} ` +
        `keine offene Aufgabe — entweder ist laut Übertrag alles erledigt, ` +
        `oder zum Modul fehlt der Aufgabenbaum.`,
    };
  }

  const standText = stand
    ? [
        stand.uebertragSlideBis ? `bis Slide ${stand.uebertragSlideBis}` : null,
        stand.uebertragErledigt?.length
          ? `erledigt: ${stand.uebertragErledigt.join(", ")}`
          : null,
        stand.uebertrag,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;

  const prompt = bauePrompt({
    klasse: seq.klasse.bezeichnung,
    lektionen: seq.lektionen ?? 2,
    modul: seq.modul
      ? `${seq.modul.nummer}${seq.modul.bezeichnung ? ` – ${seq.modul.bezeichnung}` : ""}`
      : "unbekannt",
    ziel: stoff.ziel,
    lbHinweis: stoff.lbHinweis,
    stand: standText || null,
    fakten,
    didaktik: await phasenmodellWissen(),
  });

  const antwort = await callAI(prompt, 0.6);
  if (!antwort.success) return { ok: false, fehler: antwort.error };

  const geparst = parseJsonFromAI<{ ablauf?: KiSchritt[] }>(antwort.content);
  const schritte = Array.isArray(geparst?.ablauf) ? geparst.ablauf : [];
  if (schritte.length === 0) {
    return { ok: false, fehler: "Die KI hat keinen verwertbaren Ablauf geliefert." };
  }

  const faktVon = new Map(fakten.map((f) => [f.id, f]));
  const verwendet = new Set<string>();
  const zeilen: (typeof sequenzAblauf.$inferInsert)[] = [];

  for (const s of schritte) {
    // Faktzeile: Text kommt aus unseren Daten, nie aus der KI-Antwort.
    if (s.faktId || s.typ === "fakt") {
      const f = s.faktId ? faktVon.get(s.faktId) : undefined;
      if (!f || verwendet.has(f.id)) continue;
      verwendet.add(f.id);
      zeilen.push({
        sequenzId,
        sortierung: zeilen.length,
        typ: f.typ,
        quelle: "fakt",
        titel: f.titel,
        text: f.text,
        refCode: f.refCode,
        refAufgabe: f.refAufgabe,
        refSeiteVon: f.refSeiteVon,
        refSeiteBis: f.refSeiteBis,
      });
      continue;
    }

    const typ = (ERLAUBTE_TYPEN as readonly string[]).includes(s.typ ?? "")
      ? (s.typ as AblaufTyp)
      : "frei";
    const titel = (s.titel ?? s.text ?? "").trim();
    if (!titel) continue;

    zeilen.push({
      sequenzId,
      sortierung: zeilen.length,
      typ,
      quelle: "vorschlag",
      titel: titel.slice(0, 300),
      text: s.text && s.text.trim() !== titel ? s.text.trim() : null,
    });
  }

  // Was die KI übergangen hat, geht nicht verloren — sonst fehlte im
  // Unterricht eine Aufgabe, die eigentlich ansteht.
  for (const f of fakten) {
    if (verwendet.has(f.id)) continue;
    zeilen.push({
      sequenzId,
      sortierung: zeilen.length,
      typ: f.typ,
      quelle: "fakt",
      titel: f.titel,
      text: f.text,
      refCode: f.refCode,
      refAufgabe: f.refAufgabe,
      refSeiteVon: f.refSeiteVon,
      refSeiteBis: f.refSeiteBis,
    });
  }

  if (zeilen.length === 0) {
    return { ok: false, fehler: "Der Entwurf wäre leer geblieben." };
  }

  await db.delete(sequenzAblauf).where(eq(sequenzAblauf.sequenzId, sequenzId));
  await db.insert(sequenzAblauf).values(zeilen);
  await db
    .update(sequenz)
    .set({ status: "entwurf", entwurfAm: new Date(), updatedAt: new Date() })
    .where(eq(sequenz.id, sequenzId));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");

  return { ok: true, schritte: zeilen.length };
}

/**
 * Nachtlauf: Entwürfe für alle anstehenden Sequenzen ohne eigenen Ablauf.
 * Läuft bewusst seriell — die Ollama-Cloud mag keine Salven.
 */
export async function erzeugeEntwuerfe(
  bId: string,
  vonDatum: string,
  bisDatum: string
): Promise<{
  ok: true;
  erzeugt: number;
  uebernommen: number;
  uebersprungen: number;
  fehler: { sequenzId: string; grund: string }[];
}> {
  const kandidaten = await db
    .select({
      id: sequenz.id,
      modulId: sequenz.modulId,
      startDatum: sequenz.startDatum,
    })
    .from(sequenz)
    .where(
      and(
        eq(sequenz.benutzerId, bId),
        isNotNull(sequenz.kalenderKurs),
        gte(sequenz.startDatum, vonDatum),
        lte(sequenz.startDatum, bisDatum),
        eq(sequenz.status, "leer")
      )
    )
    .orderBy(asc(sequenz.startDatum), asc(sequenz.startZeit));

  // Nach Modul und Kalenderwoche gruppieren: dieselbe Woche im selben Modul
  // wird einmal geplant und auf die übrigen Klassen übernommen. Das spart
  // nicht nur KI-Aufrufe, es ist auch die Planung, die die Lehrperson meint.
  const gruppen = new Map<string, string[]>();
  for (const k of kandidaten) {
    const kw = getKWFromDateString(k.startDatum);
    const schluessel = `${k.modulId ?? "ohne"}|${kw ?? "?"}`;
    if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
    gruppen.get(schluessel)!.push(k.id);
  }

  let erzeugt = 0;
  let uebernommen = 0;
  const fehler: { sequenzId: string; grund: string }[] = [];

  /** Sequenz derselben Woche im selben Modul, die schon einen Ablauf trägt. */
  async function vorhandenerAblaufDerWoche(
    schluessel: string,
    ausgeschlossen: string[]
  ): Promise<string | null> {
    const [modulTeil] = schluessel.split("|");
    if (modulTeil === "ohne") return null;

    const kandidatenDerWoche = await db
      .select({
        id: sequenz.id,
        startDatum: sequenz.startDatum,
        schritte: count(sequenzAblauf.id),
      })
      .from(sequenz)
      .leftJoin(sequenzAblauf, eq(sequenzAblauf.sequenzId, sequenz.id))
      .where(
        and(
          eq(sequenz.benutzerId, bId),
          eq(sequenz.modulId, modulTeil),
          isNotNull(sequenz.kalenderKurs),
          isNotNull(sequenz.startDatum)
        )
      )
      .groupBy(sequenz.id, sequenz.startDatum)
      .orderBy(asc(sequenz.startDatum));

    const kw = schluessel.split("|")[1];
    const treffer = kandidatenDerWoche.find(
      (k) =>
        !ausgeschlossen.includes(k.id) &&
        k.schritte > 0 &&
        String(getKWFromDateString(k.startDatum) ?? "?") === kw
    );

    return treffer?.id ?? null;
  }

  for (const [schluessel, ids] of gruppen) {
    // Hat eine Parallelklasse derselben Woche bereits einen Ablauf, wird der
    // übernommen statt ein zweiter erzeugt — dieselbe Woche im selben Modul
    // ist dieselbe Planung.
    const vorhandene = await vorhandenerAblaufDerWoche(schluessel, ids);
    if (vorhandene) {
      for (const id of ids) {
        const kopie = await uebernehmeAblauf(bId, id, vorhandene);
        if (kopie.ok) uebernommen++;
        else fehler.push({ sequenzId: id, grund: kopie.fehler ?? "unbekannt" });
      }
      continue;
    }

    const [erste, ...weitere] = ids;

    const res = await erzeugeEntwurf(bId, erste);
    if (!res.ok) {
      // Schlägt die Erzeugung fehl, scheitert die ganze Gruppe am selben
      // Grund — der Modulplan gilt für alle Klassen gleichermassen.
      for (const id of ids) {
        fehler.push({ sequenzId: id, grund: res.fehler ?? "unbekannt" });
      }
      continue;
    }
    erzeugt++;

    for (const id of weitere) {
      const kopie = await uebernehmeAblauf(bId, id, erste);
      if (kopie.ok) uebernommen++;
      else fehler.push({ sequenzId: id, grund: kopie.fehler ?? "unbekannt" });
    }
  }

  revalidatePath("/stundenplan");

  return {
    ok: true,
    erzeugt,
    uebernommen,
    uebersprungen: kandidaten.length - erzeugt - uebernommen - fehler.length,
    fehler,
  };
}

export async function bestaetigeAblauf(bId: string, sequenzId: string) {
  await db
    .update(sequenz)
    .set({ status: "bestaetigt", updatedAt: new Date() })
    .where(and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)));
  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
}

export async function getAblauf(bId: string, sequenzId: string) {
  if (!(await eigeneSequenz(bId, sequenzId))) return [];

  return db.query.sequenzAblauf.findMany({
    where: eq(sequenzAblauf.sequenzId, sequenzId),
    orderBy: (a, { asc: s }) => [s(a.sortierung)],
    with: { refMaterial: { columns: { id: true, titel: true, dateiPfad: true, url: true } } },
  });
}

// ─── Schleifen: Direktmanipulation am Ablauf ──────────────────────────────
//
// Kein KI-Ping-Pong: umordnen, umschreiben, löschen, ergänzen. Die Lehrperson
// geht den Entwurf am Mittwoch durch und korrigiert direkt
// (`erstellungsprozess.md`, Abschnitt 6.2).

export async function aktualisiereAblaufZeile(
  bId: string,
  zeilenId: string,
  werte: { titel?: string; text?: string | null }
) {
  if (!(await eigeneAblaufZeile(bId, zeilenId))) return;

  const titel = werte.titel?.trim();
  const text = werte.text?.trim();

  const [aktualisiert] = await db
    .update(sequenzAblauf)
    .set({
      ...(titel !== undefined ? { titel: titel.slice(0, 300) } : {}),
      ...(werte.text !== undefined ? { text: text || null } : {}),
    })
    .where(eq(sequenzAblauf.id, zeilenId))
    .returning({ sequenzId: sequenzAblauf.sequenzId });

  if (aktualisiert) revalidatePath(`/sequenzen/${aktualisiert.sequenzId}`);
}

export async function loescheAblaufZeile(bId: string, zeilenId: string) {
  if (!(await eigeneAblaufZeile(bId, zeilenId))) return;

  const [geloescht] = await db
    .delete(sequenzAblauf)
    .where(eq(sequenzAblauf.id, zeilenId))
    .returning({ sequenzId: sequenzAblauf.sequenzId });

  if (geloescht) revalidatePath(`/sequenzen/${geloescht.sequenzId}`);
}

/** Neue Reihenfolge festhalten; `ids` ist die Liste in der gewünschten Folge. */
export async function sortiereAblauf(
  bId: string,
  sequenzId: string,
  ids: string[]
) {
  if (!(await eigeneSequenz(bId, sequenzId))) return;

  for (const [i, id] of ids.entries()) {
    await db
      .update(sequenzAblauf)
      .set({ sortierung: i })
      .where(
        and(eq(sequenzAblauf.id, id), eq(sequenzAblauf.sequenzId, sequenzId))
      );
  }
  revalidatePath(`/sequenzen/${sequenzId}`);
}

/** Eigener Schritt — zählt als Vorschlag, weil er nicht aus dem Material stammt. */
export async function fuegeAblaufZeileHinzu(
  bId: string,
  sequenzId: string,
  typ: AblaufTyp,
  titel: string
) {
  if (!(await eigeneSequenz(bId, sequenzId))) return;

  const [letzte] = await db
    .select({ sortierung: sequenzAblauf.sortierung })
    .from(sequenzAblauf)
    .where(eq(sequenzAblauf.sequenzId, sequenzId))
    .orderBy(desc(sequenzAblauf.sortierung))
    .limit(1);

  await db.insert(sequenzAblauf).values({
    sequenzId,
    sortierung: (letzte?.sortierung ?? -1) + 1,
    typ,
    quelle: "vorschlag",
    titel: titel.trim().slice(0, 300) || "Neuer Schritt",
  });

  revalidatePath(`/sequenzen/${sequenzId}`);
}

// ─── Wiederverwendung über Klassen ────────────────────────────────────────
//
// Dasselbe Modul läuft mit mehreren Klassen: freitags zweimal 168 und zweimal
// 219, dienstags zweimal 278. Von sieben Sequenzen pro Woche sind vier
// Dubletten. Einmal planen, dann übernehmen — Fortschritt und Notizen bleiben
// pro Klasse getrennt (`erstellungsprozess.md`, Abschnitt 6.3).

export type Geschwister = {
  id: string;
  klasse: string;
  startDatum: string | null;
  startZeit: string | null;
  status: string;
  schritte: number;
  /** Stand aus der eigenen Lektion — zeigt, ob die Klassen auseinanderlaufen. */
  uebertragSlideBis: number | null;
  uebertragErledigt: string[] | null;
  uebernommenVon: string | null;
};

/**
 * Sequenzen derselben Kalenderwoche im selben Modul, andere Klasse.
 *
 * Die Woche ist die richtige Klammer, nicht der Tag: der Modulplan ist
 * wochenweise organisiert, und zwei Klassen können denselben Stoff an
 * verschiedenen Tagen haben.
 */
export async function getGeschwister(
  bId: string,
  sequenzId: string
): Promise<Geschwister[]> {
  const [seq] = await db
    .select({
      modulId: sequenz.modulId,
      startDatum: sequenz.startDatum,
      klasseId: sequenz.klasseId,
    })
    .from(sequenz)
    .where(and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)))
    .limit(1);

  if (!seq?.modulId || !seq.startDatum) return [];

  const kw = getKWFromDateString(seq.startDatum);
  if (kw === null) return [];

  const kandidaten = await db
    .select({
      id: sequenz.id,
      klasse: klasse.bezeichnung,
      startDatum: sequenz.startDatum,
      startZeit: sequenz.startZeit,
      status: sequenz.status,
      uebertragSlideBis: sequenz.uebertragSlideBis,
      uebertragErledigt: sequenz.uebertragErledigt,
      uebernommenVon: sequenz.uebernommenVon,
      schritte: count(sequenzAblauf.id),
    })
    .from(sequenz)
    .innerJoin(klasse, eq(sequenz.klasseId, klasse.id))
    .leftJoin(sequenzAblauf, eq(sequenzAblauf.sequenzId, sequenz.id))
    .where(
      and(
        eq(sequenz.benutzerId, bId),
        eq(sequenz.modulId, seq.modulId),
        ne(sequenz.id, sequenzId),
        // Eine Parallelklasse ist per Definition eine *andere* Klasse.
        // Dieselbe Klasse zweimal im selben Modul wären aufeinanderfolgende
        // Lektionen — dort wäre Übernehmen falsch.
        ne(sequenz.klasseId, seq.klasseId),
        // Alt-Sequenzen ohne Kalenderbezug sind Archiv, keine Geschwister.
        isNotNull(sequenz.kalenderKurs),
        isNotNull(sequenz.startDatum)
      )
    )
    .groupBy(
      sequenz.id,
      klasse.bezeichnung,
      sequenz.startDatum,
      sequenz.startZeit,
      sequenz.status,
      sequenz.uebertragSlideBis,
      sequenz.uebertragErledigt,
      sequenz.uebernommenVon
    )
    .orderBy(asc(sequenz.startDatum), asc(sequenz.startZeit));

  return kandidaten.filter(
    (k) => getKWFromDateString(k.startDatum) === kw
  );
}

/**
 * Ablauf einer Sequenz auf eine andere übertragen. Der bestehende Ablauf des
 * Ziels wird ersetzt — die Übernahme ist eine bewusste Aktion.
 *
 * Das Ziel landet auf «Entwurf», nicht auf «bestätigt»: durchsehen soll man
 * jede Klasse einzeln, auch wenn die Planung dieselbe ist.
 */
export async function uebernehmeAblauf(
  bId: string,
  zielId: string,
  quelleId: string
): Promise<{ ok: boolean; schritte?: number; fehler?: string }> {
  if (zielId === quelleId) return { ok: false, fehler: "Quelle und Ziel sind gleich." };

  // Beide Seiten müssen demselben Konto gehören.
  if (
    !(await eigeneSequenz(bId, zielId)) ||
    !(await eigeneSequenz(bId, quelleId))
  ) {
    return { ok: false, fehler: "Sequenz nicht gefunden." };
  }

  const quelle = await db.query.sequenzAblauf.findMany({
    where: eq(sequenzAblauf.sequenzId, quelleId),
    orderBy: (a, { asc: s }) => [s(a.sortierung)],
  });

  if (quelle.length === 0) {
    return { ok: false, fehler: "Die Quellsequenz hat keinen Ablauf." };
  }

  await db.delete(sequenzAblauf).where(eq(sequenzAblauf.sequenzId, zielId));
  await db.insert(sequenzAblauf).values(
    quelle.map((z, i) => ({
      sequenzId: zielId,
      sortierung: i,
      typ: z.typ,
      quelle: z.quelle,
      titel: z.titel,
      text: z.text,
      refCode: z.refCode,
      refAufgabe: z.refAufgabe,
      refMaterialId: z.refMaterialId,
      refSeiteVon: z.refSeiteVon,
      refSeiteBis: z.refSeiteBis,
    }))
  );

  await db
    .update(sequenz)
    .set({
      status: "entwurf",
      entwurfAm: new Date(),
      uebernommenVon: quelleId,
      updatedAt: new Date(),
    })
    .where(and(eq(sequenz.id, zielId), eq(sequenz.benutzerId, bId)));

  revalidatePath(`/sequenzen/${zielId}`);
  revalidatePath("/stundenplan");

  return { ok: true, schritte: quelle.length };
}

/** Übernahme lösen — ab hier plant die Klasse eigenständig. */
export async function loeseUebernahme(bId: string, sequenzId: string) {
  await db
    .update(sequenz)
    .set({ uebernommenVon: null, updatedAt: new Date() })
    .where(and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)));
  revalidatePath(`/sequenzen/${sequenzId}`);
}
