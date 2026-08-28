"use server";

import { db } from "@/db";
import { modul, modularPlan } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { htmlToText } from "@/lib/dokument-text";
import { benutzerId } from "@/lib/dal";

/**
 * `modular_plan` hängt am Modul und trägt keinen eigenen Besitzer — geprüft
 * wird deshalb über das Elternmodul.
 */
async function eigenesModul(modulId: string, bId: string) {
  return db.query.modul.findFirst({
    where: and(eq(modul.id, modulId), eq(modul.benutzerId, bId)),
    columns: { id: true },
  });
}
import {
  isSmartlearnExport,
  parseModularbeitsplan,
  parseModularbeitsplanHtml,
} from "@/lib/smartlearn";

/**
 * Modulplan: die Wochenziele eines Moduls und ihr Bezug auf Blöcke.
 *
 * Liegt beim Bildungsplan, nicht bei den Sequenzen — der Plan gehört zum
 * Modul und gilt für alle Klassen, die es besuchen.
 */


// ─── Modulplan (Wochenziele) ──────────────────────────────────────────────

export async function getModularPlan(modulId: string) {
  const bId = await benutzerId();
  if (!(await eigenesModul(modulId, bId))) return [];

  return db.query.modularPlan.findMany({
    where: eq(modularPlan.modulId, modulId),
    orderBy: (mp, { asc: a }) => [a(mp.kw)],
  });
}

type ModularPlanEintrag = {
  kw: number;
  ziel: string;
  beschreibung?: string | null;
  lbHinweis?: string | null;
  /** Nur aus dem Smartlearn-Pfad: KW → Block ist die Kette zu den Aufgaben. */
  bloecke?: string[];
  laCodes?: string[];
};

/** Normalisiert beliebige Eingabeformen auf `{ kw, ziel, beschreibung }`. */
function normalisiereEintraege(raw: unknown): ModularPlanEintrag[] {
  const liste = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as { eintraege?: unknown })?.eintraege)
      ? (raw as { eintraege: unknown[] }).eintraege
      : Array.isArray((raw as { modularPlan?: unknown })?.modularPlan)
        ? (raw as { modularPlan: unknown[] }).modularPlan
        : Array.isArray((raw as { wochen?: unknown })?.wochen)
          ? (raw as { wochen: unknown[] }).wochen
          : [];

  const eintraege: ModularPlanEintrag[] = [];

  for (const item of liste) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;

    const kwRaw = o.kw ?? o.KW ?? o.woche ?? o.kalenderwoche;
    const kw =
      typeof kwRaw === "number"
        ? kwRaw
        : typeof kwRaw === "string"
          ? parseInt(kwRaw.replace(/\D/g, ""), 10)
          : NaN;

    const zielRaw = o.ziel ?? o.thema ?? o.titel ?? o.lernziel;
    const ziel = typeof zielRaw === "string" ? zielRaw.trim() : "";

    if (!Number.isFinite(kw) || kw < 1 || kw > 53 || !ziel) continue;

    const beschreibungRaw = o.beschreibung ?? o.inhalt ?? o.details;
    const lbRaw = o.lbHinweis ?? o.lb ?? o.leistungsbeurteilung ?? o.pruefung;
    eintraege.push({
      kw,
      ziel: ziel.slice(0, 300),
      beschreibung:
        typeof beschreibungRaw === "string" && beschreibungRaw.trim()
          ? beschreibungRaw.trim()
          : null,
      lbHinweis:
        typeof lbRaw === "string" && lbRaw.trim() ? lbRaw.trim() : null,
    });
  }

  return eintraege;
}

const MODULPLAN_JSON_PROMPT = `Du erhaeltst den Modulplan einer Berufsfachschule als Rohtext.
Extrahiere daraus die Wochenplanung.

Gib ausschliesslich JSON in diesem Format zurueck (keine Erklaerung):

\`\`\`json
{
  "eintraege": [
    { "kw": 34, "ziel": "Kurzes Wochenziel", "beschreibung": "Optionale Details" }
  ]
}
\`\`\`

Regeln:
- "kw" ist die Kalenderwoche als Ganzzahl (1-53).
- "ziel" ist eine knappe Formulierung (max. 300 Zeichen).
- "beschreibung" darf null sein.
- Zeilen ohne erkennbare Kalenderwoche werden weggelassen.

Rohtext:
`;

/**
 * Importiert einen Modulplan aus JSON, HTML oder PDF-/Freitext.
 * JSON wird direkt gemappt, HTML zuerst zu Text reduziert; alles, was sich
 * nicht direkt mappen laesst, wird von der KI in das Zielschema uebersetzt.
 */
