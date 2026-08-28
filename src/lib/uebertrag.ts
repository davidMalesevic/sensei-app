import "server-only";

import { and, desc, eq, isNotNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { sequenz } from "@/db/schema";

/**
 * Der letzte Übertrag derselben Klasse im selben Modul vor dieser Sequenz —
 * die Antwort auf «wo fange ich an».
 *
 * Liegt hier statt in den Server Actions, weil der Nachtlauf sie ohne Session
 * braucht und die Benutzer-ID deshalb hereingereicht wird. In einer
 * `"use server"`-Datei wäre das eine Lücke: der Browser könnte eine fremde ID
 * schicken und den Stand anderer Konten auslesen.
 */
export async function holeVorherigenUebertrag(
  benutzerId: string,
  klasseId: string,
  modulId: string | null,
  datum: string | null,
  currentSequenzId: string
) {
  if (!modulId || !datum) return null;

  const [vorherige] = await db
    .select({
      id: sequenz.id,
      startDatum: sequenz.startDatum,
      uebertrag: sequenz.uebertrag,
      uebertragErledigt: sequenz.uebertragErledigt,
      uebertragSlideBis: sequenz.uebertragSlideBis,
      keinUebertrag: sequenz.keinUebertrag,
    })
    .from(sequenz)
    .where(
      and(
        eq(sequenz.benutzerId, benutzerId),
        eq(sequenz.klasseId, klasseId),
        eq(sequenz.modulId, modulId),
        ne(sequenz.id, currentSequenzId),
        lt(sequenz.startDatum, datum),
        or(isNotNull(sequenz.uebertrag), eq(sequenz.keinUebertrag, true))
      )
    )
    .orderBy(desc(sequenz.startDatum))
    .limit(1);

  return vorherige ?? null;
}
