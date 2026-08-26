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

    wochen.push({
      kw,
      ziel: ziel || lbZeilen.map((l) => l.replace(LB_PREFIX, "")).join(" · "),
      beschreibung: bemerkung || null,
      lbHinweis:
        lbZeilen.length > 0
          ? lbZeilen.map((l) => l.replace(LB_PREFIX, "").trim()).join(" · ")
          : null,
    });
  }

  return wochen;
}
