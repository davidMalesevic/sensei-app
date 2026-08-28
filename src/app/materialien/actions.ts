"use server";

import { db } from "@/db";
import { material, materialTask } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { extractDokumentText } from "@/lib/dokument-text";
import { readFile, unlink } from "fs/promises";
import { join } from "path";
import { benutzerId } from "@/lib/dal";

/**
 * material_task hängt am Material und trägt selbst keinen Besitzer — die
 * Prüfung läuft deshalb über das Elternmaterial.
 */
async function eigenesMaterial(id: string, bId: string) {
  return db.query.material.findFirst({
    where: and(eq(material.id, id), eq(material.benutzerId, bId)),
  });
}

export async function getMaterialien() {
  const bId = await benutzerId();
  return db.query.material.findMany({
    where: eq(material.benutzerId, bId),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
    with: {
      sequenz: { columns: { id: true, titel: true } },
      lektionsblock: { columns: { id: true, thema: true, sequenzId: true } },
      phase: { columns: { id: true, bezeichnung: true, lektionsblockId: true } },
    },
  });
}

export async function getMaterialienForSequenz(sequenzId: string) {
  const bId = await benutzerId();
  return db.query.material.findMany({
    where: and(eq(material.sequenzId, sequenzId), eq(material.benutzerId, bId)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function getMaterialienForBlock(lektionsblockId: string) {
  const bId = await benutzerId();
  return db.query.material.findMany({
    where: and(eq(material.lektionsblockId, lektionsblockId), eq(material.benutzerId, bId)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function getMaterialienForPhase(phaseId: string) {
  const bId = await benutzerId();
  return db.query.material.findMany({
    where: and(eq(material.phaseId, phaseId), eq(material.benutzerId, bId)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function getMaterialienForModul(modulId: string) {
  const bId = await benutzerId();
  return db.query.material.findMany({
    where: and(eq(material.modulId, modulId), eq(material.benutzerId, bId)),
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });
}

export async function createMaterial(formData: FormData) {
  const bId = await benutzerId();
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
    benutzerId: bId,
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
  const bId = await benutzerId();
  const mat = await eigenesMaterial(id, bId);
  if (!mat) return;

  await db
    .delete(material)
    .where(and(eq(material.id, id), eq(material.benutzerId, bId)));

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
  const bId = await benutzerId();
  if (!(await eigenesMaterial(materialId, bId))) return [];

  return db.query.materialTask.findMany({
    where: eq(materialTask.materialId, materialId),
    orderBy: (t, { asc }) => [asc(t.sortierung)],
  });
}

export async function deleteMaterialTask(id: string) {
  const bId = await benutzerId();
  const task = await db.query.materialTask.findFirst({
    where: eq(materialTask.id, id),
    with: {
      material: { columns: { sequenzId: true, modulId: true, benutzerId: true } },
    },
  });

  if (!task || task.material?.benutzerId !== bId) return;

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
    {
      "bezeichnung": "Aufgabe 1 / Teilaufgabe 2",
      "text": "Was die Lernenden tun muessen",
      "referenz": "Seite 4"
    }
  ]
}
` + "```" + `

Regeln:
- "bezeichnung" ist die **Original-Bezeichnung aus dem Material**, exakt so wie
  sie dort steht (z.B. "Aufgabe 1", "Aufgabe 1 / Teilaufgabe 2", "Auftrag 4.2").
  Erfinde keine eigene Nummerierung. Gibt es keine, setze null.
- "text" fasst den Auftrag knapp zusammen und behaelt die Fachbegriffe des
  Materials bei. Formuliere nicht um, wenn das Material bereits klar ist.
- "referenz" nennt die Fundstelle zum Nachschlagen: "Seite 4", "Folie 12",
  ein Kapitel oder der Code des Lern- und Arbeitsauftrags (z.B.
  "LA_119_1000_Kommunikationstechniken"). Sonst null.
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
  const bId = await benutzerId();
  const mat = await eigenesMaterial(materialId, bId);

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
    aufgaben?: { bezeichnung?: unknown; text?: unknown; referenz?: unknown }[];
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
      bezeichnung:
        typeof a.bezeichnung === "string" && a.bezeichnung.trim()
          ? a.bezeichnung.trim().slice(0, 200)
          : null,
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
