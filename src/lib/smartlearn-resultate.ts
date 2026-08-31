import { unzipSync, strFromU8 } from "fflate";

/**
 * Liest den Resultate-Export aus Smartlearn (`.xlsx`) — **ohne KI**.
 *
 * Wie beim Modulplan gilt: was aus der Datei gelesen werden kann, wird
 * gelesen. Eine Tabellenkalkulationsdatei ist ein ZIP mit XML darin; für das
 * bisschen, das wir brauchen (Zeichenkettentabelle und zwei Blätter), genügt
 * `fflate` plus etwas Textzerlegung. Eine vollwertige Excel-Bibliothek wäre
 * um Grössenordnungen mehr Abhängigkeit für weniger Kontrolle.
 *
 * ── Aufbau des Exports ────────────────────────────────────────────────────
 *
 * Blatt «Metadaten»  Modulnummer, Name, Durchführung, Export-Datum
 * Blatt «Resultate»  eine sehr breite Matrix:
 *
 *   Zeile 0   Spaltenschlüssel: `Abgabe_9_blocks.textInput.name`
 *   Zeile 1   LA-Code der Spalte: `LA_278_102_Marketingbegriffe`
 *   Zeile 2   das Wort «Aufgabe» (nur Beschriftung)
 *   Zeile 3   Aufgabennummer: `2`
 *   Zeile 4   Fragetext
 *   Zeile 5   Musterlösung
 *   Zeile 6+  je eine Person
 *
 * ── Zwei Fallen, die der Export stellt ────────────────────────────────────
 *
 * 1. **Lehrpersonen stehen zwischen den Lernenden.** Ihre Zeilen sind
 *    zellengleich mit der Musterlösung. Eine Duplikatsprüfung ohne Filter
 *    meldet sie als Erstes. Unterschieden wird an der Mailadresse
 *    (`@stud.…` = lernend).
 * 2. **Antwortfelder sind vorbefüllt.** Teilfragen stehen im Feld, die
 *    Lernenden schreiben dazwischen. Ohne Abzug dieses Sockels ähneln sich
 *    *alle* Abgaben stark — rein wegen des geteilten Textes. Die
 *    Musterlösungszeile liefert die Vorlage zum Abziehen, siehe
 *    `ohneVorlage()`.
 */

// ─── XLSX: nur so viel wie nötig ──────────────────────────────────────────

/** Eine Zeile als Spaltenbuchstabe → Text, z.B. `{ A: "Kelmendi", AG: "…" }`. */
type Zeile = Record<string, string>;

