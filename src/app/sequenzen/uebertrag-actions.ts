"use server";

import { db } from "@/db";
import { sequenz, klasse, modul } from "@/db/schema";
import { and, desc, eq, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/**
 * Übertrag nach der Lektion: bis wo sind wir gekommen, was fliesst in die
 * Planung der Folgewoche ein. Siehe `erstellungsprozess.md`, Abschnitt 6.4.
 *
 * Bewusst manuell — die App kann nichts wissen, was nicht getippt wird.
 */
export async function speichereUebertrag(sequenzId: string, formData: FormData) {
  const text = ((formData.get("uebertrag") as string) ?? "").trim();
  const erledigt = (formData.getAll("erledigt") as string[]).filter(Boolean);
  const slideBisRoh = ((formData.get("slideBis") as string) ?? "").trim();
  const slideBis = slideBisRoh ? Number(slideBisRoh) : null;

  await db
    .update(sequenz)
    .set({
      uebertrag: text || null,
      uebertragErledigt: erledigt.length > 0 ? erledigt : null,
      uebertragSlideBis:
        slideBis !== null && Number.isFinite(slideBis) ? slideBis : null,
      keinUebertrag: false,
      uebertragAm: new Date(),
      status: "gehalten",
      updatedAt: new Date(),
    })
    .where(eq(sequenz.id, sequenzId));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/");
}

/** «Kein Übertrag» — bewusst nichts nachzutragen, zählt als erledigt. */
export async function keinUebertragSetzen(sequenzId: string) {
  await db
    .update(sequenz)
    .set({
      keinUebertrag: true,
      uebertragAm: new Date(),
      status: "gehalten",
      updatedAt: new Date(),
    })
    .where(eq(sequenz.id, sequenzId));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/");
}

/** Einen gesetzten Übertrag wieder öffnen. */
export async function uebertragZuruecksetzen(sequenzId: string) {
  await db
    .update(sequenz)
    .set({
      uebertrag: null,
      uebertragErledigt: null,
      uebertragSlideBis: null,
      keinUebertrag: false,
      uebertragAm: null,
      updatedAt: new Date(),
    })
    .where(eq(sequenz.id, sequenzId));

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/stundenplan");
  revalidatePath("/");
}

/**
 * Sequenzen, die stattgefunden haben, aber keinen Übertrag tragen — der rote
 * Punkt. Ohne sie fehlt der Folgewoche der Ausgangspunkt.
 */
export async function getOffeneUebertraege() {
  const heute = new Date().toISOString().slice(0, 10);

  return db
    .select({
      id: sequenz.id,
      startDatum: sequenz.startDatum,
      startZeit: sequenz.startZeit,
      klasse: klasse.bezeichnung,
      modulNummer: modul.nummer,
    })
    .from(sequenz)
    .innerJoin(klasse, eq(sequenz.klasseId, klasse.id))
    .leftJoin(modul, eq(sequenz.modulId, modul.id))
    .where(
      and(
        isNotNull(sequenz.kalenderKurs),
        lt(sequenz.startDatum, heute),
        eq(sequenz.keinUebertrag, false),
        isNull(sequenz.uebertrag)
      )
    )
    .orderBy(desc(sequenz.startDatum), desc(sequenz.startZeit));
}

/**
 * Der letzte Übertrag derselben Klasse im selben Modul vor dieser Sequenz —
 * die Antwort auf «wo fange ich an».
 */
export async function getVorherigenUebertrag(
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
