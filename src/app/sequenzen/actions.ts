"use server";

import { db } from "@/db";
import {
  sequenz,
  sequenzHandlungskompetenz,
  lektionsblock,
  phase,
  handlungskompetenz,
  handlungskompetenzbereich,
  bildungsplan,
  phasenmodell,
  phasenTemplate,
  semester,
  klasse,
  modul,
  material,
  modularPlan,
  sequenzAnker,
  materialTask,
} from "@/db/schema";
import { eq, asc, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { callAI, parseJsonFromAI } from "@/lib/ai";
import { htmlToText } from "@/lib/dokument-text";
import { isSmartlearnExport, parseModularbeitsplan } from "@/lib/smartlearn";

export async function getSequenzen() {
  return db.query.sequenz.findMany({
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    with: {
      semester: true,
      klasse: true,
      modul: true,
      handlungskompetenzen: {
        with: {
          handlungskompetenz: true,
        },
      },
    },
  });
}

export async function getSequenzById(id: string) {
  return db.query.sequenz.findFirst({
    where: eq(sequenz.id, id),
    with: {
      semester: true,
      klasse: true,
      modul: true,
      handlungskompetenzen: {
        with: {
          handlungskompetenz: {
            with: {
              bereich: true,
            },
          },
        },
      },
      materialien: true,
      lektionsbloecke: {
        orderBy: (lb, { asc }) => [asc(lb.sortierung)],
        with: {
          phasenmodell: true,
          materialien: true,
          phasen: {
            orderBy: (p, { asc }) => [asc(p.sortierung)],
            with: {
              materialien: true,
            },
          },
        },
      },
    },
  });
}

export async function getSemesterList() {
  return db.query.semester.findMany({
    orderBy: (s, { desc }) => [desc(s.startDatum)],
  });
}

export async function getKlassenList() {
  return db.query.klasse.findMany({
    columns: { id: true, bezeichnung: true, lehrjahr: true },
    orderBy: (k, { asc }) => [asc(k.bezeichnung)],
  });
}

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

export async function getModule() {
  return db.query.modul.findMany({
    orderBy: (m, { asc }) => [asc(m.nummer)],
  });
}

export async function getPhasenmodelle() {
  return db.query.phasenmodell.findMany({
    with: {
      phasenTemplates: {
        orderBy: (pt, { asc }) => [asc(pt.sortierung)],
      },
    },
  });
}

async function createBlocksFromConfig(
  sequenzId: string,
  bloeckeJson: string
) {
  const bloecke: {
    blockTyp: string;
    phasenmodellId: string;
    thema: string;
  }[] = JSON.parse(bloeckeJson);

  for (let i = 0; i < bloecke.length; i++) {
    const b = bloecke[i];
    const blockTyp = b.blockTyp === "4er" ? ("4er" as const) : ("2er" as const);
    const pmId = b.phasenmodellId === "frei" ? null : b.phasenmodellId;

    const [createdBlock] = await db
      .insert(lektionsblock)
      .values({
        sequenzId,
        blockTyp,
        phasenmodellId: pmId,
        thema: b.thema || null,
        sortierung: i,
      })
      .returning({ id: lektionsblock.id });

    if (pmId) {
      const templates = await db.query.phasenTemplate.findMany({
        where: eq(phasenTemplate.phasenmodellId, pmId),
        orderBy: (pt, { asc: a }) => [a(pt.sortierung)],
      });

      const phasenValues = templates
        .filter((t) => !t.optional)
        .map((t, j) => ({
          lektionsblockId: createdBlock.id,
          bezeichnung: `${t.kuerzel} – ${t.bezeichnung}`,
          beschreibung: t.zweck,
          sortierung: j,
        }));

      if (phasenValues.length > 0) {
        await db.insert(phase).values(phasenValues);
      }
    }
  }
}

export async function createSequenz(formData: FormData) {
  const titel = formData.get("titel") as string;
  const beschreibung = formData.get("beschreibung") as string;
  const praxisbezug = formData.get("praxisbezug") as string;
  const semesterId = formData.get("semesterId") as string;
  const klasseId = formData.get("klasseId") as string;
  const modulIdRaw = formData.get("modulId") as string;
  const modulId = modulIdRaw && modulIdRaw !== "kein_modul" ? modulIdRaw : null;
  const datum = formData.get("datum") as string;
  const hkIds = formData.getAll("handlungskompetenzen") as string[];
  const bloeckeJson = formData.get("bloecke") as string;

  if (!titel || !semesterId || !klasseId) {
    throw new Error("Titel, Semester und Klasse sind erforderlich.");
  }

  const modeValue = formData.get("mode") as string;
  if (modeValue === "ki") {
    return createSequenzWithAI(formData);
  }

  const [created] = await db
    .insert(sequenz)
    .values({
      titel,
      beschreibung: beschreibung || null,
      praxisbezug: praxisbezug || null,
      semesterId,
      klasseId,
      modulId,
      startDatum: datum || null,
    })
    .returning({ id: sequenz.id });

  if (hkIds.length > 0) {
    await db.insert(sequenzHandlungskompetenz).values(
      hkIds.map((hkId) => ({
        sequenzId: created.id,
        handlungskompetenzId: hkId,
      }))
    );
  }

  if (bloeckeJson) {
    await createBlocksFromConfig(created.id, bloeckeJson);
  }

  revalidatePath("/sequenzen");
  redirect(`/sequenzen/${created.id}`);
}

export async function updateSequenz(id: string, formData: FormData) {
  const titel = formData.get("titel") as string;
  const beschreibung = formData.get("beschreibung") as string;
  const praxisbezug = formData.get("praxisbezug") as string;
  const semesterId = formData.get("semesterId") as string;
  const klasseId = formData.get("klasseId") as string;
  const modulIdRaw = formData.get("modulId") as string;
  const modulId = modulIdRaw && modulIdRaw !== "kein_modul" ? modulIdRaw : null;
  const datum = formData.get("datum") as string;
  const hkIds = formData.getAll("handlungskompetenzen") as string[];

  if (!titel || !semesterId || !klasseId) {
    throw new Error("Titel, Semester und Klasse sind erforderlich.");
  }

  await db
    .update(sequenz)
    .set({
      titel,
      beschreibung: beschreibung || null,
      praxisbezug: praxisbezug || null,
      semesterId,
      klasseId,
      modulId,
      startDatum: datum || null,
      updatedAt: new Date(),
    })
    .where(eq(sequenz.id, id));

  await db
    .delete(sequenzHandlungskompetenz)
    .where(eq(sequenzHandlungskompetenz.sequenzId, id));

  if (hkIds.length > 0) {
    await db.insert(sequenzHandlungskompetenz).values(
      hkIds.map((hkId) => ({
        sequenzId: id,
        handlungskompetenzId: hkId,
      }))
    );
  }

  revalidatePath("/sequenzen");
  revalidatePath(`/sequenzen/${id}`);
  revalidatePath("/");
  redirect(`/sequenzen/${id}`);
}

export async function saveUebergabenotiz(id: string, formData: FormData) {
  const notiz = formData.get("uebergabenotiz") as string;

  await db
    .update(sequenz)
    .set({ uebergabenotiz: notiz || null, updatedAt: new Date() })
    .where(eq(sequenz.id, id));

  revalidatePath(`/sequenzen/${id}`);
}

export async function getVorherigeNotiz(klasseId: string, modulId: string | null, currentSequenzId: string) {
  if (!modulId) return null;

  const vorherige = await db.query.sequenz.findFirst({
    where: (s, { and, eq, ne }) =>
      and(
        eq(s.klasseId, klasseId),
        eq(s.modulId, modulId),
        ne(s.id, currentSequenzId)
      ),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
    columns: { uebergabenotiz: true, titel: true },
  });

  if (!vorherige?.uebergabenotiz) return null;
  return { notiz: vorherige.uebergabenotiz, titel: vorherige.titel };
}

export async function deleteSequenz(id: string) {
  await db.delete(sequenz).where(eq(sequenz.id, id));
  revalidatePath("/sequenzen");
  revalidatePath("/");
  redirect("/sequenzen");
}

export async function createLektionsblock(formData: FormData) {
  const sequenzId = formData.get("sequenzId") as string;
  const blockTyp = formData.get("blockTyp") as "2er" | "4er";
  const phasenmodellIdRaw = formData.get("phasenmodellId") as string | null;
  const phasenmodellId = phasenmodellIdRaw === "frei" ? null : phasenmodellIdRaw;
  const thema = formData.get("thema") as string;
  const datum = formData.get("datum") as string;

  if (!sequenzId || !blockTyp) {
    throw new Error("Sequenz und Blocktyp sind erforderlich.");
  }

  const existing = await db.query.lektionsblock.findMany({
    where: eq(lektionsblock.sequenzId, sequenzId),
  });
  const nextSortierung = existing.length;

  const [created] = await db
    .insert(lektionsblock)
    .values({
      sequenzId,
      blockTyp,
      phasenmodellId: phasenmodellId || null,
      thema: thema || null,
      datum: datum || null,
      sortierung: nextSortierung,
    })
    .returning({ id: lektionsblock.id });

  if (phasenmodellId) {
    const templates = await db.query.phasenTemplate.findMany({
      where: eq(phasenTemplate.phasenmodellId, phasenmodellId),
      orderBy: (pt, { asc }) => [asc(pt.sortierung)],
    });

    if (templates.length > 0) {
      await db.insert(phase).values(
        templates
          .filter((t) => !t.optional)
          .map((t, i) => ({
            lektionsblockId: created.id,
            bezeichnung: `${t.kuerzel} – ${t.bezeichnung}`,
            beschreibung: t.zweck,
            sortierung: i,
          }))
      );
    }
  }

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/");
}

export async function updateLektionsblock(id: string, formData: FormData) {
  const thema = formData.get("thema") as string;
  const datum = formData.get("datum") as string;
  const blockTyp = formData.get("blockTyp") as "2er" | "4er";

  await db
    .update(lektionsblock)
    .set({
      thema: thema || null,
      datum: datum || null,
      blockTyp: blockTyp || undefined,
      updatedAt: new Date(),
    })
    .where(eq(lektionsblock.id, id));

  const block = await db.query.lektionsblock.findFirst({
    where: eq(lektionsblock.id, id),
  });
  if (block) {
    revalidatePath(`/sequenzen/${block.sequenzId}`);
    revalidatePath("/");
  }
}

export async function deleteLektionsblock(id: string) {
  const block = await db.query.lektionsblock.findFirst({
    where: eq(lektionsblock.id, id),
  });

  await db.delete(lektionsblock).where(eq(lektionsblock.id, id));

  if (block) {
    revalidatePath(`/sequenzen/${block.sequenzId}`);
    revalidatePath("/");
  }
}

export async function createPhase(formData: FormData) {
  const lektionsblockId = formData.get("lektionsblockId") as string;
  const bezeichnung = formData.get("bezeichnung") as string;
  const beschreibung = formData.get("beschreibung") as string;
  const dauerMinuten = formData.get("dauerMinuten") as string;
  const sozialform = formData.get("sozialform") as string;
  const methode = formData.get("methode") as string;

  if (!lektionsblockId || !bezeichnung) {
    throw new Error("Lektionsblock und Bezeichnung sind erforderlich.");
  }

  const validSozialform = sozialform && sozialform !== "keine"
    ? (sozialform as "EA" | "PA" | "GA" | "Plenum")
    : null;

  const existing = await db.query.phase.findMany({
    where: eq(phase.lektionsblockId, lektionsblockId),
  });

  await db.insert(phase).values({
    lektionsblockId,
    bezeichnung,
    beschreibung: beschreibung || null,
    dauerMinuten: dauerMinuten ? parseInt(dauerMinuten) : null,
    sozialform: validSozialform,
    methode: methode || null,
    sortierung: existing.length,
  });

  const block = await db.query.lektionsblock.findFirst({
    where: eq(lektionsblock.id, lektionsblockId),
  });
  if (block) {
    revalidatePath(`/sequenzen/${block.sequenzId}`);
  }
}

export async function updatePhase(id: string, formData: FormData) {
  const bezeichnung = formData.get("bezeichnung") as string;
  const beschreibung = formData.get("beschreibung") as string;
  const dauerMinuten = formData.get("dauerMinuten") as string;
  const sozialform = formData.get("sozialform") as string;
  const methode = formData.get("methode") as string;

  const validSozialformUpdate = sozialform && sozialform !== "keine"
    ? (sozialform as "EA" | "PA" | "GA" | "Plenum")
    : null;

  await db
    .update(phase)
    .set({
      bezeichnung: bezeichnung || undefined,
      beschreibung: beschreibung || null,
      dauerMinuten: dauerMinuten ? parseInt(dauerMinuten) : null,
      sozialform: validSozialformUpdate,
      methode: methode || null,
    })
    .where(eq(phase.id, id));

  const p = await db.query.phase.findFirst({
    where: eq(phase.id, id),
    with: { lektionsblock: true },
  });
  if (p?.lektionsblock) {
    revalidatePath(`/sequenzen/${p.lektionsblock.sequenzId}`);
  }
}

export async function deletePhase(id: string) {
  const p = await db.query.phase.findFirst({
    where: eq(phase.id, id),
    with: { lektionsblock: true },
  });

  await db.delete(phase).where(eq(phase.id, id));

  if (p?.lektionsblock) {
    revalidatePath(`/sequenzen/${p.lektionsblock.sequenzId}`);
  }
}

export async function reorderPhasen(
  lektionsblockId: string,
  phaseIds: string[]
) {
  for (let i = 0; i < phaseIds.length; i++) {
    await db
      .update(phase)
      .set({ sortierung: i })
      .where(eq(phase.id, phaseIds[i]));
  }

  const block = await db.query.lektionsblock.findFirst({
    where: eq(lektionsblock.id, lektionsblockId),
  });
  if (block) {
    revalidatePath(`/sequenzen/${block.sequenzId}`);
  }
}

export async function reorderLektionsbloecke(
  sequenzId: string,
  blockIds: string[]
) {
  for (let i = 0; i < blockIds.length; i++) {
    await db
      .update(lektionsblock)
      .set({ sortierung: i })
      .where(eq(lektionsblock.id, blockIds[i]));
  }

  revalidatePath(`/sequenzen/${sequenzId}`);
}

export async function generatePrompt(
  klasseId: string,
  modulId: string | null,
  excludeSequenzId?: string,
  blockConfigs?: { blockTyp: string; phasenmodellName: string | null; thema: string }[],
  additionalContext?: {
    materialBeschreibungen?: string[];
    vorwissen?: string;
    aufgaben?: string;
  }
): Promise<string> {
  const klasseData = await db.query.klasse.findFirst({
    where: eq(klasse.id, klasseId),
  });
  if (!klasseData) throw new Error("Klasse nicht gefunden");

  let modulData: { nummer: number; bezeichnung: string | null } | null = null;
  if (modulId) {
    const m = await db.query.modul.findFirst({
      where: eq(modul.id, modulId),
    });
    modulData = m ?? null;
  }

  const modulNummer = modulData?.nummer ?? null;

  let relevantHks: { kuerzel: string; bezeichnung: string }[] = [];
  if (modulNummer) {
    const allHks = await db.query.handlungskompetenz.findMany({
      with: { bereich: true },
    });
    relevantHks = allHks
      .filter((hk) =>
        (hk.moduleBerufsfachschule ?? []).includes(modulNummer)
      )
      .map((hk) => ({ kuerzel: hk.kuerzel, bezeichnung: hk.bezeichnung }));
  }

  let uebergabenotizText: string | null = null;
  if (modulId) {
    const conditions = excludeSequenzId
      ? await db.query.sequenz.findFirst({
          where: (s, { and, eq: eqFn, ne }) =>
            and(
              eqFn(s.klasseId, klasseId),
              eqFn(s.modulId, modulId),
              ne(s.id, excludeSequenzId)
            ),
          orderBy: (s, { desc: d }) => [d(s.createdAt)],
          columns: { uebergabenotiz: true, titel: true },
        })
      : await db.query.sequenz.findFirst({
          where: (s, { and, eq: eqFn }) =>
            and(eqFn(s.klasseId, klasseId), eqFn(s.modulId, modulId)),
          orderBy: (s, { desc: d }) => [d(s.createdAt)],
          columns: { uebergabenotiz: true, titel: true },
        });

    if (conditions?.uebergabenotiz) {
      uebergabenotizText = `Aus Sequenz «${conditions.titel}»:\n${conditions.uebergabenotiz}`;
    }
  }

  const phasenmodelleData = await db.query.phasenmodell.findMany({
    with: {
      phasenTemplates: {
        orderBy: (pt, { asc: a }) => [a(pt.sortierung)],
      },
    },
  });

  let prompt = `Du bist ein erfahrener Berufsschuldidaktiker für den Beruf «${klasseData.beruf}» in der Schweiz.

## Kontext

**Klasse:** ${klasseData.bezeichnung} (${klasseData.beruf}, ${klasseData.lehrjahr}. Lehrjahr)`;

  if (modulData) {
    prompt += `\n**Modul:** ${modulData.nummer}${modulData.bezeichnung ? ` – ${modulData.bezeichnung}` : ""}`;
  }

  if (relevantHks.length > 0) {
    prompt += `\n\n**Relevante Handlungskompetenzen:**`;
    for (const hk of relevantHks) {
      prompt += `\n- **${hk.kuerzel}**: ${hk.bezeichnung}`;
    }
  }

  if (uebergabenotizText) {
    prompt += `\n\n**Übergabenotiz der letzten Sequenz:**\n${uebergabenotizText}`;
  }

  const usedModelNames = new Set(
    (blockConfigs ?? [])
      .map((b) => b.phasenmodellName)
      .filter((n): n is string => n !== null)
  );

  const relevantModelle =
    blockConfigs && blockConfigs.length > 0 && usedModelNames.size > 0
      ? phasenmodelleData.filter((pm) => usedModelNames.has(pm.name))
      : phasenmodelleData;

  prompt += `\n\n## Phasenmodelle`;
  for (const pm of relevantModelle) {
    prompt += `\n\n### ${pm.name}`;
    if (pm.beschreibung) prompt += `\n${pm.beschreibung}`;
    prompt += `\nPhasen:`;
    for (const pt of pm.phasenTemplates) {
      const optional = pt.optional ? " *(optional)*" : "";
      prompt += `\n- **${pt.kuerzel} – ${pt.bezeichnung}**${optional}${pt.zweck ? `: ${pt.zweck}` : ""}`;
      if (pt.methodenVorschlaege && (pt.methodenVorschlaege as string[]).length > 0) {
        prompt += ` (z.B. ${(pt.methodenVorschlaege as string[]).join(", ")})`;
      }
    }
  }

  if (blockConfigs && blockConfigs.length > 0) {
    prompt += `\n\n## Geplante Lektionsblöcke\n`;
    prompt += `Die Sequenz besteht aus **${blockConfigs.length} Lektionsblöcken** in genau dieser Reihenfolge:\n`;
    blockConfigs.forEach((b, i) => {
      const dauer = b.blockTyp === "4er" ? "180" : "90";
      const modell = b.phasenmodellName ?? "Frei (kein Modell)";
      const thema = b.thema ? ` – Thema: «${b.thema}»` : "";
      prompt += `\n${i + 1}. **${b.blockTyp}-Block** (${dauer} Min.) mit **${modell}**${thema}`;
    });
  }

  if (additionalContext?.materialBeschreibungen && additionalContext.materialBeschreibungen.length > 0) {
    prompt += `\n\n## Verfügbare Unterrichtsmaterialien`;
    for (const mat of additionalContext.materialBeschreibungen) {
      prompt += `\n- ${mat}`;
    }
  }

  if (additionalContext?.vorwissen) {
    prompt += `\n\n## Vorwissen-Aktivierung\n${additionalContext.vorwissen}`;
  }

  if (additionalContext?.aufgaben) {
    prompt += `\n\n## Geplante Aufgaben\n${additionalContext.aufgaben}`;
  }

  prompt += `

## Aufgabe

${blockConfigs && blockConfigs.length > 0
    ? "Erstelle für die oben definierten Lektionsblöcke detaillierte Phasen mit Aktivitäten, Sozialformen und Methoden. Halte dich an die Reihenfolge und die zugewiesenen Phasenmodelle."
    : "Erstelle eine detaillierte Unterrichtssequenz mit mehreren Lektionsblöcken. Jeder Block besteht aus didaktischen Phasen nach einem der oben genannten Phasenmodelle."}

Berücksichtige dabei:
- Die Handlungskompetenzen des Moduls
- Praxisbezug zum Lehrbetrieb
- Abwechslungsreiche Sozialformen und Methoden
- Zeitliche Passung (2er-Block = 90 Min., 4er-Block = 180 Min.)
${uebergabenotizText ? "- Die Übergabenotiz der letzten Sequenz\n" : ""}
## Ausgabeformat

Gib den Plan als **JSON** im folgenden Format aus (nur das JSON, keine zusätzliche Erklärung):

\`\`\`json
{
  "lektionsbloecke": [
    {
      "thema": "Titel des Blocks",
      "blockTyp": "2er",
      "phasen": [
        {
          "bezeichnung": "A – Ankommen und einstimmen",
          "beschreibung": "Beschreibung der Aktivität",
          "dauerMinuten": 10,
          "sozialform": "Plenum",
          "methode": "Lehrvortrag"
        }
      ]
    }
  ]
}
\`\`\`

**Regeln für das JSON:**
- \`blockTyp\`: \`"2er"\` (90 Min.) oder \`"4er"\` (180 Min.)
- \`sozialform\`: \`"EA"\`, \`"PA"\`, \`"GA"\`, \`"Plenum"\` oder \`null\`
- \`dauerMinuten\`: Ganzzahl in Minuten
- Die Summe der Phasen-Dauern soll den Block nicht überschreiten
- Phasen-Bezeichnungen sollen dem gewählten Phasenmodell folgen (z.B. «A – Ankommen und einstimmen»)${blockConfigs && blockConfigs.length > 0 ? `\n- Genau **${blockConfigs.length} Lektionsblöcke** in der oben definierten Reihenfolge` : ""}`;

  return prompt;
}

export async function importLektionsbloecke(
  sequenzId: string,
  jsonString: string
): Promise<{ success: boolean; count: number; error?: string }> {
  let cleaned = jsonString.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  let data: {
    lektionsbloecke: {
      thema?: string;
      blockTyp?: string;
      phasen?: {
        bezeichnung: string;
        beschreibung?: string | null;
        dauerMinuten?: number | null;
        sozialform?: string | null;
        methode?: string | null;
      }[];
    }[];
  };

  try {
    data = JSON.parse(cleaned);
  } catch {
    return { success: false, count: 0, error: "Ungültiges JSON-Format." };
  }

  if (!data.lektionsbloecke || !Array.isArray(data.lektionsbloecke)) {
    return {
      success: false,
      count: 0,
      error: 'JSON muss ein Objekt mit "lektionsbloecke"-Array sein.',
    };
  }

  const validSozialformen = ["EA", "PA", "GA", "Plenum"];

  await db
    .delete(lektionsblock)
    .where(eq(lektionsblock.sequenzId, sequenzId));

  let nextSortierung = 0;

  for (const block of data.lektionsbloecke) {
    const blockTyp =
      block.blockTyp === "4er" ? "4er" : "2er";

    const [created] = await db
      .insert(lektionsblock)
      .values({
        sequenzId,
        blockTyp,
        thema: block.thema || null,
        sortierung: nextSortierung++,
      })
      .returning({ id: lektionsblock.id });

    if (block.phasen && Array.isArray(block.phasen)) {
      const phasenValues = block.phasen.map((p, i) => {
        const sf = p.sozialform && validSozialformen.includes(p.sozialform)
          ? (p.sozialform as "EA" | "PA" | "GA" | "Plenum")
          : null;
        return {
          lektionsblockId: created.id,
          bezeichnung: p.bezeichnung || `Phase ${i + 1}`,
          beschreibung: p.beschreibung || null,
          dauerMinuten:
            typeof p.dauerMinuten === "number" ? p.dauerMinuten : null,
          sozialform: sf,
          methode: p.methode || null,
          sortierung: i,
        };
      });

      if (phasenValues.length > 0) {
        await db.insert(phase).values(phasenValues);
      }
    }
  }

  revalidatePath(`/sequenzen/${sequenzId}`);
  revalidatePath("/");

  return { success: true, count: data.lektionsbloecke.length };
}

export async function generateWithAI(
  sequenzId: string,
  klasseId: string,
  modulId: string | null,
  excludeSequenzId?: string,
  blockConfigs?: { blockTyp: string; phasenmodellName: string | null; thema: string }[],
  additionalContext?: {
    materialBeschreibungen?: string[];
    vorwissen?: string;
    aufgaben?: string;
  }
): Promise<{ success: boolean; count: number; error?: string }> {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    return { success: false, count: 0, error: "OLLAMA_API_KEY nicht konfiguriert." };
  }

  const model = process.env.OLLAMA_MODEL || "gemma4:31b";
  const prompt = await generatePrompt(klasseId, modulId, excludeSequenzId, blockConfigs, additionalContext);

  let content: string;
  try {
    const response = await fetch("https://ollama.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { success: false, count: 0, error: `Ollama API Fehler ${response.status}: ${body}` };
    }

    const data = await response.json();
    content = data.choices[0].message.content;
  } catch (e) {
    return { success: false, count: 0, error: `API-Verbindungsfehler: ${e}` };
  }

  return importLektionsbloecke(sequenzId, content);
}

