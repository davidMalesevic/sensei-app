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
  /**
   * Blockschlüssel dieser Woche, normalisiert («1», «A»). Eine Woche kann
   * zwei Blöcke berühren. String statt Zahl, weil die Exporte Blöcke
   * unterschiedlich benennen: «Block 01», «Block 1», «Block A».
   */
  bloecke: string[];
  /** In dieser Woche genannte Lern- und Arbeitsaufträge. */
  laCodes: string[];
};

/**
 * Blockschlüssel vereinheitlichen: «01» und «1» sind derselbe Block, «a» und
 * «A» auch. Nur fürs Vergleichen — angezeigt wird der Titel des Blocks.
 */
export function normalisiereBlock(roh: string): string {
  const t = roh.trim().toUpperCase();
  return /^\d+$/.test(t) ? String(Number(t)) : t;
}

/** LA-Codes enthalten je nach Modul Punkte und Bindestriche: LA_A.10_… */
const LA_MUSTER = /LA[_][A-Za-z0-9_.\-]+/g;

const ROW_START = /^(KW\s*(\d{1,2})|FERIEN)\b/i;
const LA_SECTION_START = /^Block\s+\d{1,2}\s*[-–]\s*/i;
const LB_PREFIX = /^(?:\*+\s*)?LB\s*:\s*/i;

/** Erkennt, ob ein Text überhaupt aus einem Smartlearn-Export stammt. */
export function isSmartlearnExport(text: string): boolean {
  if (!/Modularbeitsplan/i.test(text)) {
    // Modul 219 hat gar keinen Modularbeitsplan, aber denselben Aufgabenbaum.
    return /\bLA[_][A-Za-z0-9_.\-]+/.test(text) && /\bBlock\s+\w/i.test(text);
  }
  return true;
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
    const bloecke = bloeckeAus(inhaltText);
    const laCodes = laCodesAus(inhaltText);

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
  /** Normalisierter Schlüssel: «1», «2», «A» — passend zum Modularbeitsplan. */
  schluessel: string;
  /** Reihenfolge im Dokument; für Buchstaben die Position im Alphabet. */
  nummer: number | null;
  titel: string;
  auftraege: SmartlearnLA[];
};

type Ueberschrift = { ebene: number; titel: string; text: string };

const AUFGABE = /^Aufgabe\s+\d/i;
const TEILAUFGABE = /^Teilaufgabe\s+\d/i;
const LA_CODE = /^LA[_\s][A-Za-z0-9_.\-]+/;
const RUBRIK = /^(Ausgangslage|Aufgabenstellung|Gütekriterien)$/i;

/**
 * Blocküberschriften kommen in drei Schreibweisen vor:
 *
 *   «Block 01 - Einführung»      (119)
 *   «Block 1: Vorkenntnisse …»   (219, 278)
 *   «A - Reifegrade beurteilen»  (168)
 */
const BLOCK_MIT_WORT = /^Block\s+([0-9]{1,2}|[A-Z])\s*[-–—:]?\s*(.*)$/i;
const BLOCK_NUR_KUERZEL = /^([A-Z]|[0-9]{1,2})\s*[-–—:]\s*(.+)$/;

