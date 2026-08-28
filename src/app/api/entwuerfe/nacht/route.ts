import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { erzeugeEntwuerfe } from "@/lib/entwurf";
import { schweizerDatumPlus, schweizerJetzt } from "@/lib/zeit";

/**
 * Vorbereitungsdurchgang.
 *
 * Bewusst als Route statt als Timer im App-Prozess: so wird der Lauf von einem
 * Cron auf dem VPS angestossen, überlebt jeden Neustart und ist von aussen
 * prüfbar. Siehe `erstellungsprozess.md`, Abschnitt 5.1.
 *
 * Der Cron ruft **stündlich** auf; wer wann drankommt, steht am Konto
 * (`vorbereitung_tag`, `vorbereitung_stunde`). Die Mittwochnacht war nur die
 * Gewohnheit einer einzelnen Person — jetzt stellt sie jede selbst ein.
 *
 * Die Route weist sich mit CRON_SECRET aus und hat kein Session-Cookie —
 * deshalb ruft sie die Engine aus `lib/entwurf.ts` direkt auf und nicht die
 * Server Actions.
 */
function autorisiert(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
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

  // `alle=1` ignoriert die eingestellten Zeitpunkte — für den Handbetrieb.
  const alleErzwingen = request.nextUrl.searchParams.get("alle") === "1";

  const jetzt = schweizerJetzt();
  const stundeJetzt = Number(jetzt.zeit.slice(0, 2));
  const wochentag = new Date(jetzt.datum + "T12:00:00").getDay();

  const konten = await db.query.benutzer.findMany({
    columns: {
      id: true,
      email: true,
      vorbereitungAktiv: true,
      vorbereitungTag: true,
      vorbereitungStunde: true,
      vorbereitungTageVoraus: true,
    },
  });

  const faellig = konten.filter((b) => {
    if (alleErzwingen) return true;
    if (!b.vorbereitungAktiv) return false;
    if (b.vorbereitungStunde !== stundeJetzt) return false;
    // NULL heisst «jeden Tag».
    return b.vorbereitungTag === null || b.vorbereitungTag === wochentag;
  });

  const start = Date.now();
  let erzeugt = 0;
  let uebernommen = 0;
  let uebersprungen = 0;
  const fehler: { sequenzId: string; grund: string }[] = [];

  for (const b of faellig) {
    const von = schweizerDatumPlus(0);
    const bis = schweizerDatumPlus(b.vorbereitungTageVoraus);

    // Ein Fehler in einem Konto darf die übrigen nicht mitreissen.
    try {
      const res = await erzeugeEntwuerfe(b.id, von, bis);
      erzeugt += res.erzeugt;
      uebernommen += res.uebernommen;
      uebersprungen += res.uebersprungen;
      fehler.push(...res.fehler);
      console.log(
        `[vorbereitung] ${b.email} (${von}–${bis}): ${res.erzeugt} Entwürfe, ` +
          `${res.uebernommen} übernommen, ${res.fehler.length} Fehler`
      );
    } catch (e) {
      console.error(`[vorbereitung] ${b.email} fehlgeschlagen:`, e);
      fehler.push({ sequenzId: "—", grund: `${b.email}: ${e}` });
    }
  }

  const dauer = Math.round((Date.now() - start) / 1000);
  console.log(
    `[vorbereitung] ${jetzt.datum} ${jetzt.zeit}: ${faellig.length} von ` +
      `${konten.length} Konten fällig, ${erzeugt} Entwürfe, ${dauer}s`
  );

  return NextResponse.json({
    zeitpunkt: `${jetzt.datum} ${jetzt.zeit}`,
    kontenGesamt: konten.length,
    kontenFaellig: faellig.length,
    dauer,
    ok: true,
    erzeugt,
    uebernommen,
    uebersprungen,
    fehler,
  });
}