async function createSequenzWithAI(formData: FormData) {
  const titel = formData.get("titel") as string;
  const beschreibung = formData.get("beschreibung") as string;
  const praxisbezug = formData.get("praxisbezug") as string;
  const semesterId = formData.get("semesterId") as string;
  const klasseId = formData.get("klasseId") as string;
  const modulIdRaw = formData.get("modulId") as string;
  const modulId = modulIdRaw && modulIdRaw !== "kein_modul" ? modulIdRaw : null;
  const datum = formData.get("datum") as string;
  const hkIds = formData.getAll("handlungskompetenzen") as string[];
  const bloeckeJson = formData.get("bloecke") as string;
  const materialIdsJson = formData.get("materialIds") as string;
  const vorwissen = formData.get("vorwissen") as string;
  const aufgaben = formData.get("aufgaben") as string;

  if (!titel || !semesterId || !klasseId) {
    throw new Error("Titel, Semester und Klasse sind erforderlich.");
  }

  const [created] = await db
    .insert(sequenz)
    .values({
      titel,
      beschreibung: beschreibung || null,
      praxisbezug: praxisbezug || null,
      semesterId,
      klasseId,
      modulId,
      startDatum: datum || null,
    })
    .returning({ id: sequenz.id });

  if (hkIds.length > 0) {
    await db.insert(sequenzHandlungskompetenz).values(
      hkIds.map((hkId) => ({
        sequenzId: created.id,
        handlungskompetenzId: hkId,
      }))
    );
  }

  // Build additional context from KI fields
  let materialBeschreibungen: string[] = [];
  if (materialIdsJson) {
    const materialIds: string[] = JSON.parse(materialIdsJson);
    if (materialIds.length > 0) {
      const mats = await db.query.material.findMany({
        where: inArray(material.id, materialIds),
        columns: { titel: true, typ: true, notiz: true, dateiPfad: true },
      });
      materialBeschreibungen = mats.map((m) => {
        let desc = `${m.titel} (${m.typ})`;
        if (m.dateiPfad) desc += ` [Datei: ${m.dateiPfad.split("/").pop()}]`;
        if (m.notiz) desc += ` – ${m.notiz}`;
        return desc;
      });
    }
  }

  const additionalContext = {
    materialBeschreibungen:
      materialBeschreibungen.length > 0 ? materialBeschreibungen : undefined,
    vorwissen: vorwissen || undefined,
    aufgaben: aufgaben || undefined,
  };

  // Build block configs for prompt
  let blockConfigs:
    | { blockTyp: string; phasenmodellName: string | null; thema: string }[]
    | undefined;

  if (bloeckeJson) {
    const bloecke: {
      blockTyp: string;
      phasenmodellId: string;
      thema: string;
    }[] = JSON.parse(bloeckeJson);

    if (bloecke.length > 0) {
      const phasenmodelleData = await db.query.phasenmodell.findMany({
        columns: { id: true, name: true },
      });
      const pmMap = new Map(phasenmodelleData.map((pm) => [pm.id, pm.name]));

      blockConfigs = bloecke.map((b) => ({
        blockTyp: b.blockTyp,
        phasenmodellName:
          b.phasenmodellId === "frei" ? null : pmMap.get(b.phasenmodellId) ?? null,
        thema: b.thema,
      }));
    }
  }

  const result = await generateWithAI(
    created.id,
    klasseId,
    modulId,
    created.id,
    blockConfigs,
    additionalContext
  );

  if (!result.success) {
    // Even on AI failure, the sequenz was created — redirect to it
    // The user can retry from the detail page
  }

  revalidatePath("/sequenzen");
  redirect(`/sequenzen/${created.id}`);
}