function entkoden(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

/** Alle `<t>`-Texte eines Fragments aneinanderhängen. */
function texte(xml: string): string {
  const teile = xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return teile
    .map((t) => entkoden(t.replace(/<t[^>]*>/, "").replace(/<\/t>/, "")))
    .join("");
}

function leseZeichenketten(xml: string): string[] {
  const items = xml.match(/<si>[\s\S]*?<\/si>/g) ?? [];
  return items.map(texte);
}

function leseBlatt(xml: string, ketten: string[]): Zeile[] {
  const zeilen: Zeile[] = [];

  for (const roh of xml.match(/<row[\s\S]*?<\/row>/g) ?? []) {
    const z: Zeile = {};

    for (const zelle of roh.match(/<c [^>]*\/>|<c [^>]*>[\s\S]*?<\/c>/g) ?? []) {
      const ref = /r="([A-Z]+)\d+"/.exec(zelle)?.[1];
      if (!ref) continue;

      const typ = /t="(\w+)"/.exec(zelle)?.[1];
      if (typ === "inlineStr") {
        z[ref] = texte(zelle);
        continue;
      }

      const wert = /<v>([\s\S]*?)<\/v>/.exec(zelle)?.[1];
      if (wert === undefined) continue;

      z[ref] = typ === "s" ? (ketten[Number(wert)] ?? "") : entkoden(wert);
    }

    zeilen.push(z);
  }

  return zeilen;
}

// ─── Auswertung ───────────────────────────────────────────────────────────

export type Aufgabenart = "textInput" | "multipleChoice" | "matrixChoice" | "fileUpload";

export type ResultatSpalte = {
  /** Spaltenbuchstabe im Blatt, z.B. `AG`. */
  spalte: string;
  /** LA-Code — verknüpft mit `modul_auftrag.code` im Modulbaum. */
  laCode: string | null;
  /** Aufgabennummer, wie sie im Export steht (`2`). */
  aufgabeNr: string | null;
  art: Aufgabenart;
  frage: string;
  musterloesung: string | null;
};

export type ResultatPerson = {
  nachname: string;
  vorname: string;
  email: string;
  /** Lehrpersonen stehen mit in der Liste — siehe Kopfkommentar. */
  istLehrperson: boolean;
  /** Spaltenbuchstabe → Abgabetext. */
  abgaben: Record<string, string>;
};

export type ResultatExport = {
  modulNummer: number | null;
  name: string | null;
  durchfuehrung: string | null;
  exportDatum: string | null;
  /** Klassenkürzel aus der Durchführung, z.B. `M278_EDB25B_Q1` → `EDB25B`. */
  klassenKuerzel: string | null;
  spalten: ResultatSpalte[];
  personen: ResultatPerson[];
};

const ART_AUS_SCHLUESSEL = /_blocks\.(\w+)\.name$/;

/** Spaltenbuchstaben in Tabellenreihenfolge: A … Z, AA, AB — nicht alphabetisch. */
function spaltenIndex(s: string): number {
  let n = 0;
  for (const c of s) n = n * 26 + (c.charCodeAt(0) - 64);
  return n;
}

function spaltenInReihenfolge(kopf: Zeile): string[] {
  return Object.keys(kopf).sort((a, b) => spaltenIndex(a) - spaltenIndex(b));
}

/**
 * Die Durchführung heisst `M<modul>_<klasse>_<quartal>`. Das mittlere Stück
 * ist das Klassenkürzel — mehr steckt nicht drin, und mehr braucht es nicht.
 */
function klasseAusDurchfuehrung(d: string | null): string | null {
  if (!d) return null;
  const teile = d.split("_");
  return teile.length >= 2 ? teile[1] : null;
}

/**
 * Zieht die vorbefüllte Vorlage von einer Abgabe ab.
 *
 * Steht im Feld ab Werk `«Warum ja? Warum nein?»`, taucht dieser Text bei
 * allen auf. Für Ähnlichkeitsvergleiche muss er weg, sonst ist jede Abgabe
 * jeder anderen ähnlich.
 */
export function ohneVorlage(abgabe: string, vorlage: string | null): string {
  if (!vorlage) return abgabe.trim();

  let rest = abgabe;
  for (const zeile of vorlage.split(/\r?\n/)) {
    const stueck = zeile.trim();
    if (stueck.length < 8) continue; // zu kurz, um Vorlage zu sein
    rest = rest.split(stueck).join(" ");
  }
  return rest.replace(/\s+/g, " ").trim();
}

export function parseResultateXlsx(daten: Uint8Array): ResultatExport {
  const dateien = unzipSync(daten);

  const hole = (pfad: string) =>
    dateien[pfad] ? strFromU8(dateien[pfad]) : null;

  const ketten = leseZeichenketten(hole("xl/sharedStrings.xml") ?? "");

  const metaXml = hole("xl/worksheets/sheet1.xml");
  const resXml = hole("xl/worksheets/sheet2.xml");
  if (!resXml) {
    throw new Error(
      "Kein Resultate-Blatt gefunden. Erwartet wird der Resultate-Export aus Smartlearn."
    );
  }

  // ─ Metadaten: schlicht Beschriftung in A, Wert in B ─
  const meta = new Map<string, string>();
  for (const z of leseBlatt(metaXml ?? "", ketten)) {
    if (z.A && z.B) meta.set(z.A.trim(), z.B.trim());
  }

  const durchfuehrung = meta.get("Durchführung") ?? null;
  const modulRoh = meta.get("Modul");
  const modulNummer = modulRoh && /^\d+$/.test(modulRoh) ? Number(modulRoh) : null;

  // ─ Resultate ─
  const zeilen = leseBlatt(resXml, ketten);
  if (zeilen.length < 7) {
    throw new Error("Das Resultate-Blatt hat zu wenige Zeilen für einen Export.");
  }

  const [kopf, laZeile, , nrZeile, frageZeile, musterZeile] = zeilen;
  const personenZeilen = zeilen.slice(6);

  // LA-Code und Aufgabennummer stehen **nicht auf jeder Abgabe-Spalte**,
  // sondern einmal je Aufgabengruppe — meist auf deren Punkte-Spalte. Ohne
  // Fortschreiben blieben alle Auswahlaufgaben (38 von 105 im Beispielexport)
  // ohne Bezug zum Modulbaum. Deshalb wird über *alle* Spalten in ihrer
  // Reihenfolge gelaufen und der zuletzt gesehene Wert weitergetragen.
  const spalten: ResultatSpalte[] = [];
  let letzterLa: string | null = null;
  let letzteNr: string | null = null;

  for (const spalte of spaltenInReihenfolge(kopf)) {
    const laHier = laZeile[spalte]?.trim();
    if (laHier) letzterLa = laHier;
    const nrHier = nrZeile[spalte]?.trim();
    if (nrHier) letzteNr = nrHier;

    const schluessel = kopf[spalte] ?? "";
    if (!schluessel.startsWith("Abgabe_")) continue;

    const art = ART_AUS_SCHLUESSEL.exec(schluessel)?.[1] as Aufgabenart | undefined;
    if (!art) continue;

    spalten.push({
      spalte,
      laCode: laZeile[spalte]?.trim() || letzterLa,
      aufgabeNr: nrZeile[spalte]?.trim() || letzteNr,
      art,
      frage: frageZeile[spalte]?.trim() ?? "",
      musterloesung: musterZeile[spalte]?.trim() || null,
    });
  }

  const personen: ResultatPerson[] = [];
  for (const z of personenZeilen) {
    const email = (z.C ?? "").trim().toLowerCase();
    if (!email) continue;

    const abgaben: Record<string, string> = {};
    for (const s of spalten) {
      const wert = (z[s.spalte] ?? "").trim();
      if (wert) abgaben[s.spalte] = wert;
    }

    personen.push({
      nachname: (z.A ?? "").trim(),
      vorname: (z.B ?? "").trim(),
      email,
      // Lernende haben eine `stud.`-Adresse; alles andere ist Lehrpersonal
      // oder ein Testkonto und gehört nicht in die Auswertung.
      istLehrperson: !email.includes("@stud."),
      abgaben,
    });
  }

  return {
    modulNummer,
    name: meta.get("Name") ?? null,
    durchfuehrung,
    exportDatum: meta.get("Export-Datum") ?? null,
    klassenKuerzel: klasseAusDurchfuehrung(durchfuehrung),
    spalten,
    personen,
  };
}
