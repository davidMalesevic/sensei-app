/**
 * Die strukturierten Daten einer Methode (`daten_json`).
 *
 * Zwölf der 62 Methoden liefern neben den Texten eine Datenstruktur, aus der
 * Sensei selbst zeichnet: ein Kreuzworträtsel-Gitter, eine Mindmap, Karten
 * zum Ausschneiden, ein Jeopardy-Brett. Die KI liefert **nur die Daten** —
 * so steht in der Bibliothek, und so ist es auch richtig: ein Gitter, das
 * ein Sprachmodell «zeichnet», ist keines.
 *
 * Geprüft wird hier von Hand gegen dieselben Formen wie in
 * `daten_json_schema`. Was nicht passt, wird verworfen statt halb
 * dargestellt: eine Karte ohne Begriff ist im Unterricht schlimmer als keine
 * Karte.
 */

export type Mindmap = { text: string; kinder: Mindmap[] };

export type Begriffsnetz = {
  begriffe: string[];
  relationen: { von: string; nach: string; beschriftung: string }[];
  fehlverbindungen: {
    von: string;
    nach: string;
    beschriftung: string;
    erklaerung: string;
  }[];
};

export type Aussage = { aussage: string; korrekt: boolean; begruendung: string };

export type QuizFrage = {
  frage: string;
  typ: string;
  antworten: string[];
  korrekt_indizes: number[];
  zeitlimit_sekunden: number;
  erklaerung: string;
};

export type TabuKarte = {
  begriff: string;
  verboten: string[];
  stufe: number;
  beispielerklaerung?: string;
};

export type MemoryPaar = {
  id: number;
  karte_a: string;
  karte_b: string;
  paartyp: string;
};

export type JeopardyFeld = {
  kategorie: string;
  punkte: number;
  hinweis: string;
  erwartete_frage: string;
  akzeptierte_varianten: string[];
};

export type RaetselWort = {
  loesungswort: string;
  anzeigewort: string;
  hinweis: string;
  schwierigkeit: number;
};

export type EscapeRoom = {
  rahmengeschichte: string;
  code: string;
  raetsel: {
    nr: number;
    titel: string;
    format: string;
    aufgabe: string;
    loesung: string;
    codezeichen: string;
    hinweise: string[];
  }[];
};

export type VortestAufgabe = {
  nr: number;
  voraussetzung: string;
  niveau: string;
  format: string;
  aufgabe: string;
  loesung: string;
  punkte: number;
};

export type MCFrage = {
  frage: string;
  antworten: { text: string; korrekt: boolean; fehlvorstellung: string }[];
};

export type EinstiegDaten =
  | { art: "mindmap"; daten: Mindmap }
  | { art: "begriffsnetz"; daten: Begriffsnetz }
  | { art: "aussagen"; daten: Aussage[] }
  | { art: "quiz"; daten: QuizFrage[] }
  | { art: "tabu"; daten: TabuKarte[] }
  | { art: "memory"; daten: MemoryPaar[] }
  | { art: "jeopardy"; daten: JeopardyFeld[] }
  | { art: "kreuzwortraetsel"; daten: RaetselWort[] }
  | { art: "escape_room"; daten: EscapeRoom }
  | { art: "advance_organizer"; daten: { mermaid: string } }
  | { art: "vortest"; daten: VortestAufgabe[] }
  | { art: "diagnostische_mc"; daten: MCFrage[] };

const texte = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((e) => typeof e === "string") : [];

const text = (x: unknown): string => (typeof x === "string" ? x.trim() : "");

const zahl = (x: unknown, ersatz = 0): number =>
  typeof x === "number" && Number.isFinite(x) ? x : ersatz;

function baum(x: unknown, tiefe = 0): Mindmap | null {
  if (tiefe > 4 || !x || typeof x !== "object") return null;
  const k = x as Partial<Mindmap>;
  const t = text(k.text);
  if (!t) return null;
  const kinder = Array.isArray(k.kinder)
    ? k.kinder.map((c) => baum(c, tiefe + 1)).filter((c): c is Mindmap => c !== null)
    : [];
  return { text: t, kinder };
}

