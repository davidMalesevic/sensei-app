"use server";

import { db } from "@/db";
import { klasse, pendenz } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { benutzerId } from "@/lib/dal";

/**
 * Jede Abfrage hier ist auf den angemeldeten Benutzer eingeschränkt.
 * Beim Schreiben reicht `eq(id)` nicht — ohne den Besitzer im WHERE könnte
 * eine geratene UUID fremde Daten treffen.
 */

export async function getKlassen() {
  const bId = await benutzerId();
  return db.query.klasse.findMany({
    where: eq(klasse.benutzerId, bId),
    orderBy: (k, { asc }) => [asc(k.bezeichnung)],
  });
}

export async function getKlasseById(id: string) {
  const bId = await benutzerId();
  return db.query.klasse.findFirst({
    where: and(eq(klasse.id, id), eq(klasse.benutzerId, bId)),
  });
}

export async function createKlasse(formData: FormData) {
  const bId = await benutzerId();
  const bezeichnung = formData.get("bezeichnung") as string;
  const beruf = formData.get("beruf") as string;
  const lehrjahr = parseInt(formData.get("lehrjahr") as string, 10);

  if (!bezeichnung || !beruf || isNaN(lehrjahr)) {
    throw new Error("Alle Felder sind erforderlich.");
  }

  await db.insert(klasse).values({
    benutzerId: bId,
    bezeichnung,
    beruf,
    lehrjahr,
  });

  revalidatePath("/klassen");
  redirect("/klassen");
}

export async function updateKlasse(id: string, formData: FormData) {
  const bId = await benutzerId();
  const bezeichnung = formData.get("bezeichnung") as string;
  const beruf = formData.get("beruf") as string;
  const lehrjahr = parseInt(formData.get("lehrjahr") as string, 10);

  if (!bezeichnung || !beruf || isNaN(lehrjahr)) {
    throw new Error("Alle Felder sind erforderlich.");
  }

  await db
    .update(klasse)
    .set({
      bezeichnung,
      beruf,
      lehrjahr,
      updatedAt: new Date(),
    })
    .where(and(eq(klasse.id, id), eq(klasse.benutzerId, bId)));

  revalidatePath("/klassen");
  redirect("/klassen");
}

export async function deleteKlasse(id: string) {
  const bId = await benutzerId();
  await db
    .delete(klasse)
    .where(and(eq(klasse.id, id), eq(klasse.benutzerId, bId)));
  revalidatePath("/klassen");
}

// ─── Pendenzen (offene Punkte pro Klasse) ────────────────────────────────

export async function getPendenzen(klasseId: string, nurOffene = false) {
  const bId = await benutzerId();
  return db.query.pendenz.findMany({
    where: nurOffene
      ? and(
          eq(pendenz.benutzerId, bId),
          eq(pendenz.klasseId, klasseId),
          eq(pendenz.erledigt, false)
        )
      : and(eq(pendenz.benutzerId, bId), eq(pendenz.klasseId, klasseId)),
    orderBy: (p, { asc, desc }) => [asc(p.erledigt), desc(p.createdAt)],
  });
}

export async function createPendenz(formData: FormData) {
  const bId = await benutzerId();
  const klasseId = formData.get("klasseId") as string;
  const text = formData.get("text") as string;

  if (!klasseId || !text?.trim()) {
    throw new Error("Klasse und Text sind erforderlich.");
  }

  // Die Klasse muss dem angemeldeten Benutzer gehören — sonst hinge die
  // Pendenz an einer fremden Klasse.
  const eigene = await db.query.klasse.findFirst({
    where: and(eq(klasse.id, klasseId), eq(klasse.benutzerId, bId)),
    columns: { id: true },
  });
  if (!eigene) throw new Error("Klasse nicht gefunden.");

  await db
    .insert(pendenz)
    .values({ benutzerId: bId, klasseId, text: text.trim() });

  revalidatePath("/klassen");
  revalidatePath("/sequenzen");
}

export async function togglePendenz(id: string, erledigt: boolean) {
  const bId = await benutzerId();
  await db
    .update(pendenz)
    .set({ erledigt })
    .where(and(eq(pendenz.id, id), eq(pendenz.benutzerId, bId)));
  revalidatePath("/klassen");
  revalidatePath("/sequenzen");
}

export async function deletePendenz(id: string) {
  const bId = await benutzerId();
  await db
    .delete(pendenz)
    .where(and(eq(pendenz.id, id), eq(pendenz.benutzerId, bId)));
  revalidatePath("/klassen");
  revalidatePath("/sequenzen");
}
