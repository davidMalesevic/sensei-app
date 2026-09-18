import "server-only";

/**
 * Den Einstieg einer Lektion ausarbeiten.
 *
 * Der Generator plant den Einstieg als eine Zeile: «Think-Pair-Share: …».
 * Das genügt, um zu wissen, was ansteht, aber nicht, um es zu halten. Hier
 * entsteht daraus das Unterrichtsmaterial — mit derselben Anweisung, die in
 * der Methodenbibliothek steht, und mit dem, was Sensei über diese Klasse
 * ohnehin weiss.
 *
 * Der Aufruf ist **bewusst ein eigener Schritt** und läuft nicht bei jedem
 * Erzeugen mit: eine Antwort dieser Länge kostet Zeit und Geld, und die
 * meisten Lektionen brauchen sie nie.
 *
 * Wie `entwurf.ts` nimmt diese Datei die Benutzer-ID als ersten Parameter und
 * liegt nicht in einer `"use server"`-Datei — sonst könnte jeder Browser sie
 * mit einer fremden ID aufrufen.
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  einstiegPaket,
  material,
  sequenz,
  sequenzAblauf,
  type AblaufHinweis,
} from "@/db/schema";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { pdfToText } from "@/lib/dokument-text";
import { getKWFromDateString } from "@/lib/kw";
import { ladeBibliothek, wirksameMethoden } from "@/lib/methoden";
import { parameterWerte, rendereVorlage } from "@/lib/methoden-vorlage";
import { leseDaten } from "@/lib/einstieg-daten";
import { getOffenenStoff } from "@/lib/rueckstand";
import { holeVorwissen } from "@/lib/vorwissen";
import type { StoffBlock } from "@/lib/modulbaum";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";

/** Ein Material für Lernende oder für die Lehrperson. */
export type PaketMaterial = {
  id: string;
  titel: string;
  typ: string;
  fuer: string;
  verwendung: string;
  inhalt: string;
};

export type PaketSchritt = {
  schritt: number;
  titel: string;
  dauer_minuten: number;
  sozialform: string;
  lehrperson: string;
  lernende: string;
};

export type PaketInhalt = {
  methode_id: string;
  titel: string;
  kurzerklaerung: string;
  ziel: string;
  dauer_minuten: number;
  sozialform: string;
  vorbereitung: string[];
  ablauf: PaketSchritt[];
  arbeitsauftrag: string;
  materialien: PaketMaterial[];
  erwartungshorizont: string;
  differenzierung: string;
  anschluss: string;
  /** JSON-String für Grafiken (Kreuzworträtsel, Mindmap …) oder leer. */
  daten_json: string;
};

export type Paket = typeof einstiegPaket.$inferSelect & { inhalt: PaketInhalt };

export async function holePaket(
  bId: string,
  sequenzId: string
): Promise<Paket | null> {
  const treffer = await db
    .select({ paket: einstiegPaket })
    .from(einstiegPaket)
    .innerJoin(sequenz, eq(sequenz.id, einstiegPaket.sequenzId))
    .where(
      and(eq(einstiegPaket.sequenzId, sequenzId), eq(sequenz.benutzerId, bId))
    );
  return (treffer[0]?.paket as Paket) ?? null;
}

export async function loeschePaket(bId: string, sequenzId: string) {
  const seq = await db.query.sequenz.findFirst({
    where: and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)),
    columns: { id: true },
  });
  if (!seq) return;
  await db.delete(einstiegPaket).where(eq(einstiegPaket.sequenzId, sequenzId));
  revalidatePath(`/sequenzen/${sequenzId}`);
}

// ─── Lerninhalt ──────────────────────────────────────────────────────────────

/**
 * Was die KI über den Stoff wissen muss. Aus dem Modulbaum kommt die
 * Gliederung, aus der Präsentation zum Block der Fachinhalt.
 *
 * Die Slides sind der Grund, warum das Etikett am Material zählt: ohne die
 * Zuordnung Block → Präsentation bliebe nur die Aufgabenliste, und die sagt,
 * *was* zu tun ist, nicht *worum es geht*.
 */
