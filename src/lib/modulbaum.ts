/**
 * Auflösung der Kette **KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben**.
 *
 * Das ist reine Rechnung auf den Daten aus dem Smartlearn-Export — keine KI.
 * Aufgabennummern und LA-Codes sind Fakten aus dem Material und dürfen nicht
 * erfunden werden; die Lehrperson muss der Klasse «macht Aufgabe 4.2» sagen
 * können.
 */

import { db } from "@/db";
import { modul, modulBlock, modularPlan } from "@/db/schema";
import { and, eq, inArray, lte } from "drizzle-orm";
import { materialHref } from "@/lib/material-link";

/** Minutenangabe samt ihrer Herkunft — `null` heisst «keine Angabe». */
export type StoffDauer = {
  minuten: number | null;
  quelle: "ki" | "person" | null;
};

export type StoffAufgabe = {
  bezeichnung: string;
  text: string | null;
  teilaufgaben: { bezeichnung: string; text: string | null }[];
  dauer: StoffDauer;
};

export type StoffAuftrag = {
  code: string;
  aufgabenstellung: string | null;
  guetekriterien: string | null;
  aufgaben: StoffAufgabe[];
  /** Nur relevant, wenn `aufgaben` leer ist — dann ist der LA die Einheit. */
  dauer: StoffDauer;
};

export type StoffBlock = {
  schluessel: string;
  titel: string;
  auftraege: StoffAuftrag[];
  slides: {
    titel: string;
    von: number | null;
    bis: number | null;
    /** Deep-Link auf die Datei, bei PDFs direkt auf die Startseite. */
    href: string | null;
    dauer: StoffDauer;
  } | null;
};

export type Wochenstoff = {
  kw: number;
  ziel: string | null;
  lbHinweis: string | null;
  bloecke: StoffBlock[];
  /** true, wenn für diese KW kein Modulplan-Eintrag existiert. */
  ohneModulplan: boolean;
};

/**
 * Was in dieser Kalenderwoche in diesem Modul ansteht.
 *
 * Nennt der Modulplan LA-Codes, wird auf diese eingegrenzt — sonst gilt der
 * ganze Block. Eine Woche kann zwei Blöcke berühren («Block 01 und Block 02»).
 */
/**
 * Auf den identifizierenden Teil eines LA-Codes kürzen: `LA_278_203`.
 * Die Bezeichnung dahinter ist nicht verlässlich — sie wird je nach Export
 * unterschiedlich abgeschnitten.
 */
export function normalisiereLaCode(code: string): string {
  // Segmente statt Ziffernmuster. Die alte Regel `LA[_-]?\d+[_-]?\d+` fiel bei
  // Modul 219 auf die Nase: `LA_219_Block01_…` und `LA_219_Block02_…` lieferten
  // beide `la_219`, weil sie die Ziffern von «219» aufteilte. Fünf verschiedene
  // Lern- und Arbeitsaufträge trugen damit denselben Schlüssel — der Wochen-
  // filter griff auf das ganze Modul, und im Übertrag hätte ein Häkchen fünf
  // Aufgaben zugleich erledigt.
  const teile = code.trim().split(/[_-]/);
  if (!/^LA$/i.test(teile[0] ?? "")) return code.trim().toLowerCase().replace(/[_-]/g, "_");

  // `LA` plus Modulkennung sind immer identifizierend.
  const behalten = teile.slice(0, 2);

  // Das dritte Segment nur, wenn es eine **Kennung** ist und keine Bezeichnung:
  // `203`, `1000`, `Block01` ja — `Markt`, `IT` nein. Genau hier sitzt der
  // Unterschied zwischen `LA_278_203_Markt-` (abgeschnitten) und
  // `LA_278_203_Branchen, Markt- und Konkurrenzanalyse` (vollständig): beide
  // müssen `la_278_203` ergeben, sonst fällt der Auftrag aus der Woche.
  const drittes = teile[2];
  if (drittes && /^[A-Za-z]*\d+$/.test(drittes)) behalten.push(drittes);

  return behalten.join("_").toLowerCase();
}

