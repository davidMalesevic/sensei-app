import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

/** Der Proxy reicht diese beiden Angaben ans Root-Layout weiter. */
export const PFAD_HEADER = "x-sensei-pfad";
export const OEFFENTLICH_HEADER = "x-sensei-oeffentlich";

/**
 * In Next.js 16 heisst die frühere `middleware.ts` **`proxy.ts`**.
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 *
 * Hier steht bewusst nur eine *optimistische* Prüfung: gibt es überhaupt ein
 * Session-Cookie? Der Proxy läuft bei jedem Request, auch bei vorgeladenen
 * Routen — eine Datenbankabfrage an dieser Stelle würde die ganze App
 * ausbremsen. Ob die Session gültig ist und wem sie gehört, prüft
 * `src/lib/dal.ts` bei jedem Datenzugriff.
 */
const OEFFENTLICH = [
  "/anmelden",
  // Einladungs- und Passwort-Links müssen ohne Anmeldung erreichbar sein —
  // wer sie öffnet, hat ja gerade noch kein Konto bzw. keinen Zugang.
  "/einladung",
  "/neues-passwort",
];

export function proxy(request: NextRequest) {
  const pfad = request.nextUrl.pathname;
  const angemeldet = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const istOeffentlich = OEFFENTLICH.some(
    (p) => pfad === p || pfad.startsWith(`${p}/`)
  );

  if (!angemeldet && !istOeffentlich) {
    const ziel = new URL("/anmelden", request.nextUrl);
    // Nach dem Anmelden dorthin zurück, wo man hinwollte.
    if (pfad !== "/") ziel.searchParams.set("weiter", pfad + request.nextUrl.search);
    return NextResponse.redirect(ziel);
  }

  // Der Pfad wandert als Header weiter, damit das Root-Layout weiss, ob es
  // die UI Shell zeichnen soll. Die Next-Doku nennt Header ausdrücklich als
  // den Weg, Information aus dem Proxy in die Anwendung zu geben — ein Layout
  // kennt den Pfad sonst nicht.
  const weiter = new Headers(request.headers);
  weiter.set(PFAD_HEADER, pfad);
  weiter.set(OEFFENTLICH_HEADER, istOeffentlich ? "1" : "0");

  // Bewusst KEINE Gegenregel «Cookie da → weg von der Anmeldeseite».
  //
  // Der Proxy weiss nur, *dass* ein Cookie existiert, nicht ob die Sitzung
  // noch gilt. Mit einem abgelaufenen Cookie entstünde sonst eine Schleife:
  // `/` schickt zur Anmeldung (die Sitzung ist ungültig), der Proxy schickt
  // zurück auf `/` (ein Cookie ist ja da), und so weiter. Das trifft jeden,
  // dessen Sitzung abläuft oder dem ein Admin die Sitzungen beendet hat.
  //
  // Ob jemand bereits angemeldet ist, entscheidet deshalb die Anmeldeseite
  // selbst — dort wird die Sitzung wirklich geprüft.
  return NextResponse.next({ request: { headers: weiter } });
}

export const config = {
  matcher: [
    /**
     * Alles ausser:
     * - `_next/*` (Build-Ausgabe) und statischen Dateien
     * - `/api/entwuerfe/nacht` — der Nachtlauf weist sich mit CRON_SECRET aus
     *   und hat kein Cookie; er darf hier nicht abgefangen werden.
     *
     * `/api/files` und `/api/upload` sind bewusst NICHT ausgenommen: dort
     * liegen die hochgeladenen Modulunterlagen.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/entwuerfe/nacht).*)",
  ],
};