// ─── Modulplan (Wochenziele) ──────────────────────────────────────────────

export async function getModularPlan(modulId: string) {
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

  // 2. Smartlearn-Export deterministisch lesen (keine KI nötig)
  if (eintraege.length === 0) {
    const text = /<[a-z][\s\S]*>/i.test(roh) ? htmlToText(roh) : roh;
    if (isSmartlearnExport(text)) {
      eintraege = parseModularbeitsplan(text);
      if (eintraege.length > 0) quelle = "smartlearn";
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
    }))
  );

  revalidatePath("/bildungsplan");
  revalidatePath("/sequenzen");

  return { success: true, count: eintraege.length, quelle };
}

export async function createModularPlanEintrag(formData: FormData) {
  const modulId = formData.get("modulId") as string;
  const kw = parseInt(formData.get("kw") as string, 10);
  const ziel = formData.get("ziel") as string;
  const beschreibung = formData.get("beschreibung") as string;

  if (!modulId || !Number.isFinite(kw) || !ziel) {
    throw new Error("Modul, Kalenderwoche und Ziel sind erforderlich.");
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
  await db.delete(modularPlan).where(eq(modularPlan.id, id));
  revalidatePath("/bildungsplan");
}

// ─── KI-Bausteine (Aktivierende Einstiege / Repetitionsbloecke) ──────────

export type BausteinArt = "einstieg" | "repetition";

const BAUSTEIN_LABELS: Record<BausteinArt, string> = {
  einstieg: "Aktivierender Einstieg",
  repetition: "Repetitionsblock",
};

const BAUSTEIN_TEMPLATES: Record<
  BausteinArt,
  { auftrag: string; umfang: string }
> = {
  einstieg: {
    auftrag: `Entwirf einen **aktivierenden Einstieg** in das Thema.

Der Einstieg soll:
- die Lernenden in den ersten Minuten kognitiv aktivieren (kein Lehrervortrag),
- an Vorwissen und an den Berufsalltag im Lehrbetrieb anknuepfen,
- eine Frage, ein Problem oder einen Widerspruch aufwerfen, der neugierig macht,
- in eine kurze Sicherung bzw. Ueberleitung zum Inhalt muenden.`,
    umfang: "15-25 Minuten.",
  },
  repetition: {
    auftrag: `Entwirf einen **Repetitionsblock** zur Sicherung des bisher Gelernten.

Der Repetitionsblock soll:
- die zentralen Inhalte aktiv abrufen lassen (Retrieval Practice),
- verschiedene Sozialformen kombinieren (EA-Abruf, PA-Vergleich, Plenum-Klaerung),
- Lernstaende sichtbar machen und typische Fehlvorstellungen aufgreifen,
- mit einer kurzen Selbsteinschaetzung der Lernenden abschliessen.`,
    umfang: "20-45 Minuten.",
  },
};

/** Kompakter Kontexttext einer Sequenz für Baustein-Prompts. */
async function buildBausteinKontext(sequenzId: string): Promise<string | null> {
  const seq = await db.query.sequenz.findFirst({
    where: eq(sequenz.id, sequenzId),
    with: {
      klasse: true,
      modul: true,
      handlungskompetenzen: { with: { handlungskompetenz: true } },
      lektionsbloecke: {
        orderBy: (lb, { asc: a }) => [a(lb.sortierung)],
        with: { phasen: { orderBy: (ph, { asc: a }) => [a(ph.sortierung)] } },
      },
      anker: { orderBy: (an, { asc: a }) => [a(an.sortierung)] },
    },
  });

  if (!seq) return null;

  let text = `**Klasse:** ${seq.klasse.bezeichnung} (${seq.klasse.beruf}, ${seq.klasse.lehrjahr}. Lehrjahr)
**Sequenz:** ${seq.titel}`;

  if (seq.modul) {
    text += `\n**Modul:** ${seq.modul.nummer}${seq.modul.bezeichnung ? ` – ${seq.modul.bezeichnung}` : ""}`;
  }
  if (seq.beschreibung) text += `\n**Beschreibung:** ${seq.beschreibung}`;
  if (seq.praxisbezug) text += `\n**Praxisbezug:** ${seq.praxisbezug}`;

  if (seq.handlungskompetenzen.length > 0) {
    text += `\n\n**Handlungskompetenzen:**`;
    for (const shk of seq.handlungskompetenzen) {
      text += `\n- ${shk.handlungskompetenz.kuerzel}: ${shk.handlungskompetenz.bezeichnung}`;
    }
  }

  if (seq.lektionsbloecke.length > 0) {
    text += `\n\n**Bereits geplante Lektionsblöcke:**`;
    seq.lektionsbloecke.forEach((lb, i) => {
      text += `\n${i + 1}. ${lb.thema || `Block ${i + 1}`} (${lb.blockTyp})`;
      const phasen = lb.phasen.map((ph) => ph.bezeichnung).filter(Boolean).join(", ");
      if (phasen) text += ` – Phasen: ${phasen}`;
    });
  }

  if (seq.anker.length > 0) {
    text += `\n\n**Bereits vorhandene Anker:**`;
    for (const an of seq.anker) {
      text += `\n- [${an.art}] ${an.titel}`;
    }
  }

  return text;
}

/**
 * Generiert per KI einen didaktischen Baustein (aktivierender Einstieg oder
 * Repetitionsblock) und legt ihn als **Anker** im Cockpit ab — kompakt zum
 * Überfliegen, nicht als Phasentabelle.
 */
export async function generateBaustein(
  sequenzId: string,
  art: BausteinArt
): Promise<{ success: boolean; titel?: string; error?: string }> {
  const template = BAUSTEIN_TEMPLATES[art];
  if (!template) {
    return { success: false, error: "Unbekannter Baustein-Typ." };
  }

  const kontext = await buildBausteinKontext(sequenzId);
  if (!kontext) return { success: false, error: "Sequenz nicht gefunden." };

  const prompt = `Du bist ein erfahrener Berufsschuldidaktiker in der Schweiz.

## Kontext

${kontext}

## Auftrag

${template.auftrag}

Umfang: ${template.umfang}
Knuepfe an das bereits Geplante an und wiederhole es nicht.

## Ausgabeformat

Die Lehrperson liest das waehrend des Unterrichts im Vorbeigehen. Schreibe
deshalb **kompakt**: einen praegnanten Titel und maximal fuenf kurze Zeilen,
die man in zehn Sekunden erfassen kann. Keine Phasentabelle, keine Floskeln.

Gib ausschliesslich JSON zurueck (keine Erklaerung):

` + "```json" + `
{
  "titel": "Kurzer, konkreter Titel",
  "schritte": [
    "Zeile 1 – was passiert, in Stichworten",
    "Zeile 2 – naechster Schritt"
  ],
  "dauerMinuten": 20,
  "sozialform": "PA"
}
` + "```" + `

**Regeln:**
- \`schritte\`: 2-5 Eintraege, je maximal ein kurzer Satz.
- \`sozialform\`: "EA", "PA", "GA", "Plenum" oder null.
- \`dauerMinuten\`: Ganzzahl.`;

  const ai = await callAI(prompt, 0.7);
  if (!ai.success) return { success: false, error: ai.error };

  const parsed = parseJsonFromAI<{
    titel?: string;
    schritte?: unknown;
    dauerMinuten?: unknown;
    sozialform?: unknown;
  }>(ai.content);

  const schritte = Array.isArray(parsed?.schritte)
    ? parsed.schritte.filter((z): z is string => typeof z === "string" && z.trim().length > 0)
    : [];

  if (!parsed || schritte.length === 0) {
    return {
      success: false,
      error: "Die KI hat keinen verwertbaren Baustein geliefert. Bitte erneut versuchen.",
    };
  }

  const meta: string[] = [];
  if (typeof parsed.dauerMinuten === "number") meta.push(`${parsed.dauerMinuten} Min.`);
  if (typeof parsed.sozialform === "string" && parsed.sozialform.trim()) {
    meta.push(parsed.sozialform.trim());
  }

  const text =
    schritte.map((z) => `• ${z.trim()}`).join("\n") +
    (meta.length > 0 ? `\n\n(${meta.join(" · ")})` : "");

  const existing = await db
    .select({ id: sequenzAnker.id })
    .from(sequenzAnker)
    .where(eq(sequenzAnker.sequenzId, sequenzId));

  const titel = parsed.titel?.trim() || BAUSTEIN_LABELS[art];

  await db.insert(sequenzAnker).values({
    sequenzId,
    art,
    titel: titel.slice(0, 300),
    text,
    sortierung: existing.length,
  });

  revalidatePath(`/sequenzen/${sequenzId}`);

  return { success: true, titel };
}

// ─── Anker-Verwaltung ────────────────────────────────────────────────────

export async function createAnker(formData: FormData) {
  const sequenzId = formData.get("sequenzId") as string;
  const art = formData.get("art") as string;
  const titel = formData.get("titel") as string;
  const text = formData.get("text") as string;

  const gueltigeArten = ["einstieg", "repetition", "aufgabe", "referenz", "modus", "notiz"];
  if (!sequenzId || !titel?.trim() || !gueltigeArten.includes(art)) {
    throw new Error("Sequenz, Art und Titel sind erforderlich.");
  }

  const existing = await db
    .select({ id: sequenzAnker.id })
    .from(sequenzAnker)
    .where(eq(sequenzAnker.sequenzId, sequenzId));

  await db.insert(sequenzAnker).values({
    sequenzId,
    art: art as "einstieg" | "repetition" | "aufgabe" | "referenz" | "modus" | "notiz",
    titel: titel.trim().slice(0, 300),
    text: text?.trim() || null,
    sortierung: existing.length,
  });

  revalidatePath(`/sequenzen/${sequenzId}`);
}

export async function deleteAnker(id: string) {
  const [entfernt] = await db
    .delete(sequenzAnker)
    .where(eq(sequenzAnker.id, id))
    .returning({ sequenzId: sequenzAnker.sequenzId });

  if (entfernt) revalidatePath(`/sequenzen/${entfernt.sequenzId}`);
}

// ─── Übergabenotiz: KI-Vorschlag ─────────────────────────────────────────

/**
 * Schlägt eine Übergabenotiz für die nächste Sequenz vor — aus Wochenziel,
 * geplanten Blöcken, Ankern und den Aufgaben der Materialien.
 * Der Text wird nicht gespeichert, sondern zur Kontrolle zurückgegeben.
 */
export async function suggestUebergabenotiz(
  sequenzId: string
): Promise<{ success: boolean; notiz?: string; error?: string }> {
  const kontext = await buildBausteinKontext(sequenzId);
  if (!kontext) return { success: false, error: "Sequenz nicht gefunden." };

  const tasks = await db
    .select({
      bezeichnung: materialTask.bezeichnung,
      taskText: materialTask.taskText,
    })
    .from(materialTask)
    .innerJoin(material, eq(material.id, materialTask.materialId))
    .where(eq(material.sequenzId, sequenzId));

  let aufgabenText = "";
  if (tasks.length > 0) {
    aufgabenText =
      `\n\n**Aufgaben aus den Materialien:**` +
      tasks
        .map((t) => `\n- ${t.bezeichnung ? `${t.bezeichnung}: ` : ""}${t.taskText}`)
        .join("");
  }

  const prompt = `Du hilfst einer Berufsschullehrperson beim Abschluss einer Unterrichtssequenz.

## Kontext

${kontext}${aufgabenText}

## Auftrag

Formuliere eine **Übergabenotiz** für die nächste Sequenz mit derselben Klasse
im selben Modul. Sie beantwortet: Wo stehen wir, was ist offen, worauf muss die
nächste Lektion aufbauen?

Schreibe 3-6 kurze Stichpunkte in der Ich-Form der Lehrperson, konkret und
ohne Floskeln. Markiere Unsicherheiten mit «(?)», damit die Lehrperson sie
korrigieren kann.

Gib **nur** den Notiztext zurueck, kein JSON, keine Ueberschrift.`;

  const ai = await callAI(prompt, 0.5);
  if (!ai.success) return { success: false, error: ai.error };

  const notiz = ai.content.trim();
  if (!notiz) {
    return { success: false, error: "Die KI hat keinen Vorschlag geliefert." };
  }

  return { success: true, notiz };
}

/** Speichert die freien Cockpit-Notizen einer Sequenz. */
export async function saveCockpitNotiz(id: string, formData: FormData) {
  const notiz = formData.get("cockpitNotiz") as string;

  await db
    .update(sequenz)
    .set({ cockpitNotiz: notiz || null, updatedAt: new Date() })
    .where(eq(sequenz.id, id));

  revalidatePath(`/sequenzen/${id}`);
}

// ─── Cockpit-Daten ───────────────────────────────────────────────────────

export type CockpitMaterial = {
  id: string;
  titel: string;
  typ: string;
  url: string | null;
  notiz: string | null;
  dateiPfad: string | null;
  herkunft: "sequenz" | "block" | "phase" | "modul";
  tasks: {
    id: string;
    bezeichnung: string | null;
    taskText: string;
    referenz: string | null;
  }[];
};

export type CockpitAnker = {
  id: string;
  art: "einstieg" | "repetition" | "aufgabe" | "referenz" | "modus" | "notiz";
  titel: string;
  text: string | null;
};

/**
 * Sammelt alles, was die Cockpit-Ansicht braucht: Grobziele der Sequenz und
 * alle Materialien der Sequenz *und* des Moduls samt extrahierter Aufgaben.
 */
export async function getCockpitData(sequenzId: string) {
  const seq = await db.query.sequenz.findFirst({
    where: eq(sequenz.id, sequenzId),
    with: {
      klasse: true,
      modul: true,
      handlungskompetenzen: { with: { handlungskompetenz: true } },
      lektionsbloecke: {
        orderBy: (lb, { asc: a }) => [a(lb.sortierung)],
        columns: { id: true, thema: true, blockTyp: true, datum: true, sortierung: true },
      },
      anker: { orderBy: (an, { asc: a }) => [a(an.sortierung)] },
    },
  });

  if (!seq) return null;

  const blockIds = seq.lektionsbloecke.map((lb) => lb.id);

  const phasenIds = blockIds.length
    ? (
        await db.query.phase.findMany({
          where: inArray(phase.lektionsblockId, blockIds),
          columns: { id: true },
        })
      ).map((p) => p.id)
    : [];

  const alleMaterialien = await db.query.material.findMany({
    where: (m, { or, eq: e, inArray: ia }) => {
      const bedingungen = [e(m.sequenzId, sequenzId)];
      if (blockIds.length) bedingungen.push(ia(m.lektionsblockId, blockIds));
      if (phasenIds.length) bedingungen.push(ia(m.phaseId, phasenIds));
      if (seq.modulId) bedingungen.push(e(m.modulId, seq.modulId));
      return or(...bedingungen);
    },
    with: {
      tasks: { orderBy: (t, { asc: a }) => [a(t.sortierung)] },
    },
    orderBy: (m, { desc: d }) => [d(m.createdAt)],
  });

  const materialien: CockpitMaterial[] = alleMaterialien.map((m) => ({
    id: m.id,
    titel: m.titel,
    typ: m.typ,
    url: m.url,
    notiz: m.notiz,
    dateiPfad: m.dateiPfad,
    herkunft: m.sequenzId
      ? "sequenz"
      : m.lektionsblockId
        ? "block"
        : m.phaseId
          ? "phase"
          : "modul",
    tasks: m.tasks.map((t) => ({
      id: t.id,
      bezeichnung: t.bezeichnung,
      taskText: t.taskText,
      referenz: t.referenz,
    })),
  }));

  return {
    id: seq.id,
    titel: seq.titel,
    beschreibung: seq.beschreibung,
    praxisbezug: seq.praxisbezug,
    cockpitNotiz: seq.cockpitNotiz,
    modulLabel: seq.modul
      ? `Modul ${seq.modul.nummer}${seq.modul.bezeichnung ? ` – ${seq.modul.bezeichnung}` : ""}`
      : null,
    handlungskompetenzen: seq.handlungskompetenzen.map((shk) => ({
      id: shk.id,
      kuerzel: shk.handlungskompetenz.kuerzel,
      bezeichnung: shk.handlungskompetenz.bezeichnung,
    })),
    lektionsbloecke: seq.lektionsbloecke,
    anker: seq.anker.map((an) => ({
      id: an.id,
      art: an.art,
      titel: an.titel,
      text: an.text,
    })) satisfies CockpitAnker[],
    materialien,
  };
}
