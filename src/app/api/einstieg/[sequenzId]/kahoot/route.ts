import { NextResponse } from "next/server";

import { aktuelleSession } from "@/lib/dal";
import { leseDaten } from "@/lib/einstieg-daten";
import { holePaket } from "@/lib/einstieg";
import { baueKahootDatei } from "@/lib/kahoot";

/**
 * Die Quizfragen eines ausgearbeiteten Einstiegs als Kahoot-Importdatei.
 *
 * Route Handler laufen am DAL vorbei, also wird die Sitzung hier von Hand
 * geprüft und mit 401 geantwortet statt mit einer Weiterleitung. `holePaket()`
 * gibt ohnehin nur eigene Sequenzen heraus.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sequenzId: string }> }
) {
  const sitzung = await aktuelleSession();
  if (!sitzung) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const { sequenzId } = await params;
  const paket = await holePaket(sitzung.id, sequenzId);
  if (!paket) {
    return NextResponse.json({ error: "Kein Einstieg ausgearbeitet." }, { status: 404 });
  }

  const daten = leseDaten(paket.methodeSchluessel, paket.inhalt.daten_json);
  if (!daten || daten.art !== "quiz") {
    return NextResponse.json(
      { error: "Dieser Einstieg enthält keine Quizfragen." },
      { status: 404 }
    );
  }

  const datei = baueKahootDatei(daten.daten, paket.inhalt.titel);
  const name = paket.inhalt.titel
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, 60);

  return new NextResponse(datei as unknown as BodyInit, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name || "kahoot"}.xlsx"`,
      // Ein Quiz gehört zu einer Klasse — nichts davon in einen geteilten Cache.
      "Cache-Control": "private, no-store",
    },
  });
}
