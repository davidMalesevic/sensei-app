import "server-only";

/**
 * Was diese Klasse in diesem Modul schon getan hat — und woran der Unterricht
 * fachlich hängt.
 *
 * Der Entwurfsgenerator verlangte von der KI immer «eine Aktivierung des
 * Vorwissens», gab ihr aber nichts darüber, *was* dieses Vorwissen ist: nur
 * die Fakten der laufenden Woche und eine Standzeile. Daraus konnte nichts
 * anderes werden als «kurzes Gespräch zum Thema». Sensei kennt den Stoff —
 * es hat ihn nur nie hergezeigt.
 *
 * Alles hier ist **belegt**, nichts geraten: abgehakte Aufgaben stehen im
 * Übertrag, Wochenziele im Modulplan, und die Zuordnung Modul →
 * Handlungskompetenz steckt seit dem Seed in
 * `handlungskompetenz.module_berufsfachschule`. Die KI formuliert daraus eine
 * Aktivierung; sie erfindet den Lernstand nicht.
 *
 * Die Benutzer-ID kommt wie überall als erster Parameter herein, damit der
 * Nachtlauf sie ohne Session reichen kann.
 */

import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  handlungskompetenz,
  handlungskompetenzbereich,
  modularPlan,
  sequenz,
  sequenzAblauf,
} from "@/db/schema";
import { getKWFromDateString } from "@/lib/kw";

export type VorwissenWoche = {
  kw: number;
  ziel: string | null;
  /** Original-Bezeichnungen der abgehakten Aufgaben, wie sie im Übertrag stehen. */
  erledigt: string[];
  /** Notiz aus dem Übertrag jener Lektion. */
  notiz: string | null;
};

export type Vorwissen = {
  /** Wochen dieses Moduls mit Rückmeldung, älteste zuerst. */
  wochen: VorwissenWoche[];
  /** Handlungskompetenzen, die dieses Modul laut Bildungsplan bedient. */
  kompetenzen: { kuerzel: string; bezeichnung: string; bereich: string }[];
  /**
   * Einstiege und Praxisbezüge der letzten Lektionen dieser Klasse — damit
   * sich die Methode nicht jede Woche wiederholt. Die KI hat kein Gedächtnis;
   * ohne diese Liste kann sie Abwechslung nicht liefern, nur behaupten.
   */
  zuletztVerwendet: { typ: string; titel: string; text: string | null }[];
};

const LEER: Vorwissen = { wochen: [], kompetenzen: [], zuletztVerwendet: [] };

export async function holeVorwissen(
  benutzerId: string,
  klasseId: string,
  modulId: string | null,
  modulNummer: number | null,
  datum: string | null
): Promise<Vorwissen> {
  if (!modulId || !datum) return LEER;

  // 1. Was diese Klasse in diesem Modul zurückgemeldet hat. Ganzes bisheriges
  //    Modul, nicht nur die Vorwoche — erst über mehrere Wochen entsteht ein
  //    Bogen, an den sich anknüpfen lässt.
  const vorherige = await db
    .select({
      startDatum: sequenz.startDatum,
      erledigt: sequenz.uebertragErledigt,
      notiz: sequenz.uebertrag,
      keinUebertrag: sequenz.keinUebertrag,
      uebertragAm: sequenz.uebertragAm,
    })
    .from(sequenz)
    .where(
      and(
        eq(sequenz.benutzerId, benutzerId),
        eq(sequenz.klasseId, klasseId),
        eq(sequenz.modulId, modulId),
        lt(sequenz.startDatum, datum),
        // Alt-Sequenzen ohne Kalenderbezug sind Archiv, kein Unterricht.
        isNotNull(sequenz.kalenderKurs)
      )
    )
    .orderBy(asc(sequenz.startDatum));

  const proKw = new Map<number, VorwissenWoche>();
  for (const s of vorherige) {
    if (s.uebertragAm === null && !s.keinUebertrag) continue;
    const kw = getKWFromDateString(s.startDatum);
    if (kw === null) continue;

    const vorhanden = proKw.get(kw) ?? { kw, ziel: null, erledigt: [], notiz: null };
    for (const e of s.erledigt ?? []) {
      if (!vorhanden.erledigt.includes(e)) vorhanden.erledigt.push(e);
    }
    // Zwei Lektionen in derselben Woche: die Notizen aneinanderhängen statt
    // die zweite die erste überschreiben zu lassen.
    const notiz = s.notiz?.trim();
    if (notiz) {
      vorhanden.notiz = vorhanden.notiz ? `${vorhanden.notiz} · ${notiz}` : notiz;
    }
    proKw.set(kw, vorhanden);
  }

  const wochen = [...proKw.values()].sort((a, b) => a.kw - b.kw);

  // 2. Das Wochenziel jener Wochen — es sagt, worum es fachlich ging.
  if (wochen.length > 0) {
    const ziele = await db
      .select({ kw: modularPlan.kw, ziel: modularPlan.ziel })
      .from(modularPlan)
      .where(
        and(
          eq(modularPlan.modulId, modulId),
          inArray(
            modularPlan.kw,
            wochen.map((w) => w.kw)
          )
        )
      );
    const nachKw = new Map(ziele.map((z) => [z.kw, z.ziel]));
    for (const w of wochen) w.ziel = nachKw.get(w.kw) ?? null;
  }

  // 3. Die Handlungskompetenzen dieses Moduls. Steht seit dem Seed im
  //    Bildungsplan (`module_berufsfachschule`) und wurde nie benutzt — die
  //    frühere Zuordnung lief über `sequenz_handlungskompetenz`, die von Hand
  //    gepflegt werden musste und leer ist.
  const kompetenzen = modulNummer
    ? await db
        .select({
          kuerzel: handlungskompetenz.kuerzel,
          bezeichnung: handlungskompetenz.bezeichnung,
          bereich: handlungskompetenzbereich.bezeichnung,
        })
        .from(handlungskompetenz)
        .innerJoin(
          handlungskompetenzbereich,
          eq(handlungskompetenzbereich.id, handlungskompetenz.bereichId)
        )
        .where(
          sql`${handlungskompetenz.moduleBerufsfachschule} @> ${JSON.stringify([modulNummer])}::jsonb`
        )
        .orderBy(asc(handlungskompetenz.kuerzel))
    : [];

  // 4. Womit die letzten Lektionen dieser Klasse eröffnet wurden — modulüber-
  //    greifend, denn eine Methode nutzt sich über Module hinweg ab.
  const zuletztVerwendet = await db
    .select({
      typ: sequenzAblauf.typ,
      titel: sequenzAblauf.titel,
      text: sequenzAblauf.text,
    })
    .from(sequenzAblauf)
    .innerJoin(sequenz, eq(sequenz.id, sequenzAblauf.sequenzId))
    .where(
      and(
        eq(sequenz.benutzerId, benutzerId),
        eq(sequenz.klasseId, klasseId),
        lt(sequenz.startDatum, datum),
        isNotNull(sequenz.kalenderKurs),
        inArray(sequenzAblauf.typ, ["einstieg", "praxisbezug"])
      )
    )
    .orderBy(desc(sequenz.startDatum), asc(sequenzAblauf.sortierung))
    .limit(6);

  return { wochen, kompetenzen, zuletztVerwendet };
}
