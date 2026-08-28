import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { erzeugeEntwuerfe } from "@/lib/entwurf";
import { schweizerDatumPlus } from "@/lib/zeit";

/**
 * Nachtlauf für die Ablaufentwürfe.
 *
 * Bewusst als Route statt als Timer im App-Prozess: so wird der Lauf von einem
 * Cron auf dem VPS angestossen, überlebt jeden Neustart und ist von aussen
 * prüfbar. Siehe `erstellungsprozess.md`, Abschnitt 5.1.
 *
 * Standardfenster sind die nächsten 10 Tage — das deckt Donnerstag, Freitag und
 * den folgenden Dienstag ab.
 *
 * Seit der Datentrennung läuft er **pro Benutzer**: es gibt keine gemeinsame
 * Sequenzliste mehr. Die Route weist sich mit CRON_SECRET aus und hat kein
 * Session-Cookie — deshalb ruft sie die Engine aus `lib/entwurf.ts` direkt auf
 * und nicht die Server Actions.
 */
const TAGE_VORAUS = 10;

function autorisiert(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET ist nicht konfiguriert." },
      { status: 503 }
    );
  }
  if (!autorisiert(request)) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  const von = schweizerDatumPlus(0);
  const bis = schweizerDatumPlus(TAGE_VORAUS);

  const alle = await db.query.benutzer.findMany({
    columns: { id: true, email: true },
  });

  const start = Date.now();
  let erzeugt = 0;
  let uebernommen = 0;
  let uebersprungen = 0;
  const fehler: { sequenzId: string; grund: string }[] = [];

  for (const b of alle) {
    // Ein Fehler in einem Konto darf die übrigen nicht mitreissen.
    try {
      const res = await erzeugeEntwuerfe(b.id, von, bis);
      erzeugt += res.erzeugt;
      uebernommen += res.uebernommen;
      uebersprungen += res.uebersprungen;
      fehler.push(...res.fehler);
      console.log(
        `[nachtlauf] ${b.email}: ${res.erzeugt} Entwürfe, ` +
          `${res.uebernommen} übernommen, ${res.fehler.length} Fehler`
      );
    } catch (e) {
      console.error(`[nachtlauf] ${b.email} fehlgeschlagen:`, e);
      fehler.push({ sequenzId: "—", grund: `${b.email}: ${e}` });
    }
  }

  const dauer = Math.round((Date.now() - start) / 1000);
  console.log(
    `[nachtlauf] ${von} bis ${bis}, ${alle.length} Konten: ` +
      `${erzeugt} Entwürfe, ${fehler.length} Fehler, ${dauer}s`
  );

  return NextResponse.json({
    von,
    bis,
    dauer,
    konten: alle.length,
    ok: true,
    erzeugt,
    uebernommen,
    uebersprungen,
    fehler,
  });
}
