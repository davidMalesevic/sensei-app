import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { material } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ modulId: string }> }
) {
  const { modulId } = await params;

  const materialien = await db.query.material.findMany({
    where: eq(material.modulId, modulId),
    columns: { id: true, titel: true, typ: true, dateiPfad: true },
    orderBy: (m, { desc }) => [desc(m.createdAt)],
  });

  return NextResponse.json(materialien);
}
