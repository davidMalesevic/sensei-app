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
  const hkIds = formData.getAll("handlungskompetenzen") as string[];

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
