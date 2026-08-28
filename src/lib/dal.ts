import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { benutzer, session } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/auth";

export type AngemeldeterBenutzer = {
  id: string;
  email: string;
  name: string;
  bildungsplanId: string | null;
  istAdmin: boolean;
};

/**
 * Data Access Layer.
 *
 * Der `proxy.ts` prüft nur, *ob* ein Cookie da ist — das ist eine schnelle,
 * optimistische Vorfilterung. Die echte Prüfung passiert hier, bei jedem
 * Datenzugriff. `cache()` sorgt dafür, dass das pro Render nur einmal die
 * Datenbank fragt, auch wenn zehn Stellen danach fragen.
 *
 * Nichts in dieser App liest Daten, ohne vorher `aktuellerBenutzer()` oder
 * `benutzerIdOderRedirect()` aufzurufen.
 */
export const aktuelleSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const treffer = await db
    .select({
      benutzerId: benutzer.id,
      email: benutzer.email,
      name: benutzer.name,
      bildungsplanId: benutzer.bildungsplanId,
      istAdmin: benutzer.istAdmin,
    })
    .from(session)
    .innerJoin(benutzer, eq(session.benutzerId, benutzer.id))
    // Abgelaufene Sessions gelten sofort als ungültig, auch wenn die Zeile
    // noch in der Tabelle steht.
    .where(and(eq(session.token, token), gt(session.expiresAt, new Date())))
    .limit(1);

  const b = treffer[0];
  if (!b) return null;

  return {
    id: b.benutzerId,
    email: b.email,
    name: b.name,
    bildungsplanId: b.bildungsplanId,
    istAdmin: b.istAdmin,
  } satisfies AngemeldeterBenutzer;
});

/** Für Seiten und Server Actions: ohne Anmeldung geht es hier nicht weiter. */
export const aktuellerBenutzer = cache(
  async (): Promise<AngemeldeterBenutzer> => {
    const b = await aktuelleSession();
    if (!b) redirect("/anmelden");
    return b;
  }
);

/** Kurzform, weil fast jede Abfrage nur die ID braucht. */
export async function benutzerId(): Promise<string> {
  return (await aktuellerBenutzer()).id;
}

/**
 * Für die Verwaltung. Wer kein Admin ist, bekommt 404 statt 403 — eine
 * Seite, die man nicht betreten darf, muss nicht verraten, dass es sie gibt.
 */
export const aktuellerAdmin = cache(
  async (): Promise<AngemeldeterBenutzer> => {
    const b = await aktuellerBenutzer();
    if (!b.istAdmin) notFound();
    return b;
  }
);
