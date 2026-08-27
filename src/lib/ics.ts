/**
 * Parser für WebUntis-Kalenderexporte (.ics).
 *
 * Aus dem Export lassen sich alle Stammdaten einer Sequenz ableiten, die heute
 * von Hand eingetippt werden: Klasse, Modul, Datum, Zeit, Lektionenzahl, Raum.
 * Siehe `erstellungsprozess.md`, Abschnitt 4.1.
 *
 * Zwei Eigenheiten des Exports:
 *
 * 1. Pausen zerschneiden Unterrichtsblöcke in mehrere VEVENTs (09:20–09:35 und
 *    15:15–15:30). Sie werden wieder zusammengefügt: gleicher Kurs + gleicher
 *    Tag + Lücke <= 20 min.
 * 2. Die UID hat die Form `<kurs>-<lektion>-<lektion>-…`. Der Präfix ist über
 *    alle Termine eines Kurses stabil, die Zahl der Segmente entspricht exakt
 *    der Lektionenzahl (verifiziert: 1 Segment = 45 min, ohne Abweichung).
 */

const MERGE_LUECKE_MINUTEN = 20;

export type IcsTermin = {
  /** UID-Präfix — stabil über alle Termine desselben Kurses */
  kursSchluessel: string;
  /** Rohes Klassenkürzel aus dem SUMMARY, z.B. "BM1WEDB24z; EDB24z" */
  klassenKuerzel: string;
  modulNummer: number | null;
  modulBezeichnung: string | null;
  /** YYYY-MM-DD */
  datum: string;
  /** HH:MM */
  startZeit: string;
  endZeit: string;
  lektionen: number;
  raum: string | null;
};

