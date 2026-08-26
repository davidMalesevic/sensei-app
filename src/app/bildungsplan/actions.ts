"use server";

import { db } from "@/db";
import { sequenzHandlungskompetenz, sequenz, modul, material } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

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
    { hkId: string; kuerzel: string; sequenzen: { id: string; titel: string; klasse: string; semester: string }[] }
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
      semester: z.sequenz.semester.bezeichnung,
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
        columns: { id: true, titel: true, typ: true, dateiPfad: true, url: true, notiz: true, createdAt: true },
        orderBy: (m, { desc }) => [desc(m.createdAt)],
      },
      modularPlan: {
        columns: { id: true, kw: true, ziel: true, beschreibung: true, lbHinweis: true },
        orderBy: (mp, { asc }) => [asc(mp.kw)],
      },
    },
  });
  return module;
}
