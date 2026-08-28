"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import { benutzer, bildungsplan, einladung, passwortReset, session } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TAGE,
  erzeugeSessionToken,
  hashePasswort,
  normalisiereEmail,
  passwortProblem,
  pruefePasswort,
  sessionLaeuftAb,
  tokenHash,
} from "@/lib/auth";

export type AuthZustand = { fehler?: string };

/** Nur relative Pfade — sonst wäre `?weiter=` eine offene Weiterleitung. */
function sicheresZiel(weiter: unknown): string {
  const w = typeof weiter === "string" ? weiter : "";
  return w.startsWith("/") && !w.startsWith("//") ? w : "/";
}

async function sessionSetzen(benutzerId: string) {
  const token = erzeugeSessionToken();

  await db.insert(session).values({
    token,
    benutzerId,
    expiresAt: sessionLaeuftAb(),
  });
  await db
    .update(benutzer)
    .set({ letzteAnmeldung: new Date() })
    .where(eq(benutzer.id, benutzerId));

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Hinter Nginx mit Let's Encrypt läuft alles über HTTPS; lokal nicht.
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TAGE * 24 * 60 * 60,
  });
}

export async function anmelden(
  _zustand: AuthZustand,
  formData: FormData
): Promise<AuthZustand> {
  const email = normalisiereEmail(String(formData.get("email") ?? ""));
  const passwort = String(formData.get("passwort") ?? "");

  if (!email || !passwort) {
    return { fehler: "Bitte E-Mail und Passwort eingeben." };
  }

  const gefunden = await db.query.benutzer.findFirst({
    where: eq(benutzer.email, email),
    columns: { id: true, passwortHash: true },
  });

  // Bewusst dieselbe Meldung für «Konto gibt es nicht» und «Passwort falsch» —
  // sonst verrät das Formular, welche E-Mails registriert sind.
  const stimmt =
    gefunden !== undefined &&
    (await pruefePasswort(passwort, gefunden.passwortHash));

  if (!stimmt) {
    return { fehler: "E-Mail oder Passwort stimmt nicht." };
  }

  await sessionSetzen(gefunden.id);
  redirect(sicheresZiel(formData.get("weiter")));
}

// ─── Einladung annehmen ───────────────────────────────────────────────────

/** Die offene Einladung zu einem Token, oder null. */
export async function pruefeEinladung(token: string) {
  const eintrag = await db.query.einladung.findFirst({
    where: and(
      eq(einladung.tokenHash, tokenHash(token)),
      isNull(einladung.verwendetAm),
      gt(einladung.expiresAt, new Date())
    ),
    columns: { email: true, expiresAt: true },
  });
  return eintrag ?? null;
}

/**
 * Konto aus einer Einladung anlegen. Es gibt keinen anderen Weg mehr herein —
 * der frühere gemeinsame REGISTRIERUNG_CODE ist entfallen.
 */
