import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { material } from "@/db/schema";
import { aktuelleSession } from "@/lib/dal";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ modulId: string }> }
) {
  // Route Handler laufen am DAL vorbei — die Prüfung steht hier von Hand.
  const angemeldet = await aktuelleSession();
  if (!angemeldet) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { modulId } = await params;

  const materialien = await db.query.material.findMany({
    where: and(
      eq(material.modulId, modulId),
      eq(material.benutzerId, angemeldet.id)
    ),
    columns: { id: true, titel: true, typ: true, dateiPfad: true },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });

  return NextResponse.json(materialien);
}