export async function importModularPlan(
  modulId: string,
  input: string,
  options?: { ersetzen?: boolean }
): Promise<{
  success: boolean;
  count: number;
  quelle?: "json" | "smartlearn" | "ki";
  error?: string;
}> {
  const bId = await benutzerId();
  if (!(await eigenesModul(modulId, bId))) {
    return { success: false, count: 0, error: "Modul nicht gefunden." };
  }

  const roh = input?.trim();
  if (!modulId) {
    return { success: false, count: 0, error: "Kein Modul gewaehlt." };
  }
  if (!roh) {
    return { success: false, count: 0, error: "Keine Daten zum Importieren." };
  }

  let eintraege: ModularPlanEintrag[] = [];
  let quelle: "json" | "smartlearn" | "ki" = "json";

  // 1. Direktes JSON (auch in Markdown-Fences)
  const direkt = parseJsonFromAI<unknown>(roh);
  if (direkt) eintraege = normalisiereEintraege(direkt);

  // 2. Smartlearn-Export deterministisch lesen (keine KI nötig).
  //    Die HTML-Tabelle zuerst: sie trägt über alle Exportschemata hinweg,
  //    der Textparser nur über das eine mit «Block & Lern- und Arbeitsauftrag».
  if (eintraege.length === 0) {
    const istHtml = /<[a-z][\s\S]*>/i.test(roh);
    if (istHtml) {
      eintraege = parseModularbeitsplanHtml(roh);
      if (eintraege.length > 0) quelle = "smartlearn";
    }
    if (eintraege.length === 0) {
      const text = istHtml ? htmlToText(roh) : roh;
      if (isSmartlearnExport(text)) {
        eintraege = parseModularbeitsplan(text);
        if (eintraege.length > 0) quelle = "smartlearn";
      }
    }
  }

  // 3. Sonstiges HTML/Freitext -> KI-Normalisierung
  if (eintraege.length === 0) {
    quelle = "ki";
    const text = /<[a-z][\s\S]*>/i.test(roh) ? htmlToText(roh) : roh;
    if (!text.trim()) {
      return { success: false, count: 0, error: "Kein lesbarer Inhalt gefunden." };
    }

    const ai = await callAI(
      `${MODULPLAN_JSON_PROMPT}${text.slice(0, 40000)}`,
      0.2
    );
    if (!ai.success) return { success: false, count: 0, error: ai.error };

    const parsed = parseJsonFromAI<unknown>(ai.content);
    if (!parsed) {
      return {
        success: false,
        count: 0,
        error: "Die KI hat kein gueltiges JSON geliefert. Bitte erneut versuchen.",
      };
    }
    eintraege = normalisiereEintraege(parsed);
  }

  if (eintraege.length === 0) {
    return {
      success: false,
      count: 0,
      error: "Keine Eintraege mit Kalenderwoche und Ziel erkannt.",
    };
  }

  if (options?.ersetzen !== false) {
    await db.delete(modularPlan).where(eq(modularPlan.modulId, modulId));
  }


  await db.insert(modularPlan).values(
    eintraege.map((e) => ({
      modulId,
      kw: e.kw,
      ziel: e.ziel,
      beschreibung: e.beschreibung ?? null,
      lbHinweis: e.lbHinweis ?? null,
      bloecke: e.bloecke?.length ? e.bloecke : null,
      laCodes: e.laCodes?.length ? e.laCodes : null,
    }))
  );

  revalidatePath("/bildungsplan");
  revalidatePath("/sequenzen");

  return { success: true, count: eintraege.length, quelle };
}

export async function createModularPlanEintrag(formData: FormData) {
  const bId = await benutzerId();
  const modulId = formData.get("modulId") as string;
  const kw = parseInt(formData.get("kw") as string, 10);
  const ziel = formData.get("ziel") as string;
  const beschreibung = formData.get("beschreibung") as string;

  if (!modulId || !Number.isFinite(kw) || !ziel) {
    throw new Error("Modul, Kalenderwoche und Ziel sind erforderlich.");
  }
  if (!(await eigenesModul(modulId, bId))) {
    throw new Error("Modul nicht gefunden.");
  }

  await db.insert(modularPlan).values({
    modulId,
    kw,
    ziel,
    beschreibung: beschreibung || null,
    lbHinweis: (formData.get("lbHinweis") as string) || null,
  });

  revalidatePath("/bildungsplan");
}

export async function deleteModularPlanEintrag(id: string) {
  const bId = await benutzerId();

  // Nur löschen, wenn der Eintrag an einem eigenen Modul hängt.
  const eigene = await db
    .select({ id: modularPlan.id })
    .from(modularPlan)
    .innerJoin(modul, eq(modularPlan.modulId, modul.id))
    .where(and(eq(modularPlan.id, id), eq(modul.benutzerId, bId)));
  if (eigene.length === 0) return;

  await db.delete(modularPlan).where(eq(modularPlan.id, id));
  revalidatePath("/bildungsplan");
}
