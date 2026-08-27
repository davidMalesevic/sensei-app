/**
 * Parser für Smartlearn-HTML-Exporte.
 *
 * Der Export enthält den Modularbeitsplan als Tabelle
 * (`Datum | Block & Lern- und Arbeitsauftrag | Bemerkung`) und darunter die
 * einzelnen Lern- und Arbeitsaufträge. Beides wird hier deterministisch
 * gelesen, damit der Import nicht auf die KI angewiesen ist und die
 * Original-Bezeichnungen (LA-Codes, «Aufgabe 1 / Teilaufgabe 2») erhalten
 * bleiben.
 */

export type SmartlearnWoche = {
  kw: number;
  ziel: string;
  beschreibung: string | null;
  lbHinweis: string | null;
  /** Blocknummern dieser Woche — eine Woche kann zwei Blöcke berühren. */
  bloecke: number[];
  /** In dieser Woche genannte Lern- und Arbeitsaufträge. */
  laCodes: string[];
};

const ROW_START = /^(KW\s*(\d{1,2})|FERIEN)\b/i;
const LA_SECTION_START = /^Block\s+\d{1,2}\s*[-–]\s*/i;
const LB_PREFIX = /^(?:\*+\s*)?LB\s*:\s*/i;

/** Erkennt, ob ein Text überhaupt aus einem Smartlearn-Export stammt. */
export function isSmartlearnExport(text: string): boolean {
  return (
    /Modularbeitsplan/i.test(text) &&
    /Block\s*&\s*Lern-\s*und\s*Arbeitsauftrag/i.test(text)
  );
}

/** Schneidet den Abschnitt «Modularbeitsplan» aus dem Gesamttext. */
function cutModularbeitsplan(text: string): string[] | null {
  const lines = text.split("\n").map((l) => l.trim());

  const startIdx = lines.findIndex(
    (l, i) =>
      /^Modularbeitsplan$/i.test(l) &&
      // Kopfzeile der Tabelle folgt in den nächsten Zeilen
      lines.slice(i + 1, i + 4).some((n) => /Block\s*&\s*Lern-/i.test(n))
  );
  if (startIdx === -1) return null;

  const rest = lines.slice(startIdx + 1);
  const endIdx = rest.findIndex((l) => LA_SECTION_START.test(l));

  return (endIdx === -1 ? rest : rest.slice(0, endIdx)).filter(
    (l) => l.length > 0
  );
}

/** Gruppiert die Tabellenzeilen: eine Zeile beginnt mit «KW nn» oder «FERIEN». */
function gruppiereZeilen(lines: string[]): string[][] {
  const rows: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (/^Datum\s*\|/i.test(line)) continue; // Kopfzeile
    if (ROW_START.test(line)) {
      if (current) rows.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) rows.push(current);

  return rows;
}

/**
 * Liest den Modularbeitsplan aus einem Smartlearn-Export.
 * Ferienzeilen und Fussnoten werden übersprungen.
 */
export function parseModularbeitsplan(text: string): SmartlearnWoche[] {
  const lines = cutModularbeitsplan(text);
  if (!lines) return [];

  const wochen: SmartlearnWoche[] = [];

  for (const rowLines of gruppiereZeilen(lines)) {
    const kwMatch = rowLines[0].match(/^KW\s*(\d{1,2})/i);
    if (!kwMatch) continue; // FERIEN o.ä.

    const kw = parseInt(kwMatch[1], 10);
    if (!Number.isFinite(kw) || kw < 1 || kw > 53) continue;

    // Zellen über die ganze Zeile hinweg auftrennen
    const cells = rowLines
      .join("\n")
      .split("|")
      .map((c) => c.trim());

    // Erste Zelle enthält noch das "KW nn" – abschneiden
    const datumZelle = cells[0].replace(/^KW\s*\d{1,2}\s*/i, "").trim();
    const bemerkung = cells
      .slice(2)
      .join("\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\*+\s*Rückgabe/i.test(l))
      .join(" ")
      .trim();

    // Inhaltszelle = Rest der ersten Zelle + zweite Zelle
    const inhaltRoh = [datumZelle, cells[1] ?? ""]
      .filter((c) => c && c.length > 0)
      .join("\n");

    const inhaltZeilen = inhaltRoh
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\*+Rückgabe/i.test(l));

    // LB-Zeilen (Leistungsbeurteilungen) separat halten
    const lbZeilen = inhaltZeilen.filter((l) => LB_PREFIX.test(l));
    const restZeilen = inhaltZeilen.filter((l) => !LB_PREFIX.test(l));

    const ziel = restZeilen.join(" · ").slice(0, 300);
    if (!ziel && lbZeilen.length === 0) continue;

    // «Block 01 und Block 02» → [1, 2]; LA-Codes bleiben im Original.
    const inhaltText = inhaltZeilen.join(" ");
    const bloecke = [
      ...new Set(
        [...inhaltText.matchAll(/Block\s+(\d{1,2})/gi)].map((m) => Number(m[1]))
      ),
    ].sort((a, b) => a - b);
    const laCodes = [
      ...new Set(
        [...inhaltText.matchAll(/LA[_][A-Za-z0-9_]+/g)].map((m) =>
          m[0].replace(/\.docx?$/i, "")
        )
      ),
    ];

    wochen.push({
      kw,
      ziel: ziel || lbZeilen.map((l) => l.replace(LB_PREFIX, "")).join(" · "),
      beschreibung: bemerkung || null,
      bloecke,
      laCodes,
      lbHinweis:
        lbZeilen.length > 0
          ? lbZeilen.map((l) => l.replace(LB_PREFIX, "").trim()).join(" · ")
          : null,
    });
  }

  return wochen;
}

