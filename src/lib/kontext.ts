import { db } from "@/db";
import { modularPlan, pendenz, sequenz } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getKW, getKWFromDateString } from "@/lib/kw";

export type SequenzKontext = {
  kw: number;
  kwQuelle: "sequenz" | "block" | "heute";
  modulLabel: string | null;
  /** Wochenziel des Modulplans für die aktuelle KW. */
  aktuellesZiel: { kw: number; ziel: string; beschreibung: string | null } | null;
  /** Nächstes geplantes Wochenziel, falls für die aktuelle KW keines existiert. */
  naechstesZiel: { kw: number; ziel: string; beschreibung: string | null } | null;
  vorherigeNotiz: { titel: string; notiz: string } | null;
  pendenzen: { id: string; text: string }[];
};

/**
 * Aggregiert den Planungskontext einer Sequenz: Wochenziel aus dem Modulplan,
 * Übergabenotiz der vorangehenden Sequenz und offene Pendenzen der Klasse.
 * Wird vom ContextHeader auf der Sequenz-Detailseite genutzt.
 */
export async function getSequenzKontext(
  sequenzId: string
): Promise<SequenzKontext | null> {
  const seq = await db.query.sequenz.findFirst({
    where: eq(sequenz.id, sequenzId),
    with: {
      modul: { columns: { id: true, nummer: true, bezeichnung: true } },
      lektionsbloecke: {
        columns: { datum: true },
        orderBy: (lb, { asc: a }) => [a(lb.sortierung)],
      },
    },
  });

  if (!seq) return null;

  // Referenz-KW: Sequenzstart, sonst erstes Blockdatum, sonst heute
  const ersterBlockDatum =
    seq.lektionsbloecke.find((lb) => lb.datum)?.datum ?? null;

  let kw = getKWFromDateString(seq.startDatum);
  let kwQuelle: SequenzKontext["kwQuelle"] = "sequenz";

  if (kw === null) {
    kw = getKWFromDateString(ersterBlockDatum);
    kwQuelle = "block";
  }
  if (kw === null) {
    kw = getKW(new Date());
    kwQuelle = "heute";
  }

  // Wochenziel aus dem Modulplan
  let aktuellesZiel: SequenzKontext["aktuellesZiel"] = null;
  let naechstesZiel: SequenzKontext["naechstesZiel"] = null;

  if (seq.modul) {
    const eintraege = await db
      .select({
        kw: modularPlan.kw,
        ziel: modularPlan.ziel,
        beschreibung: modularPlan.beschreibung,
      })
      .from(modularPlan)
      .where(eq(modularPlan.modulId, seq.modul.id))
      .orderBy(asc(modularPlan.kw));

    aktuellesZiel = eintraege.find((e) => e.kw === kw) ?? null;
    if (!aktuellesZiel) {
      naechstesZiel = eintraege.find((e) => e.kw > kw!) ?? null;
    }
  }

  // Übergabenotiz der vorherigen Sequenz (gleiche Klasse + Modul)
  let vorherigeNotiz: SequenzKontext["vorherigeNotiz"] = null;
  if (seq.modulId) {
    const vorherige = await db.query.sequenz.findFirst({
      where: (s, { and: a, eq: e, ne }) =>
        a(
          e(s.klasseId, seq.klasseId),
          e(s.modulId, seq.modulId!),
          ne(s.id, sequenzId)
        ),
      orderBy: (s, { desc: d }) => [d(s.createdAt)],
      columns: { uebergabenotiz: true, titel: true },
    });
    if (vorherige?.uebergabenotiz) {
      vorherigeNotiz = {
        titel: vorherige.titel,
        notiz: vorherige.uebergabenotiz,
      };
    }
  }

  // Offene Pendenzen der Klasse
  const pendenzen = await db
    .select({ id: pendenz.id, text: pendenz.text })
    .from(pendenz)
    .where(and(eq(pendenz.klasseId, seq.klasseId), eq(pendenz.erledigt, false)));

  return {
    kw,
    kwQuelle,
    modulLabel: seq.modul
      ? `Modul ${seq.modul.nummer}${seq.modul.bezeichnung ? ` – ${seq.modul.bezeichnung}` : ""}`
      : null,
    aktuellesZiel,
    naechstesZiel,
    vorherigeNotiz,
    pendenzen,
  };
}
