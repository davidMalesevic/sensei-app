"use server";

import { db } from "@/db";
import {
  sequenzHandlungskompetenz,
  sequenz,
  modul,
  material,
  modulBlock,
  modulAuftrag,
  modulAufgabe,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { parseSmartlearnStruktur } from "@/lib/smartlearn";
import { extractDokumentText } from "@/lib/dokument-text";
import { importModularPlan } from "./modulplan-actions";
import { readFile } from "fs/promises";
import { join } from "path";

export async function getCoverageData(klasseId?: string) {
  const zuordnungen = await db.query.sequenzHandlungskompetenz.findMany({
    with: {
      sequenz: {
        columns: { id: true, titel: true, klasseId: true },
        with: {
          klasse: { columns: { id: true, bezeichnung: true } },
          semester: { columns: { bezeichnung: true } },
        },
      },
      handlungskompetenz: {
        columns: { id: true, kuerzel: true },
      },
    },
  });

  const filtered = klasseId
    ? zuordnungen.filter((z) => z.sequenz.klasse.id === klasseId)
    : zuordnungen;

  const coverageMap = new Map<
    string,
    { hkId: string; kuerzel: string; sequenzen: { id: string; titel: string; klasse: string; semester: string | null }[] }
  >();

  for (const z of filtered) {
    const hkId = z.handlungskompetenz.id;
    if (!coverageMap.has(hkId)) {
      coverageMap.set(hkId, {
        hkId,
        kuerzel: z.handlungskompetenz.kuerzel,
        sequenzen: [],
      });
    }
    coverageMap.get(hkId)!.sequenzen.push({
      id: z.sequenz.id,
      titel: z.sequenz.titel,
      klasse: z.sequenz.klasse.bezeichnung,
      semester: z.sequenz.semester?.bezeichnung ?? null,
    });
  }

  return Object.fromEntries(coverageMap);
}

export async function getKlassenForFilter() {
  return db.query.klasse.findMany({
    orderBy: (k, { asc }) => [asc(k.bezeichnung)],
    columns: { id: true, bezeichnung: true },
  });
}

export async function getModulLookup(): Promise<Record<number, string | null>> {
  const module = await db.query.modul.findMany({
    columns: { nummer: true, bezeichnung: true },
  });
  return Object.fromEntries(module.map((m) => [m.nummer, m.bezeichnung]));
}

export async function getModuleGrouped() {
  const module = await db.query.modul.findMany({
    orderBy: (m, { asc }) => [asc(m.nummer)],
    with: {
      materialien: {
        columns: { id: true, titel: true, typ: true, dateiPfad: true, url: true, notiz: true, createdAt: true, blockNummer: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
      },
      modularPlan: {
        columns: { id: true, kw: true, ziel: true, beschreibung: true, lbHinweis: true, bloecke: true, laCodes: true },
        orderBy: (mp, { asc }) => [asc(mp.kw)],
      },
      // Nur Bezeichnungen, keine Aufgabentexte — die Liste dient der Übersicht.
      bloecke: {
        columns: { id: true, schluessel: true, nummer: true, titel: true, slideMaterialId: true, slideVon: true, slideBis: true },
        orderBy: (b, { asc }) => [asc(b.nummer), asc(b.schluessel)],
        with: {
          auftraege: {
            columns: { id: true, code: true },
            orderBy: (a, { asc }) => [asc(a.sortierung)],
            with: {
              aufgaben: {
                columns: { id: true, bezeichnung: true, parentId: true },
                orderBy: (a, { asc }) => [asc(a.sortierung)],
              },
            },
          },
        },
      },
    },
  });
  return module;
}

// ─── Modulbaum aus dem Smartlearn-Export ───

/**
 * Liest Blöcke, Lern- und Arbeitsaufträge und Aufgaben aus dem Smartlearn-HTML
 * und legt sie am Modul ab. Deterministisch, ohne KI.
 *
 * Blöcke werden über (modulId, nummer) aktualisiert statt neu angelegt — sonst
 * ginge die einmal gepflegte Slidezuordnung bei jedem Reimport verloren.
 * Aufträge und Aufgaben darunter werden ersetzt.
 */
export async function importModulBaum(
  modulId: string,
  html: string
): Promise<{
  ok: boolean;
  bloecke: number;
  auftraege: number;
  aufgaben: number;
  error?: string;
}> {
  const leer = { ok: false, bloecke: 0, auftraege: 0, aufgaben: 0 };

  if (!modulId) return { ...leer, error: "Kein Modul gewählt." };

  const geparst = parseSmartlearnStruktur(html);
  if (geparst.length === 0) {
    return {
      ...leer,
      error:
        "Keine Blockstruktur gefunden. Erwartet wird der HTML-Export aus Smartlearn.",
    };
  }

  let auftraegeGesamt = 0;
  let aufgabenGesamt = 0;

  for (const b of geparst) {
    const [block] = await db
      .insert(modulBlock)
      .values({
        modulId,
        schluessel: b.schluessel,
        nummer: b.nummer,
        titel: b.titel,
      })
      .onConflictDoUpdate({
        target: [modulBlock.modulId, modulBlock.schluessel],
        set: { titel: b.titel, nummer: b.nummer },
      })
      .returning({ id: modulBlock.id });

    await db.delete(modulAuftrag).where(eq(modulAuftrag.blockId, block.id));

    for (const [i, la] of b.auftraege.entries()) {
      const [auftrag] = await db
        .insert(modulAuftrag)
        .values({
          blockId: block.id,
          code: la.code,
          ausgangslage: la.ausgangslage,
          aufgabenstellung: la.aufgabenstellung,
          guetekriterien: la.guetekriterien,
          sortierung: i,
        })
        .returning({ id: modulAuftrag.id });
      auftraegeGesamt++;

      for (const [j, a] of la.aufgaben.entries()) {
        const [aufgabe] = await db
          .insert(modulAufgabe)
          .values({
            auftragId: auftrag.id,
            bezeichnung: a.bezeichnung,
            text: a.text,
            sortierung: j,
          })
          .returning({ id: modulAufgabe.id });
        aufgabenGesamt++;

        if (a.teilaufgaben.length > 0) {
          await db.insert(modulAufgabe).values(
            a.teilaufgaben.map((t, k) => ({
              auftragId: auftrag.id,
              parentId: aufgabe.id,
              bezeichnung: t.bezeichnung,
              text: t.text,
              sortierung: k,
            }))
          );
          aufgabenGesamt += a.teilaufgaben.length;
        }
      }
    }
  }

  revalidatePath("/bildungsplan");

  return {
    ok: true,
    bloecke: geparst.length,
    auftraege: auftraegeGesamt,
    aufgaben: aufgabenGesamt,
  };
}

/** Der Baum eines Moduls für die Anzeige. */
export async function getModulBaum(modulId: string) {
  return db.query.modulBlock.findMany({
    where: eq(modulBlock.modulId, modulId),
    orderBy: (b, { asc }) => [asc(b.nummer)],
    with: {
      slideMaterial: { columns: { id: true, titel: true } },
      auftraege: {
        orderBy: (a, { asc }) => [asc(a.sortierung)],
        with: {
          aufgaben: { orderBy: (a, { asc }) => [asc(a.sortierung)] },
        },
      },
    },
  });
}

/** Etikett eines Materials setzen: null = ganzes Modul, sonst ein Block. */
export async function setzeMaterialBlock(
  materialId: string,
  blockNummer: number | null
) {
  await db
    .update(material)
    .set({ blockNummer })
    .where(eq(material.id, materialId));
  revalidatePath("/bildungsplan");
}

/** Slidebereich eines Blocks in einer modulweiten Präsentation festhalten. */
export async function setzeBlockSlides(
  blockId: string,
  materialId: string | null,
  von: number | null,
  bis: number | null
) {
  await db
    .update(modulBlock)
    .set({ slideMaterialId: materialId, slideVon: von, slideBis: bis })
    .where(eq(modulBlock.id, blockId));
  revalidatePath("/bildungsplan");
}

/**
 * Liest Modulplan und Aufgabenbaum aus einem bereits hochgeladenen
 * Modul-Material.
 *
 * Ohne das gäbe es zwei getrennte Wege für dieselbe Datei: einmal Drag & Drop
 * in die Materialien, einmal der Modulplan-Dialog. Wer den Export ins Material
 * zieht, erwartet zu Recht, ihn dort auch auswerten zu können.
 */
export async function leseModulAusMaterial(materialId: string): Promise<{
  ok: boolean;
  wochenziele?: number;
  bloecke?: number;
  aufgaben?: number;
  fehler?: string;
}> {
  const eintrag = await db.query.material.findFirst({
    where: eq(material.id, materialId),
    columns: { id: true, titel: true, dateiPfad: true, modulId: true },
  });

  if (!eintrag) return { ok: false, fehler: "Material nicht gefunden." };
  if (!eintrag.modulId) return { ok: false, fehler: "Material hängt an keinem Modul." };
  if (!eintrag.dateiPfad) {
    return { ok: false, fehler: "Zu diesem Eintrag gibt es keine Datei." };
  }

  const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
  let bytes: Buffer;
  try {
    bytes = await readFile(join(UPLOAD_DIR, eintrag.dateiPfad));
  } catch {
    return { ok: false, fehler: "Die Datei konnte nicht gelesen werden." };
  }

  let text: string | null;
  try {
    text = await extractDokumentText(eintrag.titel, bytes);
  } catch (e) {
    return { ok: false, fehler: `Datei konnte nicht gelesen werden: ${e}` };
  }
  if (!text) {
    return {
      ok: false,
      fehler: "Dateityp wird nicht unterstützt. Möglich sind HTML, PDF, JSON, CSV, TXT.",
    };
  }

  // Plan und Baum sind unabhängig voneinander: Modul 219 hat seinen
  // Arbeitsplan nur als Bild im Export, aber einen vollständigen
  // Aufgabenbaum. Ein fehlender Plan darf den Baum nicht verhindern.
  const plan = await importModularPlan(eintrag.modulId, text);

  // Der Aufgabenbaum braucht das rohe HTML — dort trägt die
  // Überschriftenebene die Bedeutung, im geglätteten Text ist sie weg.
  const roh = bytes.toString("utf-8");
  const baum = /<h[1-6][\s>]/i.test(roh)
    ? await importModulBaum(eintrag.modulId, roh)
    : null;

  if (!plan.success && !baum?.ok) {
    return {
      ok: false,
      fehler: plan.error ?? baum?.error ?? "Datei konnte nicht ausgewertet werden.",
    };
  }

  revalidatePath("/bildungsplan");

  return {
    ok: true,
    wochenziele: plan.success ? plan.count : 0,
    bloecke: baum?.ok ? baum.bloecke : 0,
    aufgaben: baum?.ok ? baum.aufgaben : 0,
    fehler: !plan.success ? `Kein Modulplan: ${plan.error}` : undefined,
  };
}

/** Bildungsplan mit Handlungskompetenzbereichen und -kompetenzen. */
export async function getBildungsplanMitHK() {
  return db.query.bildungsplan.findMany({
    with: {
      handlungskompetenzbereiche: {
        orderBy: (hkb, { asc }) => [asc(hkb.sortierung)],
        with: {
          handlungskompetenzen: {
            orderBy: (hk, { asc }) => [asc(hk.sortierung)],
          },
        },
      },
    },
  });
}