// ─── Strukturierter Modulbaum aus dem HTML-Export ─────────────────────────
//
// Der geglättete Text reicht für den Modularbeitsplan, nicht aber für den
// Aufgabenbaum: dort trägt die Überschriftenebene die Bedeutung.
//
//   h2  Block 01 – Einführung
//   h3  LA_119_1000_Kommunikationstechniken
//   h5  Ausgangslage / Aufgabenstellung / Gütekriterien
//   h4  Aufgabe 1
//   h6  Teilaufgabe 1
//
// Die Original-Bezeichnungen bleiben unverändert — die Lehrperson muss der
// Klasse «macht Aufgabe 4.2» sagen können.

export type SmartlearnTeilaufgabe = {
  bezeichnung: string;
  text: string | null;
};

export type SmartlearnAufgabe = {
  bezeichnung: string;
  text: string | null;
  teilaufgaben: SmartlearnTeilaufgabe[];
};

export type SmartlearnLA = {
  code: string;
  ausgangslage: string | null;
  aufgabenstellung: string | null;
  guetekriterien: string | null;
  aufgaben: SmartlearnAufgabe[];
};

export type SmartlearnBlock = {
  nummer: number;
  titel: string;
  auftraege: SmartlearnLA[];
};

type Ueberschrift = { ebene: number; titel: string; text: string };

const AUFGABE = /^Aufgabe\s+\d/i;
const TEILAUFGABE = /^Teilaufgabe\s+\d/i;
const LA_CODE = /^LA[_\s][A-Za-z0-9_]+/;
const BLOCK = /^Block\s+(\d{1,2})\s*[-–—]?\s*(.*)$/i;
const RUBRIK = /^(Ausgangslage|Aufgabenstellung|Gütekriterien)$/i;

function textAus(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .trim();
}

/**
 * Zerlegt das Dokument in Überschriften samt dem Fliesstext, der bis zur
 * nächsten Überschrift folgt.
 */
function schneideUeberschriften(html: string): Ueberschrift[] {
  const treffer = [...html.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)];
  const abschnitte: Ueberschrift[] = [];

  for (let i = 0; i < treffer.length; i++) {
    const t = treffer[i];
    const start = (t.index ?? 0) + t[0].length;
    const ende = i + 1 < treffer.length ? treffer[i + 1].index ?? html.length : html.length;
    const titel = textAus(t[2]).replace(/\s+/g, " ").trim();
    if (!titel) continue;
    abschnitte.push({
      ebene: Number(t[1]),
      titel,
      text: textAus(html.slice(start, ende)),
    });
  }

  return abschnitte;
}

/**
 * Liest den Aufgabenbaum aus dem Smartlearn-HTML.
 *
 * Bewusst ohne KI: Aufgabennummern und LA-Codes sind Fakten aus dem Material
 * und dürfen nicht umformuliert oder erfunden werden.
 */
export function parseSmartlearnStruktur(html: string): SmartlearnBlock[] {
  const bloecke: SmartlearnBlock[] = [];
  let block: SmartlearnBlock | null = null;
  let la: SmartlearnLA | null = null;
  let aufgabe: SmartlearnAufgabe | null = null;

  for (const a of schneideUeberschriften(html)) {
    const blockTreffer = a.titel.match(BLOCK);
    if (blockTreffer) {
      block = {
        nummer: Number(blockTreffer[1]),
        titel: blockTreffer[2].trim() || `Block ${blockTreffer[1]}`,
        auftraege: [],
      };
      bloecke.push(block);
      la = null;
      aufgabe = null;
      continue;
    }

    if (!block) continue;

    if (LA_CODE.test(a.titel)) {
      // Zeilen wie «Lern- und Arbeitsauftrag LA_….docx» sind Dateiverweise,
      // keine neuen Aufträge.
      const code = a.titel.replace(/\.docx?$/i, "").trim();
      if (la && la.code === code) continue;
      la = {
        code,
        ausgangslage: null,
        aufgabenstellung: null,
        guetekriterien: null,
        aufgaben: [],
      };
      block.auftraege.push(la);
      aufgabe = null;
      continue;
    }

    if (!la) continue;

    if (TEILAUFGABE.test(a.titel)) {
      if (aufgabe) {
        aufgabe.teilaufgaben.push({
          bezeichnung: a.titel,
          text: a.text || null,
        });
      }
      continue;
    }

    if (AUFGABE.test(a.titel)) {
      aufgabe = { bezeichnung: a.titel, text: a.text || null, teilaufgaben: [] };
      la.aufgaben.push(aufgabe);
      continue;
    }

    if (RUBRIK.test(a.titel)) {
      const inhalt = a.text || null;
      if (/^Ausgangslage$/i.test(a.titel)) la.ausgangslage = inhalt;
      else if (/^Aufgabenstellung$/i.test(a.titel)) la.aufgabenstellung = inhalt;
      else la.guetekriterien = inhalt;
    }
  }

  return bloecke.filter((b) => b.auftraege.length > 0);
}