async function baueLerninhalt(
  bId: string,
  bloecke: StoffBlock[],
  modulId: string,
  ziel: string | null
): Promise<string> {
  const teile: string[] = [];
  if (ziel) teile.push(`Wochenziel: ${ziel}`);

  for (const b of bloecke) {
    teile.push(`\n## Block ${b.schluessel} — ${b.titel}`);
    for (const a of b.auftraege) {
      teile.push(`\n### ${a.code}`);
      if (a.aufgabenstellung) teile.push(a.aufgabenstellung.trim());
      for (const auf of a.aufgaben) {
        const text = auf.text?.trim();
        teile.push(`- ${auf.bezeichnung}${text ? `: ${text.slice(0, 600)}` : ""}`);
        for (const t of auf.teilaufgaben) {
          const tt = t.text?.trim();
          teile.push(`  - ${t.bezeichnung}${tt ? `: ${tt.slice(0, 400)}` : ""}`);
        }
      }
    }
  }

  const folien = await folienText(bId, bloecke, modulId);
  if (folien) teile.push(`\n## Aus der Präsentation\n${folien}`);

  return teile.join("\n").slice(0, 40_000);
}

/**
 * Der Text der Präsentation zu diesem Block.
 *
 * Zwei Wege, beide aus dem Bildungsplan: entweder trägt ein Material das
 * Etikett dieses Blocks, oder eine modulweite Präsentation hat am Block einen
 * Slidebereich. Im zweiten Fall werden nur diese Seiten gelesen — der Rest
 * gehört zu anderen Wochen und würde den Einstieg in die Irre führen.
 */
async function folienText(
  bId: string,
  bloecke: StoffBlock[],
  modulId: string
): Promise<string | null> {
  const stuecke: string[] = [];

  const etiketten = await db
    .select({
      titel: material.titel,
      dateiPfad: material.dateiPfad,
      blockSchluessel: material.blockSchluessel,
    })
    .from(material)
    .where(and(eq(material.modulId, modulId), eq(material.benutzerId, bId)));

  for (const b of bloecke) {
    // 1. Material, das genau diesem Block zugeordnet ist.
    for (const m of etiketten) {
      if (m.blockSchluessel !== b.schluessel || !m.dateiPfad) continue;
      const text = await pdfSeiten(m.dateiPfad, null, null);
      if (text) stuecke.push(`### ${m.titel}\n${text}`);
    }

    // 2. Modulweite Präsentation mit Slidebereich am Block.
    if (b.slides?.titel) {
      const modulweit = etiketten.find(
        (m) => m.titel === b.slides?.titel && m.blockSchluessel === null
      );
      if (modulweit?.dateiPfad) {
        const text = await pdfSeiten(
          modulweit.dateiPfad,
          b.slides.von,
          b.slides.bis
        );
        if (text) {
          const bereich =
            b.slides.von !== null ? ` (Slides ${b.slides.von}–${b.slides.bis ?? "?"})` : "";
          stuecke.push(`### ${b.slides.titel}${bereich}\n${text}`);
        }
      }
    }
  }

  if (stuecke.length === 0) return null;
  return stuecke.join("\n\n").slice(0, 20_000);
}

/** Seiten eines PDF als Text; `von`/`bis` sind Seitenzahlen ab 1. */
async function pdfSeiten(
  dateiPfad: string,
  von: number | null,
  bis: number | null
): Promise<string | null> {
  if (!dateiPfad.toLowerCase().endsWith(".pdf")) return null;
  try {
    const buffer = await readFile(join(UPLOAD_DIR, dateiPfad));
    const ganz = await pdfToText(buffer);
    if (von === null) return ganz.slice(0, 12_000);

    // `pdfToText` markiert jede Seite — daran wird geschnitten.
    const seiten = ganz.split(/^--- Seite (\d+) ---$/m);
    const gewaehlt: string[] = [];
    for (let i = 1; i < seiten.length; i += 2) {
      const nummer = Number(seiten[i]);
      if (nummer >= von && nummer <= (bis ?? von)) {
        gewaehlt.push(`[Slide ${nummer}] ${seiten[i + 1]?.trim() ?? ""}`);
      }
    }
    return gewaehlt.join("\n\n").slice(0, 12_000) || null;
  } catch {
    // Eine fehlende Datei darf die Ausarbeitung nicht verhindern — sie wird
    // dann eben ohne Folien gemacht.
    return null;
  }
}

