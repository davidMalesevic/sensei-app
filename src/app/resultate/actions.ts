"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { modul, resultatImport } from "@/db/schema";
import { benutzerId } from "@/lib/dal";
import * as R from "@/lib/resultate";

/**
 * Dünne Hüllen um `src/lib/resultate.ts` — die Engine nimmt die Benutzer-ID
 * als Parameter, hier kommt sie aus der Session. Gleiche Bauart wie bei
 * `entwurf-actions.ts` und aus demselben Grund.
 */

export async function getModuleFuerImport() {
  const bId = await benutzerId();
  return db
    .select({ id: modul.id, nummer: modul.nummer, bezeichnung: modul.bezeichnung })
    .from(modul)
    .where(eq(modul.benutzerId, bId))
    .orderBy(modul.nummer);
}

export async function getImporte(modulId?: string) {
  return R.getImporte(await benutzerId(), modulId);
}

export async function importiereResultate(
  modulId: string,
  dateiname: string,
  base64: string
) {
  const bId = await benutzerId();
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  const res = await R.importiereResultate(bId, modulId, dateiname, bytes);
  if (res.ok) revalidatePath("/resultate");
  return res;
}

export async function loescheImport(importId: string) {
  const bId = await benutzerId();
  await db
    .delete(resultatImport)
    .where(
      and(eq(resultatImport.id, importId), eq(resultatImport.benutzerId, bId))
    );
  revalidatePath("/resultate");
}

export async function getAuswertung(importId: string) {
  const bId = await benutzerId();
  const [vollstaendigkeit, klassenbild, duplikate, geplant] = await Promise.all([
    R.getVollstaendigkeit(bId, importId),
    R.getKlassenbild(bId, importId),
    R.findeDuplikate(bId, importId),
    R.getGeplantAm(bId, importId),
  ]);
  return { vollstaendigkeit, klassenbild, duplikate, geplant };
}