export async function einladungAnnehmen(
  _zustand: AuthZustand,
  formData: FormData
): Promise<AuthZustand> {
  const token = String(formData.get("token") ?? "");
  const hash = tokenHash(token);

  const offen = await db.query.einladung.findFirst({
    where: and(
      eq(einladung.tokenHash, hash),
      isNull(einladung.verwendetAm),
      gt(einladung.expiresAt, new Date())
    ),
  });
  if (!offen) {
    return { fehler: "Diese Einladung ist abgelaufen oder schon verwendet." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const passwort = String(formData.get("passwort") ?? "");
  const planWahl = String(formData.get("bildungsplan") ?? "eigener");

  if (!name) return { fehler: "Bitte einen Namen eintragen." };

  const problem = passwortProblem(passwort);
  if (problem) return { fehler: problem };

  // Die E-Mail kommt aus der Einladung, nicht aus dem Formular — sonst könnte
  // man sich mit einem fremden Link eine beliebige Adresse eintragen.
  const email = normalisiereEmail(offen.email);

  const schonDa = await db.query.benutzer.findFirst({
    where: eq(benutzer.email, email),
    columns: { id: true },
  });
  if (schonDa) {
    return { fehler: "Für diese E-Mail gibt es bereits ein Konto." };
  }

  const neu = await db
    .insert(benutzer)
    .values({ email, name, passwortHash: await hashePasswort(passwort) })
    .returning({ id: benutzer.id });

  const benutzerId = neu[0].id;

  if (planWahl === "eigener") {
    const eigener = await db
      .insert(bildungsplan)
      .values({
        benutzerId,
        bezeichnung: `Bildungsplan ${name}`,
        berufsnummer: "—",
        version: "eigen",
      })
      .returning({ id: bildungsplan.id });

    await db
      .update(benutzer)
      .set({ bildungsplanId: eigener[0].id })
      .where(eq(benutzer.id, benutzerId));
  } else {
    // Nur geteilte Pläne sind wählbar — ein untergeschobener Fremd-Plan wird
    // hier abgewiesen.
    const geteilt = await db.query.bildungsplan.findFirst({
      where: eq(bildungsplan.id, planWahl),
      columns: { id: true, benutzerId: true },
    });
    if (geteilt && geteilt.benutzerId === null) {
      await db
        .update(benutzer)
        .set({ bildungsplanId: geteilt.id })
        .where(eq(benutzer.id, benutzerId));
    }
  }

  // Einladung entwerten — sie gilt genau einmal.
  await db
    .update(einladung)
    .set({ verwendetAm: new Date(), benutzerId })
    .where(eq(einladung.tokenHash, hash));

  await sessionSetzen(benutzerId);
  redirect("/");
}

// ─── Passwort über Einmal-Link setzen ─────────────────────────────────────

export async function pruefeResetToken(token: string) {
  const eintrag = await db.query.passwortReset.findFirst({
    where: and(
      eq(passwortReset.tokenHash, tokenHash(token)),
      isNull(passwortReset.verwendetAm),
      gt(passwortReset.expiresAt, new Date())
    ),
    columns: { benutzerId: true },
    with: { benutzer: { columns: { email: true, name: true } } },
  });
  return eintrag ?? null;
}

export async function neuesPasswortSetzen(
  _zustand: AuthZustand,
  formData: FormData
): Promise<AuthZustand> {
  const token = String(formData.get("token") ?? "");
  const hash = tokenHash(token);

  const offen = await db.query.passwortReset.findFirst({
    where: and(
      eq(passwortReset.tokenHash, hash),
      isNull(passwortReset.verwendetAm),
      gt(passwortReset.expiresAt, new Date())
    ),
  });
  if (!offen) {
    return { fehler: "Dieser Link ist abgelaufen oder schon verwendet." };
  }

  const passwort = String(formData.get("passwort") ?? "");
  const wiederholung = String(formData.get("wiederholung") ?? "");

  const problem = passwortProblem(passwort);
  if (problem) return { fehler: problem };
  if (passwort !== wiederholung) {
    return { fehler: "Die beiden Passwörter stimmen nicht überein." };
  }

  await db
    .update(benutzer)
    .set({ passwortHash: await hashePasswort(passwort), updatedAt: new Date() })
    .where(eq(benutzer.id, offen.benutzerId));

  await db
    .update(passwortReset)
    .set({ verwendetAm: new Date() })
    .where(eq(passwortReset.tokenHash, hash));

  // Wer das Passwort zurücksetzt, hat womöglich den Zugang verloren — alle
  // bestehenden Sitzungen dieses Kontos werden beendet.
  await db.delete(session).where(eq(session.benutzerId, offen.benutzerId));

  await sessionSetzen(offen.benutzerId);
  redirect("/");
}

export async function abmelden() {
  const laden = await cookies();
  const token = laden.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.delete(session).where(eq(session.token, token));
  }
  laden.delete(SESSION_COOKIE);

  redirect("/anmelden");
}

/** Die geteilten Pläne, die bei der Kontoerstellung zur Wahl stehen. */
export async function getGeteilteBildungsplaene() {
  return db.query.bildungsplan.findMany({
    where: (b, { isNull: leer }) => leer(b.benutzerId),
    columns: { id: true, bezeichnung: true, version: true },
  });
}
