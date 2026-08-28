/**
 * Zuordnung Modulnummer → Lehrjahr aus dem offiziellen EDB-Modulbaukasten.
 *
 * Früher standen diese Module als globale Zeilen in der Datenbank (aus
 * `seed.ts`). Seit die Daten pro Benutzer getrennt sind, entstehen Module beim
 * Stundenplan-Import — dort ist aber nur die Nummer bekannt. Diese Tabelle
 * ergänzt das Lehrjahr, damit die Module im Bildungsplan weiterhin gruppiert
 * erscheinen statt unter «Ohne Lehrjahr».
 *
 * Quelle: modulbaukasten.ch
 */
const NACH_LEHRJAHR: Record<number, number[]> = {
  1: [119, 134, 162, 224, 230, 254, 319, 331, 332, 370, 374, 375],
  2: [164, 213, 218, 231, 278, 279, 325, 333, 336, 338, 349, 367, 371, 377, 395],
  3: [168, 219, 220, 282, 337, 372, 378, 392, 394],
  4: [229, 235, 339, 373, 379, 396],
};

const LEHRJAHR_VON = new Map<number, number>(
  Object.entries(NACH_LEHRJAHR).flatMap(([lehrjahr, nummern]) =>
    nummern.map((n) => [n, Number(lehrjahr)] as [number, number])
  )
);

/** null, wenn die Nummer im Modulbaukasten nicht vorkommt. */
export function lehrjahrFuerModul(nummer: number): number | null {
  return LEHRJAHR_VON.get(nummer) ?? null;
}
