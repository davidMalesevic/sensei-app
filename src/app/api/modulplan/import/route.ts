import { NextRequest, NextResponse } from "next/server";
import { extractDokumentText, isTextExtension } from "@/lib/dokument-text";
import { importModularPlan } from "@/app/bildungsplan/modulplan-actions";
import { aktuelleSession } from "@/lib/dal";
import { importModulBaum } from "@/app/bildungsplan/actions";

const MAX_SIZE = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  // Ohne diese Prüfung würde die Server Action dahinter eine Weiterleitung
  // werfen — eine API soll aber mit 401 antworten.
  const angemeldet = await aktuelleSession();
  if (!angemeldet) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

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

  const rohBytes = Buffer.from(await file.arrayBuffer());

  let text: string | null;
  try {
    text = await extractDokumentText(file.name, rohBytes);
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

  // **Bei HTML geht das rohe Markup an den Import, nicht der extrahierte
  // Text.** `parseModularbeitsplanHtml()` ordnet die Spalten über die
  // Kopfzeile der Tabelle zu — nach `htmlToText()` gibt es keine Tabelle
  // mehr, und der Import fällt auf die KI zurück, die keine Blockschlüssel
  // liefert. Der Modulplan stand dann ohne `bloecke` da, die Kette
  // KW ⇒ Block ⇒ LA ⇒ Aufgaben riss, und der Entwurf bestand nur noch aus
  // KI-Vorschlägen. Auffällig wurde das erst bei Modul 168 und 278: bei 119
  // fängt der Textparser den Verlust zufällig auf, weil er für dessen
  // Schema geschrieben ist.
  //
  // `importModularPlan` reduziert HTML selbst zu Text, wo es das braucht —
  // die Vorverarbeitung hier nahm ihm nur die Wahl. Für PDF bleibt sie
  // nötig, dort ist der extrahierte Text alles, was es gibt.
  const fuerImport = isTextExtension(file.name)
    ? rohBytes.toString("utf-8")
    : text;

  const result = await importModularPlan(modulId, fuerImport);

  // Beim HTML-Export hängt am selben Dokument der ganze Aufgabenbaum
  // (Block → LA → Aufgabe). Der Modulplan bleibt auch dann gültig, wenn die
  // Struktur nicht gelesen werden kann — deshalb nur als Zusatz gemeldet.
  let baum: Awaited<ReturnType<typeof importModulBaum>> | null = null;
  if (result.success) {
    const roh = rohBytes.toString("utf-8");
    if (/<h[1-6][\s>]/i.test(roh)) {
      baum = await importModulBaum(modulId, roh);
    }
  }

  return NextResponse.json(
    { ...result, baum },
    { status: result.success ? 200 : 400 }
  );
}