function alsBlock(titel: string): { schluessel: string; titel: string } | null {
  const mitWort = titel.match(BLOCK_MIT_WORT);
  if (mitWort) {
    return {
      schluessel: normalisiereBlock(mitWort[1]),
      titel: mitWort[2].trim() || `Block ${mitWort[1]}`,
    };
  }

  const kuerzel = titel.match(BLOCK_NUR_KUERZEL);
  if (kuerzel) {
    return {
      schluessel: normalisiereBlock(kuerzel[1]),
      titel: kuerzel[2].trim(),
    };
  }

  return null;
}

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
    // Blöcke stehen auf h2; tiefere Ebenen wiederholen den Titel teilweise
    // («A - Reifegrade beurteilen» auch als h3) und würden sonst doppeln.
    const alsBlockErkannt = a.ebene <= 2 ? alsBlock(a.titel) : null;
    if (alsBlockErkannt) {
      const vorhanden = bloecke.find(
        (b) => b.schluessel === alsBlockErkannt.schluessel
      );
      block =
        vorhanden ??
        {
          schluessel: alsBlockErkannt.schluessel,
          nummer: /^\d+$/.test(alsBlockErkannt.schluessel)
            ? Number(alsBlockErkannt.schluessel)
            : alsBlockErkannt.schluessel.charCodeAt(0) - 64,
          titel: alsBlockErkannt.titel,
          auftraege: [],
        };
      if (!vorhanden) bloecke.push(block);
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

// ─── Modularbeitsplan aus der HTML-Tabelle ────────────────────────────────
//
// Die Exporte unterscheiden sich stärker, als ein Textparser verkraftet:
//
//   119  Datum | Block & Lern- und Arbeitsauftrag | Bemerkung   «KW 33», «LB:»
//   168  KW    | Block Lern- und Arbeitsauftrag   | Bemerkung   «KW33», «Checkpoint 01:»
//   278  KW | HZ | Block | Thema | Unterrichtsmaterial          «33/34», «LB-2:»
//   219  gar keine Tabelle
//
// Über die Tabellenstruktur statt über geglätteten Text zu gehen, macht das
// beherrschbar: Spalten werden über ihre Kopfzeile zugeordnet.

/** Alle Blockschlüssel aus einem Text, normalisiert. */
function bloeckeAus(text: string): string[] {
  const treffer = [...text.matchAll(/Block\s+([0-9]{1,2}|[A-Z])\b/gi)].map((m) =>
    normalisiereBlock(m[1])
  );
  return [...new Set(treffer)];
}

/** Alle LA-Codes aus einem Text, ohne Dateiendung. */
function laCodesAus(text: string): string[] {
  const treffer = (text.match(LA_MUSTER) ?? []).map((c) =>
    c.replace(/\.docx?$/i, "")
  );
  return [...new Set(treffer)];
}

/** Leistungsbeurteilungen heissen je nach Modul «LB:», «LB-2:» oder «Checkpoint 01:». */
const LB_MUSTER = /(?:LB\s*-?\s*\d*|Checkpoint\s*\d*)\s*:\s*([^|\n]+)/gi;

function zellenText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

type Spalten = {
  kw: number;
  block: number | null;
  inhalt: number;
  bemerkung: number | null;
};

/** Ordnet die Spalten über ihre Kopfzeile zu. */
function erkenneSpalten(kopf: string[]): Spalten | null {
  const finde = (muster: RegExp) => kopf.findIndex((h) => muster.test(h));

  const kw = finde(/^(kw|datum|woche)\b/i);
  if (kw === -1) return null;

  const block = finde(/^block$/i);
  // Die inhaltliche Spalte ist bei 278 «Thema», sonst die breite Block-Spalte.
  let inhalt = finde(/^thema/i);
  if (inhalt === -1) inhalt = finde(/block.*(auftrag|lern)/i);
  if (inhalt === -1) inhalt = block !== -1 ? block : kw + 1;

  const bemerkung = finde(/bemerkung|unterrichtsmaterial|material/i);

  return {
    kw,
    block: block === -1 ? null : block,
    inhalt,
    bemerkung: bemerkung === -1 || bemerkung === inhalt ? null : bemerkung,
  };
}

/** «KW 33» → [33], «KW33» → [33], «33/34/37» → [33, 34, 37], «Ferien» → [] */
function kalenderwochenAus(zelle: string): number[] {
  if (/ferien|unterrichtsfrei/i.test(zelle)) return [];
  const zahlen = [...zelle.matchAll(/\d{1,2}/g)]
    .map((m) => Number(m[0]))
    .filter((n) => n >= 1 && n <= 53);
  return [...new Set(zahlen)];
}

/**
 * Liest den Modularbeitsplan aus dem rohen HTML.
 *
 * Gibt eine leere Liste zurück, wenn keine auswertbare Tabelle existiert —
 * dann greift der Aufrufer auf den Textparser oder die KI zurück.
 */
export function parseModularbeitsplanHtml(html: string): SmartlearnWoche[] {
  const start = html.search(/Modularbeitsplan/i);
  if (start === -1) return [];

  const tabelle = html.slice(start).match(/<table[\s\S]*?<\/table>/i);
  if (!tabelle) return [];

  const zeilen = [...tabelle[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((z) =>
    [...z[0].matchAll(/<t[dh][\s\S]*?<\/t[dh]>/gi)].map((c) => zellenText(c[0]))
  );
  if (zeilen.length < 2) return [];

  const spalten = erkenneSpalten(zeilen[0]);
  if (!spalten) return [];

  const wochen: SmartlearnWoche[] = [];

  for (const zellen of zeilen.slice(1)) {
    if (zellen.length === 0) continue;

    const kws = kalenderwochenAus(zellen[spalten.kw] ?? "");
    if (kws.length === 0) continue; // Ferienzeile

    const inhalt = zellen[spalten.inhalt] ?? "";
    const bemerkung =
      spalten.bemerkung !== null ? (zellen[spalten.bemerkung] ?? "") : "";
    const ganzeZeile = zellen.join(" | ");

    // Eigene Block-Spalte (278) hat Vorrang vor der Erwähnung im Fliesstext.
    const bloecke =
      spalten.block !== null && zellen[spalten.block]
        ? [...new Set(
            [...(zellen[spalten.block].match(/[0-9]{1,2}|[A-Z]/g) ?? [])].map(
              normalisiereBlock
            )
          )]
        : bloeckeAus(ganzeZeile);

    const lbTreffer = [...ganzeZeile.matchAll(LB_MUSTER)].map((m) =>
      m[1].trim()
    );

    const ziel =
      inhalt.replace(LB_MUSTER, "").replace(/\s+/g, " ").trim() ||
      lbTreffer.join(" · ");
    if (!ziel) continue;

    for (const kw of kws) {
      wochen.push({
        kw,
        ziel: ziel.slice(0, 300),
        beschreibung: bemerkung || null,
        lbHinweis: lbTreffer.length > 0 ? lbTreffer.join(" · ") : null,
        bloecke,
        laCodes: laCodesAus(ganzeZeile),
      });
    }
  }

  return wochen;
}
