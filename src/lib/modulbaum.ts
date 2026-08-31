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
import { and, eq } from "drizzle-orm";
import { materialHref } from "@/lib/material-link";

export type StoffAufgabe = {
  bezeichnung: string;
  text: string | null;
  teilaufgaben: { bezeichnung: string; text: string | null }[];
};

export type StoffAuftrag = {
  code: string;
  aufgabenstellung: string | null;
  guetekriterien: string | null;
  aufgaben: StoffAufgabe[];
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
  const m = /^(LA[_-]?\d+[_-]?\d+)/i.exec(code.trim());
  return (m ? m[1] : code.trim()).toLowerCase().replace(/[_-]/g, "_");
}

export async function getWochenstoff(
  benutzerId: string,
  modulId: string,
  kw: number
): Promise<Wochenstoff | null> {
  if (!modulId || !Number.isFinite(kw)) return null;

  // Der Besitzer steht bewusst als Pflichtparameter da, obwohl alle heutigen
  // Aufrufer den Modulbezug aus einer bereits geprüften Sequenz nehmen: sonst
  // hinge die Absicherung an der Disziplin künftiger Aufrufer.
  const eigenes = await db.query.modul.findFirst({
    where: and(eq(modul.id, modulId), eq(modul.benutzerId, benutzerId)),
    columns: { id: true },
  });
  if (!eigenes) return null;

  const [woche] = await db
    .select()
    .from(modularPlan)
    .where(and(eq(modularPlan.modulId, modulId), eq(modularPlan.kw, kw)))
    .limit(1);

  if (!woche) {
    return { kw, ziel: null, lbHinweis: null, bloecke: [], ohneModulplan: true };
  }

  const schluessel = woche.bloecke ?? [];
  if (schluessel.length === 0) {
    return {
      kw,
      ziel: woche.ziel,
      lbHinweis: woche.lbHinweis,
      bloecke: [],
      ohneModulplan: false,
    };
  }

  const alleBloecke = await db.query.modulBlock.findMany({
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
            }
          : null,
        auftraege: (relevant.length > 0 ? relevant : b.auftraege).map((a) => {
          const oben = a.aufgaben.filter((x) => !x.parentId);
          return {
            code: a.code,
            aufgabenstellung: a.aufgabenstellung,
            guetekriterien: a.guetekriterien,
            aufgaben: oben.map((x) => ({
              bezeichnung: x.bezeichnung,
              text: x.text,
              teilaufgaben: a.aufgaben
                .filter((t) => t.parentId === x.id)
                .map((t) => ({ bezeichnung: t.bezeichnung, text: t.text })),
            })),
          };
        }),
      };
    });

  return {
    kw,
    ziel: woche.ziel,
    lbHinweis: woche.lbHinweis,
    bloecke,
    ohneModulplan: false,
  };
}