/** Trennzeichen der Erledigt-Marke. Steht so in `sequenz.uebertragErledigt`. */
const MARKE_TRENNER = " · ";

/**
 * Die Marke, unter der eine Aufgabe im Übertrag abgehakt wird.
 *
 * Sie trägt bewusst die **Original-Bezeichnung** — die Lehrperson muss der
 * Klasse «macht Aufgabe 4.2» sagen können, und genau diese Zeichenkette steht
 * hinterher in der Datenbank und in der Oberfläche.
 */
export function erledigtMarke(code: string, bezeichnung: string): string {
  return `${code}${MARKE_TRENNER}${bezeichnung}`;
}

/**
 * Der Vergleichsschlüssel zu einer Marke.
 *
 * Marken werden über Wochen hinweg verglichen, und dazwischen kann der
 * Modulplan neu importiert worden sein. Die LA-Codes sind je nach Export
 * anders abgeschnitten (`LA_278_203_Markt-` gegen
 * `LA_278_203_Branchen, Markt- und Konkurrenzanalyse`), ein roher
 * Stringvergleich verliert die Aufgabe also beim nächsten Import — der
 * Rückstand wäre plötzlich wieder da. Verglichen wird deshalb nur der
 * identifizierende Teil des Codes, wie überall sonst auch.
 */
export function markeSchluessel(marke: string): string {
  const i = marke.indexOf(MARKE_TRENNER);
  if (i === -1) return normalisiereLaCode(marke);
  const code = marke.slice(0, i);
  const bezeichnung = marke.slice(i + MARKE_TRENNER.length);
  return `${normalisiereLaCode(code)}${MARKE_TRENNER}${bezeichnung.trim().toLowerCase()}`;
}

/** Menge von Marken als Vergleichsmenge — immer über diesen Weg. */
export function markenMenge(marken: readonly string[]): Set<string> {
  return new Set(marken.map(markeSchluessel));
}

/** Gehört das Modul diesem Konto? */
async function eigenesModul(benutzerId: string, modulId: string) {
  // Der Besitzer steht bewusst als Pflichtparameter da, obwohl alle heutigen
  // Aufrufer den Modulbezug aus einer bereits geprüften Sequenz nehmen: sonst
  // hinge die Absicherung an der Disziplin künftiger Aufrufer.
  return db.query.modul.findFirst({
    where: and(eq(modul.id, modulId), eq(modul.benutzerId, benutzerId)),
    columns: { id: true },
  });
}

/** Der Aufgabenbaum eines Moduls, wie ihn die Auflösung braucht. */
function ladeBloecke(modulId: string) {
  return db.query.modulBlock.findMany({
    where: eq(modulBlock.modulId, modulId),
    orderBy: (b, { asc }) => [asc(b.nummer), asc(b.schluessel)],
    with: {
      slideMaterial: {
        columns: { id: true, titel: true, dateiPfad: true, url: true },
      },
      auftraege: {
        orderBy: (a, { asc }) => [asc(a.sortierung)],
        with: { aufgaben: { orderBy: (a, { asc }) => [asc(a.sortierung)] } },
      },
    },
  });
}

type GeladeneBloecke = Awaited<ReturnType<typeof ladeBloecke>>;
type PlanZeile = typeof modularPlan.$inferSelect;

