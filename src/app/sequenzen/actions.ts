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
} from "@/db/schema";
import { eq, asc, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
    const bloecke: {
      blockTyp: string;
      phasenmodellId: string;
      thema: string;
    }[] = JSON.parse(bloeckeJson);

    for (let i = 0; i < bloecke.length; i++) {
      const b = bloecke[i];
      const blockTyp = b.blockTyp === "4er" ? "4er" as const : "2er" as const;
      const pmId = b.phasenmodellId === "frei" ? null : b.phasenmodellId;

      const [createdBlock] = await db
        .insert(lektionsblock)
        .values({
          sequenzId: created.id,
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
  blockConfigs?: { blockTyp: string; phasenmodellName: string | null; thema: string }[]
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
