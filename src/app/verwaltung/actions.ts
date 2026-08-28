"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";

import { db } from "@/db";
import {
  benutzer,
  einladung,
  klasse,
  material,
  modul,
  passwortReset,
  sequenz,
  session,
} from "@/db/schema";
import {
  EINLADUNG_TAGE,
  RESET_STUNDEN,
  erzeugeEinmalToken,
  inStunden,
  inTagen,
  normalisiereEmail,
  tokenHash,
} from "@/lib/auth";
import { aktuellerAdmin } from "@/lib/dal";

export type VerwaltungZustand = { fehler?: string; link?: string; hinweis?: string };

/**
 * Verwaltung. Jede Funktion beginnt mit `aktuellerAdmin()` — wer kein Admin
 * ist, bekommt 404. Server Actions sind vom Browser aufrufbar, die Prüfung
 * darf deshalb nie nur in der Seite stehen.
 */

export async function getKonten() {
  await aktuellerAdmin();

  const konten = await db
    .select({
      id: benutzer.id,
      email: benutzer.email,
      name: benutzer.name,
      istAdmin: benutzer.istAdmin,
      createdAt: benutzer.createdAt,
      letzteAnmeldung: benutzer.letzteAnmeldung,
    })
    .from(benutzer)
    .orderBy(benutzer.createdAt);

  // Pro Konto: was daran hängt und wie viele Sitzungen offen sind.
  return Promise.all(
    konten.map(async (k) => {
      const [[kl], [se], [mo], [ma], [si]] = await Promise.all([
        db.select({ n: count() }).from(klasse).where(eq(klasse.benutzerId, k.id)),
        db.select({ n: count() }).from(sequenz).where(eq(sequenz.benutzerId, k.id)),
        db.select({ n: count() }).from(modul).where(eq(modul.benutzerId, k.id)),
        db.select({ n: count() }).from(material).where(eq(material.benutzerId, k.id)),
        db
          .select({ n: count() })
          .from(session)
          .where(and(eq(session.benutzerId, k.id), gt(session.expiresAt, new Date()))),
      ]);
      return {
        ...k,
        klassen: kl.n,
        sequenzen: se.n,
        module: mo.n,
        materialien: ma.n,
        sitzungen: si.n,
      };
    })
  );
}

export async function getOffeneEinladungen() {
  await aktuellerAdmin();

  return db
    .select({
      tokenHash: einladung.tokenHash,
      email: einladung.email,
      createdAt: einladung.createdAt,
      expiresAt: einladung.expiresAt,
    })
    .from(einladung)
    .where(and(isNull(einladung.verwendetAm), gt(einladung.expiresAt, new Date())))
    .orderBy(desc(einladung.createdAt));
}

/** Erzeugt eine Einladung und gibt den Link **einmalig** zurück. */
export async function ladeEin(
  _zustand: VerwaltungZustand,
  formData: FormData
): Promise<VerwaltungZustand> {
  const admin = await aktuellerAdmin();
  const email = normalisiereEmail(String(formData.get("email") ?? ""));

  if (!email || !email.includes("@")) {
    return { fehler: "Bitte eine gültige E-Mail eintragen." };
  }

  const schonKonto = await db.query.benutzer.findFirst({
    where: eq(benutzer.email, email),
    columns: { id: true },
  });
  if (schonKonto) {
    return { fehler: `Für ${email} gibt es bereits ein Konto.` };
  }

  // Eine frühere offene Einladung an dieselbe Adresse wird entwertet — sonst
  // wären zwei Links gleichzeitig gültig.
  await db
    .delete(einladung)
    .where(and(eq(einladung.email, email), isNull(einladung.verwendetAm)));

  const token = erzeugeEinmalToken();
  await db.insert(einladung).values({
    tokenHash: tokenHash(token),
    email,
    erstelltVon: admin.id,
    expiresAt: inTagen(EINLADUNG_TAGE),
  });

  revalidatePath("/verwaltung");

  // Der Klartext existiert nur hier — in der Datenbank steht nur sein Hash.
  return {
    link: `/einladung/${token}`,
    hinweis: `Einladung für ${email}, ${EINLADUNG_TAGE} Tage gültig.`,
  };
}

