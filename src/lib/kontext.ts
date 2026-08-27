import { db } from "@/db";
import { kalenderEintrag, modularPlan, pendenz, sequenz } from "@/db/schema";
import { and, asc, eq, gte } from "drizzle-orm";
import { getKW, getKWFromDateString } from "@/lib/kw";
import { schweizerHeute } from "@/lib/zeit";

export type ModulplanZiel = {
  kw: number;
  ziel: string;
  beschreibung: string | null;
  lbHinweis: string | null;
};

export type Pruefung = {
  quelle: "kalender" | "modulplan";
  bezeichnung: string;
  /** Datum (Kalender) bzw. KW-Angabe (Modulplan). */
  wann: string;
  /** Sortierschlüssel: KW der Prüfung. */
  kw: number;
};

export type SequenzKontext = {
  kw: number;
  kwQuelle: "sequenz" | "block" | "heute";
  modulLabel: string | null;
  /** Wochenziel des Modulplans für die aktuelle KW. */
  aktuellesZiel: ModulplanZiel | null;
  /** Nächstes geplantes Wochenziel, falls für die aktuelle KW keines existiert. */
  naechstesZiel: ModulplanZiel | null;
  /**
   * Anstehende Beurteilungen: Prüfungstermine aus dem Semesterkalender und
   * «LB:»-Einträge des Modulplans ab der aktuellen KW.
   */
  pruefungen: Pruefung[];
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
  // Nicht-UUIDs in der URL dürfen keinen 500 auslösen.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sequenzId)) {
    return null;
  }

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
  const pruefungen: Pruefung[] = [];

  if (seq.modul) {
    const eintraege = await db
      .select({
        kw: modularPlan.kw,
        ziel: modularPlan.ziel,
        beschreibung: modularPlan.beschreibung,
        lbHinweis: modularPlan.lbHinweis,
      })
      .from(modularPlan)
      .where(eq(modularPlan.modulId, seq.modul.id))
      .orderBy(asc(modularPlan.kw));

    aktuellesZiel = eintraege.find((e) => e.kw === kw) ?? null;
    if (!aktuellesZiel) {
      naechstesZiel = eintraege.find((e) => e.kw > kw!) ?? null;
    }

    // Leistungsbeurteilungen aus dem Modulplan ab der aktuellen Woche
    for (const e of eintraege) {
      if (e.lbHinweis && e.kw >= kw) {
        pruefungen.push({
          quelle: "modulplan",
          bezeichnung: e.lbHinweis,
          wann: `KW ${e.kw}`,
          kw: e.kw,
        });
      }
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

  // Prüfungstermine aus dem Semesterkalender (ab heute).
  // Sequenzen aus dem Stundenplan-Import haben kein Semester mehr.
  const heute = schweizerHeute();
  const kalenderPruefungen = seq.semesterId
    ? await db
        .select({
          bezeichnung: kalenderEintrag.bezeichnung,
          startDatum: kalenderEintrag.startDatum,
        })
        .from(kalenderEintrag)
        .where(
          and(
            eq(kalenderEintrag.semesterId, seq.semesterId),
            eq(kalenderEintrag.typ, "pruefung"),
            gte(kalenderEintrag.endDatum, heute)
          )
        )
        .orderBy(asc(kalenderEintrag.startDatum))
    : [];

  for (const p of kalenderPruefungen) {
    pruefungen.push({
      quelle: "kalender",
      bezeichnung: p.bezeichnung,
      wann: new Date(p.startDatum).toLocaleDateString("de-CH", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      kw: getKWFromDateString(p.startDatum) ?? 99,
    });
  }

  pruefungen.sort((a, b) => a.kw - b.kw);

  // Offene Pendenzen der Klasse
  const pendenzen = await db
    .select({ id: pendenz.id, text: pendenz.text })
    .from(pendenz)
    .where(and(eq(pendenz.klasseId, seq.klasseId), eq(pendenz.erledigt, false)));

  return {
    kw,
    kwQuelle,
    // Kurz halten: das Label steht als Badge in der Kontextleiste, der volle
    // Modultitel steht ohnehin in der Seitenüberschrift.
    modulLabel: seq.modul ? `Modul ${seq.modul.nummer}` : null,
    aktuellesZiel,
    naechstesZiel,
    pruefungen,
    vorherigeNotiz,
    pendenzen,
  };
}