/** Zeilen entfalten: RFC 5545 bricht lange Zeilen mit führendem Space/Tab um. */
function entfalten(inhalt: string): string[] {
  return inhalt
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

/** ICS-Escaping rückgängig machen: \, \; \\ \n */
function entkommen(wert: string): string {
  return wert
    .replace(/\\n/gi, " ")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

/** `DTSTART;TZID=Europe/Zurich:20260821T083500` → lokale Zeitkomponenten */
function parseZeitpunkt(wert: string): Date | null {
  const m = wert.match(/(\d{8})T(\d{6})(Z?)/);
  if (!m) return null;
  const [, d, t, utc] = m;
  const jahr = +d.slice(0, 4);
  const monat = +d.slice(4, 6) - 1;
  const tag = +d.slice(6, 8);
  const std = +t.slice(0, 2);
  const min = +t.slice(2, 4);
  const sek = +t.slice(4, 6);

  if (!utc) {
    // TZID-Form: bereits lokale Schulzeit, unverändert übernehmen.
    return new Date(jahr, monat, tag, std, min, sek);
  }
  // Z-Form: nach Europe/Zurich umrechnen.
  const echt = new Date(Date.UTC(jahr, monat, tag, std, min, sek));
  const teile = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(echt);
  const [datumTeil, zeitTeil] = teile.split(" ");
  const [j, mo, ta] = datumTeil.split("-").map(Number);
  const [h, mi, s] = zeitTeil.split(":").map(Number);
  return new Date(j, mo - 1, ta, h, mi, s);
}

/**
 * `EDB24a 168 Geschäftsprozesse mit ICT Mitteln unterstützen (168)`
 * → Klasse, Modulnummer, Modulbezeichnung
 *
 * Die Modulnummer steht doppelt im Titel; die Klammer am Ende ist der
 * zuverlässige Anker.
 */
function parseSummary(summary: string): {
  klassenKuerzel: string;
  modulNummer: number | null;
  modulBezeichnung: string | null;
} {
  const voll = summary.match(/^(.*?)\s+(\d{2,4})\s+(.*?)\s*\((\d{2,4})\)\s*$/);
  if (voll && voll[2] === voll[4]) {
    return {
      klassenKuerzel: voll[1].trim(),
      modulNummer: Number(voll[4]),
      modulBezeichnung: voll[3].trim(),
    };
  }

  // Fallback: nur die Klammer am Ende auswerten.
  const klammer = summary.match(/^(.*?)\s*\((\d{2,4})\)\s*$/);
  if (klammer) {
    const rest = klammer[1].trim();
    const abgetrennt = rest.match(/^(.*?)\s+(\d{2,4})\s+(.*)$/);
    return {
      klassenKuerzel: (abgetrennt ? abgetrennt[1] : rest).trim(),
      modulNummer: Number(klammer[2]),
      modulBezeichnung: abgetrennt ? abgetrennt[3].trim() : null,
    };
  }

  return { klassenKuerzel: summary.trim(), modulNummer: null, modulBezeichnung: null };
}

function alsDatum(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function alsZeit(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

type RohTermin = {
  kursSchluessel: string;
  lektionen: number;
  summary: string;
  raum: string | null;
  start: Date;
  ende: Date;
};

function parseEvents(inhalt: string): RohTermin[] {
  const zeilen = entfalten(inhalt);
  const termine: RohTermin[] = [];

  let aktuell: Record<string, string> | null = null;
  for (const zeile of zeilen) {
    if (zeile.startsWith("BEGIN:VEVENT")) {
      aktuell = {};
      continue;
    }
    if (zeile.startsWith("END:VEVENT")) {
      if (aktuell) {
        const termin = ausEvent(aktuell);
        if (termin) termine.push(termin);
      }
      aktuell = null;
      continue;
    }
    if (!aktuell) continue;

    const trenner = zeile.indexOf(":");
    if (trenner === -1) continue;
    const schluessel = zeile.slice(0, trenner).split(";")[0].toUpperCase();
    aktuell[schluessel] = zeile.slice(trenner + 1);
  }

  return termine;
}

function ausEvent(felder: Record<string, string>): RohTermin | null {
  if (felder.STATUS?.toUpperCase() === "CANCELLED") return null;

  const uid = felder.UID?.trim();
  const start = felder.DTSTART ? parseZeitpunkt(felder.DTSTART) : null;
  const ende = felder.DTEND ? parseZeitpunkt(felder.DTEND) : null;
  if (!uid || !start || !ende) return null;

  const segmente = uid.split("-");
  const raum = felder.LOCATION ? entkommen(felder.LOCATION) : null;

  return {
    kursSchluessel: segmente[0],
    lektionen: Math.max(1, segmente.length - 1),
    summary: entkommen(felder.SUMMARY ?? ""),
    raum: raum || null,
    start,
    ende,
  };
}

/**
 * Termine desselben Kurses am selben Tag zusammenfügen, wenn sie nur durch eine
 * Pause getrennt sind.
 */
function zusammenfuegen(roh: RohTermin[]): RohTermin[] {
  const sortiert = [...roh].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() ||
      a.kursSchluessel.localeCompare(b.kursSchluessel)
  );

  const zusammen: RohTermin[] = [];
  for (const termin of sortiert) {
    const vorher = zusammen[zusammen.length - 1];
    const luecke = vorher
      ? (termin.start.getTime() - vorher.ende.getTime()) / 60000
      : Infinity;

    if (
      vorher &&
      vorher.kursSchluessel === termin.kursSchluessel &&
      alsDatum(vorher.ende) === alsDatum(termin.start) &&
      luecke >= 0 &&
      luecke <= MERGE_LUECKE_MINUTEN
    ) {
      vorher.ende = termin.ende;
      vorher.lektionen += termin.lektionen;
      continue;
    }

    zusammen.push({ ...termin });
  }

  return zusammen;
}

export function parseIcs(inhalt: string): IcsTermin[] {
  return zusammenfuegen(parseEvents(inhalt)).map((t) => {
    const { klassenKuerzel, modulNummer, modulBezeichnung } = parseSummary(t.summary);
    return {
      kursSchluessel: t.kursSchluessel,
      klassenKuerzel,
      modulNummer,
      modulBezeichnung,
      datum: alsDatum(t.start),
      startZeit: alsZeit(t.start),
      endZeit: alsZeit(t.ende),
      lektionen: t.lektionen,
      raum: t.raum,
    };
  });
}

/** Übersicht für den Zuordnungsschritt beim Import. */
export type IcsUebersicht = {
  termine: IcsTermin[];
  klassenKuerzel: { kuerzel: string; anzahl: number }[];
  module: { nummer: number; bezeichnung: string | null; anzahl: number }[];
  vonDatum: string | null;
  bisDatum: string | null;
  ohneModul: number;
};

export function fasseZusammen(termine: IcsTermin[]): IcsUebersicht {
  const klassen = new Map<string, number>();
  const module = new Map<number, { bezeichnung: string | null; anzahl: number }>();

  for (const t of termine) {
    klassen.set(t.klassenKuerzel, (klassen.get(t.klassenKuerzel) ?? 0) + 1);
    if (t.modulNummer !== null) {
      const vorhanden = module.get(t.modulNummer);
      module.set(t.modulNummer, {
        bezeichnung: vorhanden?.bezeichnung ?? t.modulBezeichnung,
        anzahl: (vorhanden?.anzahl ?? 0) + 1,
      });
    }
  }

  const daten = termine.map((t) => t.datum).sort();

  return {
    termine,
    klassenKuerzel: [...klassen.entries()]
      .map(([kuerzel, anzahl]) => ({ kuerzel, anzahl }))
      .sort((a, b) => b.anzahl - a.anzahl),
    module: [...module.entries()]
      .map(([nummer, m]) => ({ nummer, ...m }))
      .sort((a, b) => a.nummer - b.nummer),
    vonDatum: daten[0] ?? null,
    bisDatum: daten[daten.length - 1] ?? null,
    ohneModul: termine.filter((t) => t.modulNummer === null).length,
  };
}
