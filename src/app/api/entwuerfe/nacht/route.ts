import { NextRequest, NextResponse } from "next/server";
import { erzeugeEntwuerfe } from "@/app/sequenzen/entwurf-actions";

/**
 * Nachtlauf für die Ablaufentwürfe.
 *
 * Bewusst als Route statt als Timer im App-Prozess: so wird der Lauf von einem
 * Cron auf dem VPS angestossen, überlebt jeden Neustart und ist von aussen
 * prüfbar. Siehe `erstellungsprozess.md`, Abschnitt 5.1.
 *
 * Standardfenster sind die nächsten 10 Tage — das deckt Donnerstag, Freitag und
 * den folgenden Dienstag ab.
 */
const TAGE_VORAUS = 10;

function autorisiert(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function datumPlus(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return d.toISOString().slice(0, 10);
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

  const von = datumPlus(0);
  const bis = datumPlus(TAGE_VORAUS);

  const start = Date.now();
  const ergebnis = await erzeugeEntwuerfe(von, bis);
  const dauer = Math.round((Date.now() - start) / 1000);

  console.log(
    `[nachtlauf] ${von} bis ${bis}: ${ergebnis.erzeugt} Entwürfe, ` +
      `${ergebnis.fehler.length} Fehler, ${dauer}s`
  );

  return NextResponse.json({ von, bis, dauer, ...ergebnis });
}
