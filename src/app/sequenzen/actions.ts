"use server";

import { db } from "@/db";
import { sequenz } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Sequenzen entstehen aus dem Stundenplan-Import, nicht über ein Formular.
 * Die Planung liegt im Ablauf (`entwurf-actions.ts`), der Stand im Übertrag
 * (`uebertrag-actions.ts`), der Modulplan beim Bildungsplan. Hier bleibt nur
 * das Nötigste.
 */

export async function getSequenzen() {
  return db.query.sequenz.findMany({
    orderBy: (s, { asc }) => [asc(s.startDatum), asc(s.startZeit)],
    with: {
      klasse: { columns: { bezeichnung: true } },
      modul: { columns: { nummer: true } },
    },
  });
}

export async function getSequenzById(id: string) {
  return db.query.sequenz.findFirst({
    where: eq(sequenz.id, id),
    with: {
      klasse: true,
      modul: true,
    },
  });
}

export async function deleteSequenz(id: string) {
  await db.delete(sequenz).where(eq(sequenz.id, id));
  revalidatePath("/sequenzen");
  revalidatePath("/stundenplan");
  revalidatePath("/");
  redirect("/sequenzen");
}

export async function saveCockpitNotiz(id: string, formData: FormData) {
  const notiz = formData.get("cockpitNotiz") as string;

  await db
    .update(sequenz)
    .set({ cockpitNotiz: notiz || null, updatedAt: new Date() })
    .where(eq(sequenz.id, id));

  revalidatePath(`/sequenzen/${id}`);
}
