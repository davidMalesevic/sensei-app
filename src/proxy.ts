import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth";

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
const OEFFENTLICH = ["/anmelden", "/registrieren"];

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

  if (angemeldet && istOeffentlich) {
    return NextResponse.redirect(new URL("/", request.nextUrl));
  }

  return NextResponse.next();
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