/** Eine Modulplan-Zeile gegen den Aufgabenbaum auflösen. Reine Rechnung. */
function baueWochenstoff(
  woche: PlanZeile,
  alleBloecke: GeladeneBloecke
): Wochenstoff {
  const schluessel = woche.bloecke ?? [];
  if (schluessel.length === 0) {
    return {
      kw: woche.kw,
      ziel: woche.ziel,
      lbHinweis: woche.lbHinweis,
      bloecke: [],
      ohneModulplan: false,
    };
  }

  // Die LA-Codes im Modulplan sind beim Import oft abgeschnitten: der
  // Arbeitsplan schreibt «LA_278_203_Markt-», der Aufgabenbaum
  // «LA_278_203_Branchen, Markt- und Konkurrenzanalyse». Ein exakter
  // Vergleich liess solche Aufträge stillschweigend aus der Woche fallen —
  // im Extremfall blieb kein einziger Fakt übrig und der Entwurf bestand nur
  // noch aus KI-Vorschlägen.
  //
  // Verglichen wird deshalb nur der identifizierende Teil `LA_<modul>_<nr>`;
  // der Rest ist eine menschenlesbare Bezeichnung, die je nach Export anders
  // abgeschnitten ist. Gleiche Sorte Problem wie `normalisiereBlock()`.
  const laFilter = new Set((woche.laCodes ?? []).map(normalisiereLaCode));

  const bloecke: StoffBlock[] = alleBloecke
    .filter((b) => schluessel.includes(b.schluessel))
    .map((b) => {
      const relevant = laFilter.size
        ? b.auftraege.filter((a) => laFilter.has(normalisiereLaCode(a.code)))
        : b.auftraege;

      return {
        schluessel: b.schluessel,
        titel: b.titel,
        slides: b.slideMaterial
          ? {
              titel: b.slideMaterial.titel,
              von: b.slideVon,
              bis: b.slideBis,
              href: materialHref(
                b.slideMaterial,
                b.slideVon !== null ? `Slide ${b.slideVon}` : null
              ),
              dauer: { minuten: b.dauerMinuten, quelle: b.dauerQuelle },
            }
          : null,
        auftraege: (relevant.length > 0 ? relevant : b.auftraege).map((a) => {
          const oben = a.aufgaben.filter((x) => !x.parentId);
          return {
            code: a.code,
            aufgabenstellung: a.aufgabenstellung,
            guetekriterien: a.guetekriterien,
            dauer: { minuten: a.dauerMinuten, quelle: a.dauerQuelle },
            aufgaben: oben.map((x) => ({
              bezeichnung: x.bezeichnung,
              text: x.text,
              dauer: { minuten: x.dauerMinuten, quelle: x.dauerQuelle },
              teilaufgaben: a.aufgaben
                .filter((t) => t.parentId === x.id)
                .map((t) => ({ bezeichnung: t.bezeichnung, text: t.text })),
            })),
          };
        }),
      };
    });

  return {
    kw: woche.kw,
    ziel: woche.ziel,
    lbHinweis: woche.lbHinweis,
    bloecke,
    ohneModulplan: false,
  };
}

/**
 * Mehrere Kalenderwochen auf einmal auflösen.
 *
 * Der Rückstand braucht jede Vorwoche des Moduls. Einzeln geholt wäre das pro
 * Woche eine Abfrage plus ein kompletter Aufgabenbaum — bei zehn Wochen also
 * zwanzig Abfragen für dieselben Daten. Baum und Plan werden deshalb einmal
 * geladen und in der Rechnung geteilt.
 */
export async function getWochenstoffMehrere(
  benutzerId: string,
  modulId: string,
  kws: number[]
): Promise<Map<number, Wochenstoff>> {
  const gefragt = kws.filter((k) => Number.isFinite(k));
  const ergebnis = new Map<number, Wochenstoff>();
  if (!modulId || gefragt.length === 0) return ergebnis;
  if (!(await eigenesModul(benutzerId, modulId))) return ergebnis;

  const wochen = await db
    .select()
    .from(modularPlan)
    .where(
      and(eq(modularPlan.modulId, modulId), inArray(modularPlan.kw, gefragt))
    );

  if (wochen.length === 0) return ergebnis;

  const alleBloecke = await ladeBloecke(modulId);
  for (const w of wochen) ergebnis.set(w.kw, baueWochenstoff(w, alleBloecke));
  return ergebnis;
}

