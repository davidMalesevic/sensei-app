import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

/**
 * Passwort-Hashing mit scrypt aus `node:crypto`.
 *
 * Die Menüplanungs-App nimmt bcrypt; scrypt ist gleichwertig und steckt
 * bereits in Node — keine native Abhängigkeit, die im Docker-Build brechen
 * kann. Format: `scrypt$<salt-hex>$<hash-hex>`, damit ein späterer Wechsel
 * des Verfahrens am Präfix erkennbar bleibt.
 */
const KEYLEN = 64;
const SALT_BYTES = 16;

export async function hashePasswort(passwort: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = (await scryptAsync(passwort, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

/**
 * Vergleicht in konstanter Zeit — ein zeichenweiser Vergleich würde über die
 * Laufzeit verraten, wie weit ein geratenes Passwort stimmt.
 */
export async function pruefePasswort(
  passwort: string,
  gespeichert: string
): Promise<boolean> {
  const [verfahren, saltHex, hashHex] = gespeichert.split("$");
  if (verfahren !== "scrypt" || !saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, "hex");
  const erwartet = Buffer.from(hashHex, "hex");
  const berechnet = (await scryptAsync(passwort, salt, erwartet.length)) as Buffer;

  return (
    berechnet.length === erwartet.length && timingSafeEqual(berechnet, erwartet)
  );
}

/** Session-Token: 32 zufällige Bytes, urlsafe — wie in der Menüplanung. */
export function erzeugeSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Wie lange eine Anmeldung hält. */
export const SESSION_TAGE = 30;
export const SESSION_COOKIE = "sensei_session";

export function sessionLaeuftAb(): Date {
  return new Date(Date.now() + SESSION_TAGE * 24 * 60 * 60 * 1000);
}

/**
 * Mindestanforderung ans Passwort. Bewusst nur Länge: erzwungene Sonderzeichen
 * führen erfahrungsgemäss zu schlechteren, nicht besseren Passwörtern.
 */
export function passwortProblem(passwort: string): string | null {
  if (passwort.length < 10) {
    return "Das Passwort braucht mindestens 10 Zeichen.";
  }
  return null;
}

/** E-Mails werden kleingeschrieben gespeichert und verglichen. */
export function normalisiereEmail(email: string): string {
  return email.trim().toLowerCase();
}
