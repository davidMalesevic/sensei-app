import { NextRequest, NextResponse } from "next/server";
import { extractDokumentText } from "@/lib/dokument-text";
import { importModularPlan } from "@/app/sequenzen/actions";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "FormData ungültig." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const modulId = formData.get("modulId") as string | null;

  if (!file || !modulId) {
    return NextResponse.json(
      { error: "Datei und Modul sind erforderlich." },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "Datei darf maximal 20 MB gross sein." },
      { status: 400 }
    );
  }

  let text: string | null;
  try {
    text = await extractDokumentText(
      file.name,
      Buffer.from(await file.arrayBuffer())
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Datei konnte nicht gelesen werden: ${e}` },
      { status: 400 }
    );
  }

  if (!text) {
    return NextResponse.json(
      {
        error:
          "Dateityp wird nicht unterstützt. Möglich sind PDF, HTML, JSON, CSV, TXT und Markdown.",
      },
      { status: 400 }
    );
  }

  const result = await importModularPlan(modulId, text);
  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
