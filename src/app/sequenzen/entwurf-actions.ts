"use server";

import { db } from "@/db";
import { sequenz, sequenzAblauf } from "@/db/schema";
import { and, asc, eq, gte, isNotNull, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { getWochenstoff, type Wochenstoff } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";
import { getVorherigenUebertrag } from "./uebertrag-actions";

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
  sequenzId: string,
  options?: { force?: boolean }
): Promise<{ ok: boolean; schritte?: number; fehler?: string }> {
  const seq = await db.query.sequenz.findFirst({
    where: eq(sequenz.id, sequenzId),
    with: { klasse: true, modul: true },
  });

  if (!seq) return { ok: false, fehler: "Sequenz nicht gefunden." };
  if (seq.status === "bestaetigt" && !options?.force) {
    return { ok: false, fehler: "Ablauf ist bereits bestätigt." };
  }
  if (!seq.modulId) return { ok: false, fehler: "Der Sequenz fehlt das Modul." };

  const kw = getKWFromDateString(seq.startDatum);
  if (kw === null) return { ok: false, fehler: "Der Sequenz fehlt das Datum." };

  const stoff = await getWochenstoff(seq.modulId, kw);
  if (!stoff || stoff.ohneModulplan) {
    return {
      ok: false,
      fehler: `Für KW ${kw} gibt es keinen Modulplan-Eintrag — ohne ihn ist nicht bestimmbar, welcher Block ansteht.`,
    };
  }

  const stand = await getVorherigenUebertrag(
    seq.klasseId,
    seq.modulId,
    seq.startDatum,
    sequenzId
  );

  const fakten = sammleFakten(stoff, stand?.uebertragErledigt ?? []);

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
  vonDatum: string,
  bisDatum: string
): Promise<{
  ok: true;
  erzeugt: number;
  uebersprungen: number;
  fehler: { sequenzId: string; grund: string }[];
}> {
  const kandidaten = await db
    .select({ id: sequenz.id })
    .from(sequenz)
    .where(
      and(
        isNotNull(sequenz.kalenderKurs),
        gte(sequenz.startDatum, vonDatum),
        lte(sequenz.startDatum, bisDatum),
        eq(sequenz.status, "leer")
      )
    )
    .orderBy(asc(sequenz.startDatum));

  let erzeugt = 0;
  const fehler: { sequenzId: string; grund: string }[] = [];

  for (const k of kandidaten) {
    const res = await erzeugeEntwurf(k.id);
    if (res.ok) erzeugt++;
    else fehler.push({ sequenzId: k.id, grund: res.fehler ?? "unbekannt" });
  }

  revalidatePath("/stundenplan");

  return {
    ok: true,
    erzeugt,
    uebersprungen: kandidaten.length - erzeugt - fehler.length,
    fehler,
  };
}

export async function bestaetigeAblauf(sequenzId: string) {
  await db
    .update(sequenz)
    .set({ status: "bestaetigt", updatedAt: new Date() })
    .where(eq(sequenz.id, sequenzId));
  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
}

export async function getAblauf(sequenzId: string) {
  return db.query.sequenzAblauf.findMany({
    where: eq(sequenzAblauf.sequenzId, sequenzId),
    orderBy: (a, { asc: s }) => [s(a.sortierung)],
    with: { refMaterial: { columns: { id: true, titel: true, dateiPfad: true, url: true } } },
  });
}