// ─── Prüfen der Antwort ──────────────────────────────────────────────────────

const SOZIALFORMEN = ["EA", "PA", "GA", "PL"];

/**
 * Prüft die Antwort gegen das Ausgabeschema — von Hand, nicht mit einem
 * JSON-Schema-Prüfer: es geht um eine Handvoll Felder, und die Meldung soll
 * so klingen, dass die KI im zweiten Anlauf etwas damit anfangen kann.
 */
export function pruefePaket(roh: unknown): { ok: PaketInhalt } | { fehler: string } {
  const p = roh as Partial<PaketInhalt> | null;
  if (!p || typeof p !== "object") return { fehler: "Kein JSON-Objekt erhalten." };

  const fehlt = (
    [
      "titel",
      "kurzerklaerung",
      "ziel",
      "vorbereitung",
      "ablauf",
      "arbeitsauftrag",
      "materialien",
      "erwartungshorizont",
      "differenzierung",
      "anschluss",
    ] as const
  ).filter((k) => p[k] === undefined || p[k] === null || p[k] === "");
  if (fehlt.length > 0) return { fehler: `Es fehlen die Felder: ${fehlt.join(", ")}.` };

  if (!Array.isArray(p.ablauf) || p.ablauf.length === 0) {
    return { fehler: "«ablauf» muss mindestens einen Schritt enthalten." };
  }
  for (const [i, s] of p.ablauf.entries()) {
    if (!s?.titel || !s?.lehrperson || !s?.lernende) {
      return {
        fehler: `Ablaufschritt ${i + 1}: titel, lehrperson und lernende sind Pflicht.`,
      };
    }
    if (!SOZIALFORMEN.includes(s.sozialform)) {
      return {
        fehler: `Ablaufschritt ${i + 1}: «sozialform» muss EA, PA, GA oder PL sein.`,
      };
    }
  }

  if (!Array.isArray(p.materialien) || p.materialien.length === 0) {
    return { fehler: "«materialien» muss mindestens einen Eintrag enthalten." };
  }
  for (const [i, m] of p.materialien.entries()) {
    if (!m?.titel || !m?.inhalt) {
      return { fehler: `Material ${i + 1}: titel und inhalt sind Pflicht.` };
    }
  }

  return {
    ok: {
      methode_id: String(p.methode_id ?? ""),
      titel: String(p.titel),
      kurzerklaerung: String(p.kurzerklaerung),
      ziel: String(p.ziel),
      dauer_minuten: Number(p.dauer_minuten) || 0,
      sozialform: String(p.sozialform ?? ""),
      vorbereitung: (p.vorbereitung ?? []).map(String),
      ablauf: p.ablauf.map((s, i) => ({
        schritt: Number(s.schritt) || i + 1,
        titel: String(s.titel),
        dauer_minuten: Number(s.dauer_minuten) || 0,
        sozialform: String(s.sozialform),
        lehrperson: String(s.lehrperson),
        lernende: String(s.lernende),
      })),
      arbeitsauftrag: String(p.arbeitsauftrag),
      materialien: p.materialien.map((m, i) => ({
        id: String(m.id ?? `m${i + 1}`),
        titel: String(m.titel),
        typ: String(m.typ ?? "arbeitsblatt"),
        fuer: m.fuer === "lehrperson" ? "lehrperson" : "lernende",
        verwendung: String(m.verwendung ?? ""),
        inhalt: String(m.inhalt),
      })),
      erwartungshorizont: String(p.erwartungshorizont),
      differenzierung: String(p.differenzierung),
      anschluss: String(p.anschluss),
      daten_json: typeof p.daten_json === "string" ? p.daten_json : "",
    },
  };
}

// ─── Ausarbeiten ─────────────────────────────────────────────────────────────

export type AusarbeitenOptionen = {
  /** Überschreibt die Dauer aus dem Ablaufschritt. */
  dauerMinuten?: number;
  /** Überschreibt einzelne Parameter der Methode. */
  parameter?: Record<string, number>;
  klassengroesse?: number;
  anrede?: "du" | "Sie";
  zusatzwuensche?: string;
  /** Eine andere Methode als die am Einstieg hinterlegte. */
  methodeSchluessel?: string;
};

