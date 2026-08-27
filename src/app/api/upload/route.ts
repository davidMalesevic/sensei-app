import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import { db } from "@/db";
import { material, modularPlan } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { isSmartlearnExport } from "@/lib/smartlearn";
import { htmlToText } from "@/lib/dokument-text";
import { leseModulAusMaterial } from "@/app/bildungsplan/actions";


const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formData;
  try {
    formData = await request.formData();
  } catch (err) {
    console.error("[upload] formData parse error:", err);
    return NextResponse.json({ error: "FormData ungültig." }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  const modulId = formData.get("modulId") as string | null;
  const titel = formData.get("titel") as string | null;
  const typ = (formData.get("typ") as string) || "dokument";

  console.log(`[upload] file=${file?.name} size=${file?.size} modulId=${modulId}`);

  if (!file || !modulId) {
    console.error("[upload] missing file or modulId");
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

  console.log(`[upload] success: ${titel} -> ${relativePath}`);

  // Sieht die Datei nach einem Smartlearn-Export aus, wird sie direkt
  // ausgewertet — sonst liegt der Export im Material und nichts passiert.
  //
  // Nur, wenn das Modul noch keinen Modulplan hat: der Import ersetzt die
  // Wochenziele, und ein versehentlich hochgeladener alter Export darf einen
  // gepflegten Plan nicht überschreiben. Sonst wird der Fund nur gemeldet,
  // auswerten geht dann per Knopf.
  let auswertung: {
    erkannt: boolean;
    uebernommen: boolean;
    wochenziele?: number;
    bloecke?: number;
    aufgaben?: number;
  } | null = null;

  const roh = buffer.toString("utf-8");
  if (/<h[1-6][\s>]/i.test(roh) && isSmartlearnExport(htmlToText(roh))) {
    const [vorhanden] = await db
      .select({ n: count() })
      .from(modularPlan)
      .where(eq(modularPlan.modulId, modulId));

    if ((vorhanden?.n ?? 0) > 0) {
      auswertung = { erkannt: true, uebernommen: false };
    } else {
      const ergebnis = await leseModulAusMaterial(created.id);
      auswertung = {
        erkannt: true,
        uebernommen: ergebnis.ok,
        wochenziele: ergebnis.wochenziele,
        bloecke: ergebnis.bloecke,
        aufgaben: ergebnis.aufgaben,
      };
    }
  }

  return NextResponse.json({
    id: created.id,
    dateiPfad: relativePath,
    auswertung,
  });
}
