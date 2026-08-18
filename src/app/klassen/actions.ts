"use server";

import { db } from "@/db";
import { klasse } from "@/db/schema";
import { eq } from "drizzle-orm";
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
