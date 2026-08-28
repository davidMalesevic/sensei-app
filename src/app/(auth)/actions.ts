"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { benutzer, bildungsplan, session } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_TAGE,
  erzeugeSessionToken,
  hashePasswort,
  normalisiereEmail,
  passwortProblem,
  pruefePasswort,
  sessionLaeuftAb,
} from "@/lib/auth";

export type AuthZustand = { fehler?: string };

/** Nur relative Pfade — sonst wäre `?weiter=` eine offene Weiterleitung. */
function sicheresZiel(weiter: unknown): string {
  const w = typeof weiter === "string" ? weiter : "";
  return w.startsWith("/") && !w.startsWith("//") ? w : "/";
}

async function sessionSetzen(benutzerId: string) {
  const token = erzeugeSessionToken();
  const laeuftAb = sessionLaeuftAb();

  await db.insert(session).values({ token, benutzerId, expiresAt: laeuftAb });

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

export async function registrieren(
  _zustand: AuthZustand,
  formData: FormData
): Promise<AuthZustand> {
  const code = String(formData.get("code") ?? "").trim();
  const erwartet = process.env.REGISTRIERUNG_CODE;

  if (!erwartet) {
    return {
      fehler:
        "Registrierung ist nicht eingerichtet — REGISTRIERUNG_CODE fehlt auf dem Server.",
    };
  }
  if (code !== erwartet) {
    return { fehler: "Der Einladungscode stimmt nicht." };
  }

  const email = normalisiereEmail(String(formData.get("email") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const passwort = String(formData.get("passwort") ?? "");
  const planWahl = String(formData.get("bildungsplan") ?? "eigener");

  if (!email || !name) {
    return { fehler: "Bitte Name und E-Mail ausfüllen." };
  }

  const problem = passwortProblem(passwort);
  if (problem) return { fehler: problem };

  const schonDa = await db.query.benutzer.findFirst({
    where: eq(benutzer.email, email),
    columns: { id: true },
  });
  if (schonDa) {
    return { fehler: "Für diese E-Mail gibt es bereits ein Konto." };
  }

  const passwortHash = await hashePasswort(passwort);

  const neu = await db
    .insert(benutzer)
    .values({ email, name, passwortHash })
    .returning({ id: benutzer.id });

  const benutzerId = neu[0].id;

  if (planWahl === "eigener") {
    // Ein leerer eigener Plan — die Person füllt ihn selbst.
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
    // Ein bestehender geteilter Plan. Nur geteilte sind wählbar — ein
    // untergeschobener Fremd-Plan wird hier abgewiesen.
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

  await sessionSetzen(benutzerId);
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

/** Die geteilten Pläne, die bei der Registrierung zur Wahl stehen. */
export async function getGeteilteBildungsplaene() {
  return db.query.bildungsplan.findMany({
    where: (b, { isNull }) => isNull(b.benutzerId),
    columns: { id: true, bezeichnung: true, version: true },
  });
}
