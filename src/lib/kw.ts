/** ISO-8601 Kalenderwoche (Schweizer Konvention: Woche startet am Montag). */
export function getKW(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  // Donnerstag der laufenden Woche bestimmt das ISO-Jahr
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** KW aus einem ISO-Datumsstring (`YYYY-MM-DD`), null bei fehlendem Datum. */
export function getKWFromDateString(value: string | null): number | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return getKW(d);
}