/**
 * `daten_json` einer Methode auswerten. `schluessel` ist der Methodenschlüssel
 * — er bestimmt die erwartete Form, nicht die Antwort selbst.
 */
export function leseDaten(
  schluessel: string,
  rohText: string
): EinstiegDaten | null {
  if (!rohText || !rohText.trim()) return null;

  let roh: unknown;
  try {
    roh = JSON.parse(rohText);
  } catch {
    return null;
  }

  const liste = Array.isArray(roh) ? roh : [];
  const obj = (roh ?? {}) as Record<string, unknown>;

  switch (schluessel) {
    case "mindmap": {
      const m = baum(roh);
      return m ? { art: "mindmap", daten: m } : null;
    }

    case "concept_map": {
      const begriffe = texte(obj.begriffe);
      if (begriffe.length === 0) return null;
      const kanten = (x: unknown, mitErklaerung: boolean) =>
        (Array.isArray(x) ? x : [])
          .map((e) => {
            const k = e as Record<string, unknown>;
            return {
              von: text(k.von),
              nach: text(k.nach),
              beschriftung: text(k.beschriftung),
              erklaerung: text(k.erklaerung),
            };
          })
          .filter((k) => k.von && k.nach && (!mitErklaerung || k.erklaerung));
      return {
        art: "begriffsnetz",
        daten: {
          begriffe,
          relationen: kanten(obj.relationen, false),
          fehlverbindungen: kanten(obj.fehlverbindungen, true),
        },
      };
    }

    case "stimmt_stimmt_nicht": {
      const daten = liste
        .map((e) => {
          const a = e as Record<string, unknown>;
          return {
            aussage: text(a.aussage),
            korrekt: a.korrekt === true,
            begruendung: text(a.begruendung),
          };
        })
        .filter((a) => a.aussage);
      return daten.length > 0 ? { art: "aussagen", daten } : null;
    }

    case "quiz_digital": {
      const daten = liste
        .map((e) => {
          const f = e as Record<string, unknown>;
          return {
            frage: text(f.frage),
            typ: text(f.typ) || "multiple_choice",
            antworten: texte(f.antworten).slice(0, 4),
            korrekt_indizes: (Array.isArray(f.korrekt_indizes)
              ? f.korrekt_indizes
              : []
            )
              .map((i) => zahl(i, -1))
              .filter((i) => i >= 0 && i < 4),
            zeitlimit_sekunden: zahl(f.zeitlimit_sekunden, 30),
            erklaerung: text(f.erklaerung),
          };
        })
        .filter((f) => f.frage && f.antworten.length >= 2 && f.korrekt_indizes.length > 0);
      return daten.length > 0 ? { art: "quiz", daten } : null;
    }

    case "tabu": {
      const daten = liste
        .map((e) => {
          const k = e as Record<string, unknown>;
          return {
            begriff: text(k.begriff),
            verboten: texte(k.verboten).slice(0, 4),
            stufe: zahl(k.stufe, 1),
            beispielerklaerung: text(k.beispielerklaerung) || undefined,
          };
        })
        .filter((k) => k.begriff && k.verboten.length > 0);
      return daten.length > 0 ? { art: "tabu", daten } : null;
    }

    case "memory": {
      const daten = liste
        .map((e, i) => {
          const p = e as Record<string, unknown>;
          return {
            id: zahl(p.id, i + 1),
            karte_a: text(p.karte_a),
            karte_b: text(p.karte_b),
            paartyp: text(p.paartyp),
          };
        })
        .filter((p) => p.karte_a && p.karte_b);
      return daten.length > 0 ? { art: "memory", daten } : null;
    }

    case "jeopardy": {
      const daten = liste
        .map((e) => {
          const f = e as Record<string, unknown>;
          return {
            kategorie: text(f.kategorie),
            punkte: zahl(f.punkte, 100),
            hinweis: text(f.hinweis),
            erwartete_frage: text(f.erwartete_frage),
            akzeptierte_varianten: texte(f.akzeptierte_varianten),
          };
        })
        .filter((f) => f.kategorie && f.hinweis);
      return daten.length > 0 ? { art: "jeopardy", daten } : null;
    }

    case "kreuzwortraetsel": {
      const daten = liste
        .map((e) => {
          const w = e as Record<string, unknown>;
          // Umlaute und Leerzeichen kommen trotz Vorgabe vor. Das Gitter
          // kennt nur A–Z, also wird hier normalisiert statt abgelehnt.
          const roh = text(w.loesungswort).toUpperCase();
          const loesungswort = roh
            .replace(/Ä/g, "AE")
            .replace(/Ö/g, "OE")
            .replace(/Ü/g, "UE")
            .replace(/ß/g, "SS")
            .replace(/[^A-Z]/g, "");
          return {
            loesungswort,
            anzeigewort: text(w.anzeigewort) || roh,
            hinweis: text(w.hinweis),
            schwierigkeit: zahl(w.schwierigkeit, 1),
          };
        })
        .filter((w) => w.loesungswort.length >= 3 && w.hinweis);
      return daten.length > 0 ? { art: "kreuzwortraetsel", daten } : null;
    }

    case "escape_room": {
      const raetsel = (Array.isArray(obj.raetsel) ? obj.raetsel : [])
        .map((e, i) => {
          const r = e as Record<string, unknown>;
          return {
            nr: zahl(r.nr, i + 1),
            titel: text(r.titel),
            format: text(r.format),
            aufgabe: text(r.aufgabe),
            loesung: text(r.loesung),
            codezeichen: text(r.codezeichen).slice(0, 1),
            hinweise: texte(r.hinweise),
          };
        })
        .filter((r) => r.titel && r.aufgabe);
      if (raetsel.length === 0) return null;
      return {
        art: "escape_room",
        daten: {
          rahmengeschichte: text(obj.rahmengeschichte),
          code: text(obj.code),
          raetsel,
        },
      };
    }

    case "advance_organizer": {
      const mermaid = text(obj.mermaid);
      return mermaid ? { art: "advance_organizer", daten: { mermaid } } : null;
    }

    case "vortest": {
      const daten = liste
        .map((e, i) => {
          const a = e as Record<string, unknown>;
          return {
            nr: zahl(a.nr, i + 1),
            voraussetzung: text(a.voraussetzung),
            niveau: text(a.niveau),
            format: text(a.format),
            aufgabe: text(a.aufgabe),
            loesung: text(a.loesung),
            punkte: zahl(a.punkte, 1),
          };
        })
        .filter((a) => a.aufgabe);
      return daten.length > 0 ? { art: "vortest", daten } : null;
    }

    case "diagnostische_mc": {
      const daten = liste
        .map((e) => {
          const f = e as Record<string, unknown>;
          return {
            frage: text(f.frage),
            antworten: (Array.isArray(f.antworten) ? f.antworten : [])
              .map((a) => {
                const x = a as Record<string, unknown>;
                return {
                  text: text(x.text),
                  korrekt: x.korrekt === true,
                  fehlvorstellung: text(x.fehlvorstellung),
                };
              })
              .filter((a) => a.text),
          };
        })
        .filter((f) => f.frage && f.antworten.length >= 2);
      return daten.length > 0 ? { art: "diagnostische_mc", daten } : null;
    }

    default:
      return null;
  }
}

/** Wie die Grafik heisst, die aus diesen Daten entsteht. */
export const DATEN_LABEL: Record<EinstiegDaten["art"], string> = {
  mindmap: "Mindmap",
  begriffsnetz: "Begriffsnetz",
  aussagen: "Aussagenliste",
  quiz: "Quizfragen",
  tabu: "Tabu-Karten",
  memory: "Memory-Karten",
  jeopardy: "Jeopardy-Brett",
  kreuzwortraetsel: "Kreuzworträtsel",
  escape_room: "Rätselkette",
  advance_organizer: "Übersichtsdiagramm",
  vortest: "Vortest",
  diagnostische_mc: "Diagnostische Fragen",
};
