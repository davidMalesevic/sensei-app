"use server";

import { db } from "@/db";
import { klasse, pendenz } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getKlassen() {
  return db.query.klasse.findMany({
    orderBy: (k, { asc }) => [asc(k.bezeichnung)],
  });
}

export async function getKlasseById(id: string) {
  return db.query.klasse.findFirst({
    where: eq(klasse.id, id),
  });
}

export async function createKlasse(formData: FormData) {
  const bezeichnung = formData.get("bezeichnung") as string;
  const beruf = formData.get("beruf") as string;
  const lehrjahr = parseInt(formData.get("lehrjahr") as string, 10);

  if (!bezeichnung || !beruf || isNaN(lehrjahr)) {
    throw new Error("Alle Felder sind erforderlich.");
  }

  await db.insert(klasse).values({
    bezeichnung,
    beruf,
    lehrjahr,
  });

  revalidatePath("/klassen");
  redirect("/klassen");
}

export async function updateKlasse(id: string, formData: FormData) {
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
    .where(eq(klasse.id, id));

  revalidatePath("/klassen");
  redirect("/klassen");
}

export async function deleteKlasse(id: string) {
  await db.delete(klasse).where(eq(klasse.id, id));
  revalidatePath("/klassen");
}

// ─── Pendenzen (offene Punkte pro Klasse) ────────────────────────────────

export async function getPendenzen(klasseId: string, nurOffene = false) {
  return db.query.pendenz.findMany({
    where: nurOffene
      ? and(eq(pendenz.klasseId, klasseId), eq(pendenz.erledigt, false))
      : eq(pendenz.klasseId, klasseId),
    orderBy: (p, { asc, desc }) => [asc(p.erledigt), desc(p.createdAt)],
  });
}

export async function createPendenz(formData: FormData) {
  const klasseId = formData.get("klasseId") as string;
  const text = formData.get("text") as string;

  if (!klasseId || !text?.trim()) {
    throw new Error("Klasse und Text sind erforderlich.");
  }

  await db.insert(pendenz).values({ klasseId, text: text.trim() });

  revalidatePath("/klassen");
  revalidatePath("/sequenzen");
}

export async function togglePendenz(id: string, erledigt: boolean) {
  await db.update(pendenz).set({ erledigt }).where(eq(pendenz.id, id));
  revalidatePath("/klassen");
  revalidatePath("/sequenzen");
}

export async function deletePendenz(id: string) {
  await db.delete(pendenz).where(eq(pendenz.id, id));
  revalidatePath("/klassen");
  revalidatePath("/sequenzen");
}
