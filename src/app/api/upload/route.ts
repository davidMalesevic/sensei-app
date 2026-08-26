import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { material } from "@/db/schema";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const modulId = formData.get("modulId") as string | null;
  const titel = formData.get("titel") as string | null;
  const typ = (formData.get("typ") as string) || "dokument";

  if (!file || !modulId) {
    return NextResponse.json(
      { error: "Datei und Modul sind erforderlich." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei darf maximal 50 MB gross sein." },
      { status: 400 }
    );
  }

  const moduleDir = join(UPLOAD_DIR, "module", modulId);
  await mkdir(moduleDir, { recursive: true });

  const ext = file.name.includes(".") ? file.name.substring(file.name.lastIndexOf(".")) : "";
  const safeName = `${randomUUID()}${ext}`;
  const relativePath = `module/${modulId}/${safeName}`;
  const absolutePath = join(UPLOAD_DIR, relativePath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const [created] = await db
    .insert(material)
    .values({
      titel: titel || file.name,
      typ: typ as "arbeitsblatt" | "praesentation" | "link" | "video" | "dokument" | "notiz" | "sonstiges",
      modulId,
      dateiPfad: relativePath,
    })
    .returning({ id: material.id });

  return NextResponse.json({ id: created.id, dateiPfad: relativePath });
}
