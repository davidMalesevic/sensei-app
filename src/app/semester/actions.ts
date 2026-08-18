"use server";

import { db } from "@/db";
import { semester, kalenderEintrag } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getSemester() {
  return db.query.semester.findMany({
    orderBy: (s, { desc }) => [desc(s.startDatum)],
  });
}

export async function getSemesterById(id: string) {
  return db.query.semester.findFirst({
    where: eq(semester.id, id),
  });
}

export async function createSemester(formData: FormData) {
  const bezeichnung = formData.get("bezeichnung") as string;
  const startDatum = formData.get("startDatum") as string;
  const endDatum = formData.get("endDatum") as string;

  if (!bezeichnung || !startDatum || !endDatum) {
    throw new Error("Alle Felder sind erforderlich.");
  }

  await db.insert(semester).values({
    bezeichnung,
    startDatum,
    endDatum,
  });

  revalidatePath("/semester");
  redirect("/semester");
}

export async function updateSemester(id: string, formData: FormData) {
  const bezeichnung = formData.get("bezeichnung") as string;
  const startDatum = formData.get("startDatum") as string;
  const endDatum = formData.get("endDatum") as string;

  if (!bezeichnung || !startDatum || !endDatum) {
    throw new Error("Alle Felder sind erforderlich.");
  }

  await db
    .update(semester)
    .set({
      bezeichnung,
      startDatum,
      endDatum,
      updatedAt: new Date(),
    })
    .where(eq(semester.id, id));

  revalidatePath("/semester");
  revalidatePath(`/semester/${id}`);
  redirect(`/semester/${id}`);
}

export async function deleteSemester(id: string) {
  await db.delete(semester).where(eq(semester.id, id));
  revalidatePath("/semester");
}

export async function getSemesterMitDetails(id: string) {
  return db.query.semester.findFirst({
    where: eq(semester.id, id),
    with: {
      kalenderEintraege: {
        orderBy: (ke, { asc }) => [asc(ke.startDatum)],
      },
      sequenzen: {
        orderBy: (s, { asc }) => [asc(s.startDatum)],
        with: {
          klasse: { columns: { bezeichnung: true } },
          lektionsbloecke: {
            orderBy: (lb, { asc }) => [asc(lb.sortierung)],
            columns: { id: true, datum: true, blockTyp: true, thema: true },
          },
        },
      },
    },
  });
}

export async function createKalenderEintrag(formData: FormData) {
  const semesterId = formData.get("semesterId") as string;
  const bezeichnung = formData.get("bezeichnung") as string;
  const typ = formData.get("typ") as string;
  const startDatum = formData.get("startDatum") as string;
  const endDatum = formData.get("endDatum") as string;

  if (!semesterId || !bezeichnung || !typ || !startDatum || !endDatum) {
    throw new Error("Alle Felder sind erforderlich.");
  }

  await db.insert(kalenderEintrag).values({
    semesterId,
    bezeichnung,
    typ: typ as "feiertag" | "ferien" | "pruefung" | "sonstiges",
    startDatum,
    endDatum,
  });

  revalidatePath(`/semester/${semesterId}`);
}

export async function deleteKalenderEintrag(id: string) {
  const eintrag = await db.query.kalenderEintrag.findFirst({
    where: eq(kalenderEintrag.id, id),
  });

  await db.delete(kalenderEintrag).where(eq(kalenderEintrag.id, id));

  if (eintrag) {
    revalidatePath(`/semester/${eintrag.semesterId}`);
  }
}
