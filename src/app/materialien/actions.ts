"use server";

import { db } from "@/db";
import { material, materialTask } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { extractDokumentText } from "@/lib/dokument-text";
import { readFile, unlink } from "fs/promises";
import { join } from "path";

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

export async function getMaterialienForModul(modulId: string) {
  return db.query.material.findMany({
    where: eq(material.modulId, modulId),
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
  const modulId = formData.get("modulId") as string | null;

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
    modulId: modulId || null,
  });

  if (sequenzId) revalidatePath(`/sequenzen/${sequenzId}`);
  if (modulId) revalidatePath("/bildungsplan");
  revalidatePath("/materialien");
}

export async function deleteMaterial(id: string) {
  const mat = await db.query.material.findFirst({
    where: eq(material.id, id),
  });

  await db.delete(material).where(eq(material.id, id));

  if (mat?.dateiPfad) {
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    try {
      await unlink(join(uploadDir, mat.dateiPfad));
    } catch {
      // file may already be gone
    }
  }

  if (mat?.sequenzId) revalidatePath(`/sequenzen/${mat.sequenzId}`);
  if (mat?.modulId) revalidatePath("/bildungsplan");
  revalidatePath("/materialien");
}

// ─── Material-Tasks (KI-Extraktion) ──────────────────────────────────────

export async function getMaterialTasks(materialId: string) {
  return db.query.materialTask.findMany({
    where: eq(materialTask.materialId, materialId),
    orderBy: (t, { asc }) => [asc(t.sortierung)],
  });
}

export async function deleteMaterialTask(id: string) {
  const task = await db.query.materialTask.findFirst({
    where: eq(materialTask.id, id),
    with: { material: { columns: { sequenzId: true, modulId: true } } },
  });

  await db.delete(materialTask).where(eq(materialTask.id, id));

  if (task?.material?.sequenzId) {
    revalidatePath(`/sequenzen/${task.material.sequenzId}`);
  }
  revalidatePath("/materialien");
  revalidatePath("/bildungsplan");
}

const TASK_PROMPT = `Du bist Berufsschullehrperson und bereitest Unterricht vor.
Unten steht der Inhalt eines Unterrichtsmaterials.

Extrahiere daraus alle Aufgaben und Arbeitsauftraege, welche die Lernenden
erledigen muessen (Deliverables). Keine Lehrer-Handlungen, keine reinen
Inhaltsangaben.

Gib ausschliesslich JSON in diesem Format zurueck (keine Erklaerung):

` + "```json" + `
{
  "aufgaben": [
    { "text": "Was die Lernenden tun muessen", "referenz": "Folie 4" }
  ]
}
` + "```" + `

Regeln:
- "text" ist eine handlungsorientierte Formulierung in der Du-Form oder im Infinitiv.
- "referenz" nennt Fundstelle (z.B. "Folie 4", "Seite 2", "Kapitel 3") oder ist null.
- Gibt es keine Aufgaben, liefere ein leeres Array.

Material:
`;

/**
 * Liest den Inhalt eines Materials und extrahiert per KI die Aufgaben der
 * Lernenden. Bestehende Tasks des Materials werden dabei ersetzt.
 */
export async function extractMaterialTasks(
  materialId: string
): Promise<{ success: boolean; count: number; error?: string }> {
  const mat = await db.query.material.findFirst({
    where: eq(material.id, materialId),
  });

  if (!mat) {
    return { success: false, count: 0, error: "Material nicht gefunden." };
  }

  let inhalt: string | null = null;

  if (mat.dateiPfad) {
    const uploadDir = process.env.UPLOAD_DIR || "./uploads";
    try {
      const buffer = await readFile(join(uploadDir, mat.dateiPfad));
      inhalt = await extractDokumentText(mat.dateiPfad, buffer);
    } catch (e) {
      return {
        success: false,
        count: 0,
        error: `Datei konnte nicht gelesen werden: ${e}`,
      };
    }

    if (!inhalt) {
      return {
        success: false,
        count: 0,
        error:
          "Aus diesem Dateityp kann kein Text gelesen werden. Unterstuetzt: PDF, TXT, MD, CSV, HTML, JSON.",
      };
    }
  } else {
    // Link- oder Notiz-Material: Metadaten als Inhalt verwenden
    const teile = [mat.titel, mat.url, mat.notiz].filter(
      (t): t is string => !!t && t.trim().length > 0
    );
    if (teile.length <= 1) {
      return {
        success: false,
        count: 0,
        error:
          "Kein auswertbarer Inhalt vorhanden. Lade eine Datei hoch oder ergaenze eine Notiz.",
      };
    }
    inhalt = teile.join("\n");
  }

  const ai = await callAI(
    `${TASK_PROMPT}${inhalt.slice(0, 40000)}`,
    0.2
  );
  if (!ai.success) return { success: false, count: 0, error: ai.error };

  const parsed = parseJsonFromAI<{
    aufgaben?: { text?: unknown; referenz?: unknown }[];
  }>(ai.content);

  if (!parsed || !Array.isArray(parsed.aufgaben)) {
    return {
      success: false,
      count: 0,
      error: "Die KI hat kein gueltiges JSON geliefert. Bitte erneut versuchen.",
    };
  }

  const values = parsed.aufgaben
    .map((a, i) => ({
      materialId,
      taskText: typeof a.text === "string" ? a.text.trim() : "",
      referenz:
        typeof a.referenz === "string" && a.referenz.trim()
          ? a.referenz.trim().slice(0, 200)
          : null,
      sortierung: i,
    }))
    .filter((v) => v.taskText.length > 0);

  await db.delete(materialTask).where(eq(materialTask.materialId, materialId));

  if (values.length > 0) {
    await db.insert(materialTask).values(values);
  }

  if (mat.sequenzId) revalidatePath(`/sequenzen/${mat.sequenzId}`);
  revalidatePath("/materialien");
  revalidatePath("/bildungsplan");

  return { success: true, count: values.length };
}
