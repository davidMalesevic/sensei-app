/**
 * Schulzeit ist Schweizer Zeit — der Container läuft aber auf UTC.
 *
 * `new Date().toISOString()` liefert dort das UTC-Datum: zwischen Mitternacht
 * und 02:00 Schweizer Zeit ist das der Vortag, und jeder Uhrzeitvergleich
 * liegt zwei Stunden daneben. Deshalb alles über Europe/Zurich rechnen.
 */

const ZONE = "Europe/Zurich";

export type SchweizerJetzt = {
  /** YYYY-MM-DD */
  datum: string;
  /** HH:MM */
  zeit: string;
};

export function schweizerJetzt(bezug: Date = new Date()): SchweizerJetzt {
  // sv-SE formatiert als "YYYY-MM-DD HH:MM:SS" — direkt vergleichbar.
  const formatiert = new Intl.DateTimeFormat("sv-SE", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(bezug);

  const [datum, zeit] = formatiert.split(" ");
  return { datum, zeit: zeit.slice(0, 5) };
}

/** Nur das Datum — ersetzt `new Date().toISOString().slice(0, 10)`. */
export function schweizerHeute(bezug: Date = new Date()): string {
  return schweizerJetzt(bezug).datum;
}

/** Datum um `tage` verschoben, weiterhin in Schweizer Zeit. */
export function schweizerDatumPlus(tage: number, bezug: Date = new Date()): string {
  const d = new Date(bezug);
  d.setDate(d.getDate() + tage);
  return schweizerHeute(d);
}

export type Laufstatus = "laeuft" | "naechste" | "vorbei" | "spaeter";

/**
 * Ordnet eine Sequenz relativ zu jetzt ein. `naechste` vergibt der Aufrufer,
 * weil dazu die ganze Liste nötig ist.
 */
export function laufstatus(
  sequenz: { startDatum: string | null; startZeit: string | null; endZeit: string | null },
  jetzt: SchweizerJetzt = schweizerJetzt()
): "laeuft" | "vorbei" | "spaeter" {
  const { startDatum, startZeit, endZeit } = sequenz;
  if (!startDatum) return "spaeter";

  if (startDatum < jetzt.datum) return "vorbei";
  if (startDatum > jetzt.datum) return "spaeter";

  // Gleicher Tag: ohne Zeiten gilt der ganze Tag als laufend.
  if (!startZeit || !endZeit) return "laeuft";
  if (jetzt.zeit < startZeit) return "spaeter";
  if (jetzt.zeit > endZeit) return "vorbei";
  return "laeuft";
}

/**
 * Findet die Sequenz, die gerade läuft, und die nächste danach.
 * Erwartet eine nach Datum und Startzeit sortierte Liste.
 */
export function findeAktuelle<
  T extends { id: string; startDatum: string | null; startZeit: string | null; endZeit: string | null },
>(sequenzen: T[], jetzt: SchweizerJetzt = schweizerJetzt()) {
  let laufend: T | null = null;
  let naechste: T | null = null;

  for (const s of sequenzen) {
    const status = laufstatus(s, jetzt);
    if (status === "laeuft" && !laufend) laufend = s;
    if (status === "spaeter" && !naechste) naechste = s;
  }

  return { laufend, naechste };
}
