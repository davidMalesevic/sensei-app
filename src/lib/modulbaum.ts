/**
 * Auflösung der Kette **KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben**.
 *
 * Das ist reine Rechnung auf den Daten aus dem Smartlearn-Export — keine KI.
 * Aufgabennummern und LA-Codes sind Fakten aus dem Material und dürfen nicht
 * erfunden werden; die Lehrperson muss der Klasse «macht Aufgabe 4.2» sagen
 * können.
 */

import { db } from "@/db";
import { modulBlock, modularPlan } from "@/db/schema";
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
  nummer: number;
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
export async function getWochenstoff(
  modulId: string,
  kw: number
): Promise<Wochenstoff | null> {
  if (!modulId || !Number.isFinite(kw)) return null;

  const [woche] = await db
    .select()
    .from(modularPlan)
    .where(and(eq(modularPlan.modulId, modulId), eq(modularPlan.kw, kw)))
    .limit(1);

  if (!woche) {
    return { kw, ziel: null, lbHinweis: null, bloecke: [], ohneModulplan: true };
  }

  const nummern = woche.bloecke ?? [];
  if (nummern.length === 0) {
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
    orderBy: (b, { asc }) => [asc(b.nummer)],
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

  const laFilter = new Set(woche.laCodes ?? []);

  const bloecke: StoffBlock[] = alleBloecke
    .filter((b) => nummern.includes(b.nummer))
    .map((b) => {
      const relevant = laFilter.size
        ? b.auftraege.filter((a) => laFilter.has(a.code))
        : b.auftraege;

      return {
        nummer: b.nummer,
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
