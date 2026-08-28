"use server";

import { db } from "@/db";
import { sequenz } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { benutzerId } from "@/lib/dal";

/**
 * Sequenzen entstehen aus dem Stundenplan-Import, nicht über ein Formular.
 * Die Planung liegt im Ablauf (`entwurf-actions.ts`), der Stand im Übertrag
 * (`uebertrag-actions.ts`), der Modulplan beim Bildungsplan. Hier bleibt nur
 * das Nötigste.
 */

export async function getSequenzen() {
  const bId = await benutzerId();
  return db.query.sequenz.findMany({
    where: eq(sequenz.benutzerId, bId),
    orderBy: (s, { asc }) => [asc(s.startDatum), asc(s.startZeit)],
    with: {
      klasse: { columns: { bezeichnung: true } },
      modul: { columns: { nummer: true } },
    },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getSequenzById(id: string) {
  // Ohne die Prüfung wirft Postgres bei jeder Nicht-UUID in der URL, und die
  // Seite antwortet mit 500 statt 404 — etwa auf alte Links wie /sequenzen/neu.
  if (!UUID.test(id)) return undefined;

  const bId = await benutzerId();
  return db.query.sequenz.findFirst({
    where: and(eq(sequenz.id, id), eq(sequenz.benutzerId, bId)),
    with: {
      klasse: true,
      modul: true,
    },
  });
}

export async function deleteSequenz(id: string) {
  const bId = await benutzerId();
  await db
    .delete(sequenz)
    .where(and(eq(sequenz.id, id), eq(sequenz.benutzerId, bId)));
  revalidatePath("/sequenzen");
  revalidatePath("/stundenplan");
  revalidatePath("/");
  redirect("/sequenzen");
}

export async function saveCockpitNotiz(id: string, formData: FormData) {
  const bId = await benutzerId();
  const notiz = formData.get("cockpitNotiz") as string;

  await db
    .update(sequenz)
    .set({ cockpitNotiz: notiz || null, updatedAt: new Date() })
    .where(and(eq(sequenz.id, id), eq(sequenz.benutzerId, bId)));

  revalidatePath(`/sequenzen/${id}`);
}
