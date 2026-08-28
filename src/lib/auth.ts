import "server-only";

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
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

/**
 * Einmal-Token für Einladungen und Passwort-Rücksetzung.
 *
 * In der Datenbank steht nur der SHA-256-Hash: wer sie liest, hält damit
 * keinen funktionierenden Link in der Hand. Der Klartext existiert genau
 * einmal — in dem Link, den der Admin weitergibt. SHA-256 genügt hier, weil
 * das Token 32 zufällige Bytes hat und nicht erraten werden kann; ein
 * langsames Verfahren wie bei Passwörtern braucht es dafür nicht.
 */
export function erzeugeEinmalToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Wie lange eine Einladung offen bleibt. */
export const EINLADUNG_TAGE = 7;
/** Wie lange ein Passwort-Link gilt. */
export const RESET_STUNDEN = 24;

export function inTagen(tage: number): Date {
  return new Date(Date.now() + tage * 24 * 60 * 60 * 1000);
}

export function inStunden(stunden: number): Date {
  return new Date(Date.now() + stunden * 60 * 60 * 1000);
}