export async function getWochenstoff(
  benutzerId: string,
  modulId: string,
  kw: number
): Promise<Wochenstoff | null> {
  if (!modulId || !Number.isFinite(kw)) return null;
  if (!(await eigenesModul(benutzerId, modulId))) return null;

  const [woche] = await db
    .select()
    .from(modularPlan)
    .where(and(eq(modularPlan.modulId, modulId), eq(modularPlan.kw, kw)))
    .limit(1);

  if (!woche) {
    return { kw, ziel: null, lbHinweis: null, bloecke: [], ohneModulplan: true };
  }

  const schluessel = woche.bloecke ?? [];
  if (schluessel.length === 0) return baueWochenstoff(woche, []);

  return baueWochenstoff(woche, await ladeBloecke(modulId));
}

/**
 * Die Kalenderwochen, für die dieses Modul überhaupt einen Plan hat, bis
 * einschliesslich `bisKw`. Basis für die Suche nach Rückstand.
 */
export async function getGeplanteKws(
  benutzerId: string,
  modulId: string,
  bisKw: number
): Promise<number[]> {
  if (!modulId || !Number.isFinite(bisKw)) return [];
  if (!(await eigenesModul(benutzerId, modulId))) return [];

  const zeilen = await db
    .select({ kw: modularPlan.kw })
    .from(modularPlan)
    .where(and(eq(modularPlan.modulId, modulId), lte(modularPlan.kw, bisKw)))
    .orderBy(modularPlan.kw);

  return zeilen.map((z) => z.kw);
}

/** Alle Aufgabenmarken eines Wochenstoffs, in Lesereihenfolge. */
export function markenAusStoff(stoff: Wochenstoff): string[] {
  const marken: string[] = [];
  for (const b of stoff.bloecke) {
    for (const a of b.auftraege) {
      // Module ohne nummerierte Aufgaben (z.B. 168): dort ist der LA selbst
      // die Einheit, die abgehakt wird — sonst hätte die Woche keine Marke.
      if (a.aufgaben.length === 0) {
        marken.push(a.code);
        continue;
      }
      for (const auf of a.aufgaben) marken.push(erledigtMarke(a.code, auf.bezeichnung));
    }
  }
  return marken;
}

/**
 * Einen Wochenstoff um das kürzen, was laut Übertrag erledigt ist.
 *
 * `erledigt` enthält **Vergleichsschlüssel** (`markeSchluessel`), nicht rohe
 * Marken — ein roher Stringvergleich überlebt keinen Modulplan-Reimport.
 *
 * `ohneLeereBloecke` ist für den Rückstand gedacht: dort soll ein Block
 * verschwinden, aus dem nichts mehr aussteht. Für die laufende Woche bleibt er
 * stehen, weil ihr Wochenziel und ihre Slides auch dann etwas aussagen, wenn
 * alle Aufgaben schon gemacht sind.
 */
export function kuerzeStoff(
  stoff: Wochenstoff,
  erledigt: ReadonlySet<string>,
  ohneLeereBloecke = false
): Wochenstoff {
  const bloecke = stoff.bloecke
    .map((b) => ({
      ...b,
      auftraege: b.auftraege
        .map((a) => {
          // Modul ohne nummerierte Aufgaben: der LA selbst wird abgehakt.
          if (a.aufgaben.length === 0) {
            return erledigt.has(markeSchluessel(a.code)) ? null : a;
          }
          const offen = a.aufgaben.filter(
            (auf) => !erledigt.has(markeSchluessel(erledigtMarke(a.code, auf.bezeichnung)))
          );
          return offen.length > 0 ? { ...a, aufgaben: offen } : null;
        })
        .filter((a): a is StoffAuftrag => a !== null),
    }))
    .filter((b) => !ohneLeereBloecke || b.auftraege.length > 0);

  return { ...stoff, bloecke };
}

/** Wie viele planbare Einheiten dieser Stoff enthält (LA-weise bei 168). */
export function zaehleAufgaben(stoff: Wochenstoff): number {
  return stoff.bloecke.reduce(
    (n, b) =>
      n +
      b.auftraege.reduce(
        (m, a) => m + (a.aufgaben.length === 0 ? 1 : a.aufgaben.length),
        0
      ),
    0
  );
}
