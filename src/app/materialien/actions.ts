"use server";

import { db } from "@/db";
import { material } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function getMaterialien() {
  return db.query.material.findMany({
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    with: {
      sequenz: { columns: { id: true, titel: true } },
      lektionsblock: { columns: { id: true, thema: true, sequenzId: true } },
      phase: { columns: { id: true, bezeichnung: true, lektionsblockId: true } },
    },
  });
}

export async function getMaterialienForSequenz(sequenzId: string) {
  return db.query.material.findMany({
    where: eq(material.sequenzId, sequenzId),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function getMaterialienForBlock(lektionsblockId: string) {
  return db.query.material.findMany({
    where: eq(material.lektionsblockId, lektionsblockId),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function getMaterialienForPhase(phaseId: string) {
  return db.query.material.findMany({
    where: eq(material.phaseId, phaseId),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function createMaterial(formData: FormData) {
  const titel = formData.get("titel") as string;
  const typ = formData.get("typ") as string;
  const url = formData.get("url") as string;
  const notiz = formData.get("notiz") as string;
  const sequenzId = formData.get("sequenzId") as string | null;
  const lektionsblockId = formData.get("lektionsblockId") as string | null;
  const phaseId = formData.get("phaseId") as string | null;

  if (!titel || !typ) {
    throw new Error("Titel und Typ sind erforderlich.");
  }

  await db.insert(material).values({
    titel,
    typ: typ as "arbeitsblatt" | "praesentation" | "link" | "video" | "dokument" | "notiz" | "sonstiges",
    url: url || null,
    notiz: notiz || null,
    sequenzId: sequenzId || null,
    lektionsblockId: lektionsblockId || null,
    phaseId: phaseId || null,
  });

  if (sequenzId) revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/materialien");
}

export async function deleteMaterial(id: string) {
  const mat = await db.query.material.findFirst({
    where: eq(material.id, id),
  });

  await db.delete(material).where(eq(material.id, id));

  if (mat?.sequenzId) revalidatePath(`/sequenzen/${mat.sequenzId}`);
  revalidatePath("/materialien");
}