export async function nimmEinladungZurueck(tokenHashWert: string) {
  await aktuellerAdmin();
  await db.delete(einladung).where(eq(einladung.tokenHash, tokenHashWert));
  revalidatePath("/verwaltung");
}

/** Einmal-Link zum Setzen eines neuen Passworts — der Admin sieht es nie. */
export async function setzePasswortZurueck(
  _zustand: VerwaltungZustand,
  formData: FormData
): Promise<VerwaltungZustand> {
  await aktuellerAdmin();
  const zielId = String(formData.get("benutzerId") ?? "");

  const ziel = await db.query.benutzer.findFirst({
    where: eq(benutzer.id, zielId),
    columns: { id: true, email: true },
  });
  if (!ziel) return { fehler: "Konto nicht gefunden." };

  await db.delete(passwortReset).where(eq(passwortReset.benutzerId, ziel.id));

  const token = erzeugeEinmalToken();
  await db.insert(passwortReset).values({
    tokenHash: tokenHash(token),
    benutzerId: ziel.id,
    expiresAt: inStunden(RESET_STUNDEN),
  });

  revalidatePath("/verwaltung");
  return {
    link: `/neues-passwort/${token}`,
    hinweis: `Passwort-Link für ${ziel.email}, ${RESET_STUNDEN} Stunden gültig.`,
  };
}

export async function beendeSitzungen(zielId: string) {
  await aktuellerAdmin();
  await db.delete(session).where(eq(session.benutzerId, zielId));
  revalidatePath("/verwaltung");
}

export async function setzeAdmin(zielId: string, istAdmin: boolean) {
  const admin = await aktuellerAdmin();

  if (!istAdmin) {
    // Ohne Admin käme niemand mehr in die Verwaltung.
    const [{ n }] = await db
      .select({ n: count() })
      .from(benutzer)
      .where(eq(benutzer.istAdmin, true));
    if (n <= 1) return;
    if (zielId === admin.id) return;
  }

  await db
    .update(benutzer)
    .set({ istAdmin, updatedAt: new Date() })
    .where(eq(benutzer.id, zielId));
  revalidatePath("/verwaltung");
}

/**
 * Konto samt allen Daten löschen. Die Fremdschlüssel stehen auf CASCADE —
 * Klassen, Sequenzen, Module, Material und Pendenzen gehen mit.
 *
 * Zur Bestätigung muss die E-Mail getippt werden; ein Klick allein reicht für
 * etwas Unwiederbringliches nicht.
 */
export async function loescheKonto(
  _zustand: VerwaltungZustand,
  formData: FormData
): Promise<VerwaltungZustand> {
  const admin = await aktuellerAdmin();
  const zielId = String(formData.get("benutzerId") ?? "");
  const bestaetigung = normalisiereEmail(String(formData.get("bestaetigung") ?? ""));

  if (zielId === admin.id) {
    return { fehler: "Das eigene Konto lässt sich hier nicht löschen." };
  }

  const ziel = await db.query.benutzer.findFirst({
    where: eq(benutzer.id, zielId),
    columns: { id: true, email: true },
  });
  if (!ziel) return { fehler: "Konto nicht gefunden." };

  if (bestaetigung !== ziel.email) {
    return { fehler: "Die getippte E-Mail stimmt nicht mit dem Konto überein." };
  }

  await db.delete(benutzer).where(eq(benutzer.id, ziel.id));

  revalidatePath("/verwaltung");
  return { hinweis: `${ziel.email} wurde mit allen Daten gelöscht.` };
}

/** Zahlen für die Kopfzeile der Verwaltung. */
export async function getVerwaltungZahlen() {
  await aktuellerAdmin();
  const [[k], [s], [e]] = await Promise.all([
    db.select({ n: count() }).from(benutzer),
    db
      .select({ n: count() })
      .from(session)
      .where(gt(session.expiresAt, new Date())),
    db
      .select({ n: count() })
      .from(einladung)
      .where(and(isNull(einladung.verwendetAm), gt(einladung.expiresAt, new Date()))),
  ]);
  return { konten: k.n, sitzungen: s.n, einladungen: e.n };
}