export async function arbeiteEinstiegAus(
  bId: string,
  sequenzId: string,
  optionen: AusarbeitenOptionen = {}
): Promise<{ ok: boolean; fehler?: string }> {
  const seq = await db.query.sequenz.findFirst({
    where: and(eq(sequenz.id, sequenzId), eq(sequenz.benutzerId, bId)),
    with: { klasse: true, modul: true },
  });
  if (!seq) return { ok: false, fehler: "Sequenz nicht gefunden." };
  if (!seq.modulId) return { ok: false, fehler: "Der Sequenz fehlt das Modul." };

  const bibliothek = await ladeBibliothek();
  if (!bibliothek) {
    return {
      ok: false,
      fehler: "Die Methodenbibliothek ist noch nicht eingelesen (siehe /methoden).",
    };
  }

  const einstieg = await db.query.sequenzAblauf.findFirst({
    where: and(
      eq(sequenzAblauf.sequenzId, sequenzId),
      eq(sequenzAblauf.typ, "einstieg")
    ),
    orderBy: (a, { asc }) => [asc(a.sortierung)],
  });

  const schluessel = optionen.methodeSchluessel ?? einstieg?.methodeSchluessel;
  if (!schluessel) {
    return {
      ok: false,
      fehler:
        "Am Einstieg steht keine Methode. Den Ablauf neu erzeugen oder eine Methode wählen.",
    };
  }

  const methode = (await wirksameMethoden(bId)).find(
    (m) => m.schluessel === schluessel
  );
  if (!methode) return { ok: false, fehler: "Methode nicht gefunden." };

  const kw = getKWFromDateString(seq.startDatum);
  if (kw === null) return { ok: false, fehler: "Der Sequenz fehlt das Datum." };

  const offen = await getOffenenStoff(
    bId,
    seq.klasseId,
    seq.modulId,
    kw,
    seq.startDatum
  );
  const stoff = offen.diese;
  if (!stoff || stoff.ohneModulplan || stoff.bloecke.length === 0) {
    return {
      ok: false,
      fehler: `Für KW ${kw} fehlt der Stoff — ohne Modulplan-Eintrag mit Block gibt es keinen Lerninhalt.`,
    };
  }

  const vorwissen = await holeVorwissen(
    bId,
    seq.klasseId,
    seq.modulId,
    seq.modul?.nummer ?? null,
    seq.startDatum
  );

  // Kommentar der Lehrperson am Einstieg — er steuert schon den Generator und
  // gehört genauso in die Ausarbeitung.
  const hinweis = (seq.ablaufHinweise as AblaufHinweis[] | null)?.find(
    (h) => h.anker === "typ:einstieg"
  )?.text;

  const werte = parameterWerte(methode.parameter, optionen.parameter);
  const dauer =
    optionen.dauerMinuten ?? einstieg?.dauerMinuten ?? methode.dauerStandard;

  const variablen = {
    thema: stoff.bloecke.map((b) => b.titel).join(" · ") || seq.titel,
    lerninhalt: await baueLerninhalt(bId, stoff.bloecke, seq.modulId, stoff.ziel),
    modul: seq.modul
      ? `${seq.modul.nummer}${seq.modul.bezeichnung ? ` – ${seq.modul.bezeichnung}` : ""}`
      : "",
    zielgruppe: `Lernende ${seq.klasse.beruf}, ${seq.klasse.lehrjahr}. Lehrjahr`,
    lernziele: vorwissen.kompetenzen
      .map((k) => `${k.kuerzel}: ${k.bezeichnung}`)
      .join("\n"),
    vorkenntnisse: vorkenntnisseText(vorwissen),
    klassengroesse: optionen.klassengroesse ?? 20,
    dauer_minuten: dauer,
    anrede: optionen.anrede ?? "du",
    zusatzwuensche: [optionen.zusatzwuensche, hinweis].filter(Boolean).join("\n"),
    methode_id: methode.schluessel,
    methode_name: methode.name,
    methode_kurzbeschreibung: methode.kurzbeschreibung,
    methode_sozialform: methode.sozialform
      .map((k) => bibliothek.sozialformen[k] ?? k)
      .join(" / "),
    methode_dauer: `${methode.dauerMin}–${methode.dauerMax}`,
    methode_anweisung: rendereVorlage(methode.anweisung, werte),
    daten_json_schema: methode.datenJsonSchema
      ? JSON.stringify(methode.datenJsonSchema, null, 2)
      : "",
    // Das Modell kann keine strukturierte Ausgabe erzwingen, also reist das
    // Schema im Prompt mit.
    ausgabe_schema: JSON.stringify(bibliothek.ausgabeSchema, null, 2),
  };

  const userPrompt = rendereVorlage(bibliothek.userPromptTemplate, variablen);

  let inhalt: PaketInhalt | null = null;
  let letzterFehler = "";

  // Zwei Anläufe: beim zweiten bekommt die KI die Prüfmeldung zu lesen. Mehr
  // nicht — wer beim zweiten Mal nicht liefert, liefert auch beim fünften
  // nicht, und jeder Anlauf kostet.
  for (const versuch of [1, 2]) {
    const prompt =
      versuch === 1
        ? userPrompt
        : `${userPrompt}\n\nDeine letzte Antwort war unbrauchbar: ${letzterFehler}\nAntworte erneut, vollständig und ausschliesslich als JSON.`;

    const antwort = await callAI(prompt, 0.7, bibliothek.systemPrompt);
    if (!antwort.success) return { ok: false, fehler: antwort.error };

    const geparst = parseJsonFromAI<unknown>(antwort.content);
    const geprueft = pruefePaket(geparst);
    if ("fehler" in geprueft) {
      letzterFehler = geprueft.fehler;
      continue;
    }

    // Hat die Methode ein Schema für `daten_json`, muss auch etwas
    // Brauchbares darin stehen: aus diesen Daten zeichnet Sensei das Gitter,
    // die Karten, das Diagramm. Fehlen sie, bleibt von der Methode nur ein
    // Text übrig — genau das, was sie nicht sein soll.
    if (methode.datenJsonSchema) {
      const daten = leseDaten(methode.schluessel, geprueft.ok.daten_json);
      if (!daten) {
        letzterFehler =
          "«daten_json» fehlt oder passt nicht zum vorgegebenen Schema. Gib es als gültigen JSON-String genau nach Schema zurück.";
        continue;
      }
    }

    inhalt = geprueft.ok;
    break;
  }

  if (!inhalt) {
    return {
      ok: false,
      fehler: `Die KI hat kein verwertbares Paket geliefert: ${letzterFehler}`,
    };
  }

  // Die Methode bestimmen wir, nicht die Antwort.
  inhalt.methode_id = methode.schluessel;

  const zeile = {
    sequenzId,
    methodeSchluessel: methode.schluessel,
    methodeName: methode.name,
    dauerMinuten: dauer,
    parameter: werte,
    zusatzwuensche: variablen.zusatzwuensche || null,
    inhalt,
    modell: process.env.OLLAMA_MODEL ?? null,
    erzeugtAm: new Date(),
  };

  await db
    .insert(einstiegPaket)
    .values(zeile)
    .onConflictDoUpdate({ target: einstiegPaket.sequenzId, set: zeile });

  // Steht am Einstieg noch keine Methode (selbst gewählt statt vom Generator),
  // wird sie dort nachgetragen — sonst zeigte die Zeile nichts an.
  if (einstieg && einstieg.methodeSchluessel !== methode.schluessel) {
    await db
      .update(sequenzAblauf)
      .set({ methodeSchluessel: methode.schluessel })
      .where(eq(sequenzAblauf.id, einstieg.id));
  }

  revalidatePath(`/sequenzen/${sequenzId}`);
  return { ok: true };
}

/** Der Lernstand dieser Klasse als Fliesstext für den Prompt. */
function vorkenntnisseText(v: Awaited<ReturnType<typeof holeVorwissen>>): string {
  if (v.wochen.length === 0) return "";
  return v.wochen
    .map((w) => {
      const kopf = `KW ${w.kw}${w.ziel ? ` — ${w.ziel}` : ""}`;
      const auf = w.erledigt.length
        ? w.erledigt.map((e) => `  - ${e}`).join("\n")
        : "  - (nichts abgehakt)";
      return `${kopf}\n${auf}${w.notiz ? `\n  Notiz: ${w.notiz}` : ""}`;
    })
    .join("\n");
}
