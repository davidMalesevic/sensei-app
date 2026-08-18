"use server";

import { db } from "@/db";
import { sequenzHandlungskompetenz, sequenz } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getCoverageData() {
  const zuordnungen = await db.query.sequenzHandlungskompetenz.findMany({
    with: {
      sequenz: {
        columns: { id: true, titel: true },
        with: {
          klasse: { columns: { bezeichnung: true } },
          semester: { columns: { bezeichnung: true } },
        },
      },
      handlungskompetenz: {
        columns: { id: true, kuerzel: true },
      },
    },
  });

  const coverageMap = new Map<
    string,
    { hkId: string; kuerzel: string; sequenzen: { id: string; titel: string; klasse: string; semester: string }[] }
  >();

  for (const z of zuordnungen) {
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
