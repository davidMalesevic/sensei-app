"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { benutzer, session } from "@/db/schema";
import {
  SESSION_COOKIE,
  hashePasswort,
  normalisiereEmail,
  passwortProblem,
  pruefePasswort,
} from "@/lib/auth";
import { aktuellerBenutzer } from "@/lib/dal";

export type KontoZustand = { fehler?: string; hinweis?: string };

export async function speichereProfil(
  _zustand: KontoZustand,
  formData: FormData
): Promise<KontoZustand> {
  const ich = await aktuellerBenutzer();
  const name = String(formData.get("name") ?? "").trim();
  const email = normalisiereEmail(String(formData.get("email") ?? ""));

  if (!name) return { fehler: "Bitte einen Namen eintragen." };
  if (!email.includes("@")) return { fehler: "Bitte eine gültige E-Mail eintragen." };

  const belegt = await db.query.benutzer.findFirst({
    where: and(eq(benutzer.email, email), ne(benutzer.id, ich.id)),
    columns: { id: true },
  });
  if (belegt) return { fehler: "Diese E-Mail gehört bereits zu einem Konto." };

  await db
    .update(benutzer)
    .set({ name, email, updatedAt: new Date() })
    .where(eq(benutzer.id, ich.id));

  revalidatePath("/mein-konto");
  return { hinweis: "Gespeichert." };
}

export async function aenderePasswort(
  _zustand: KontoZustand,
  formData: FormData
): Promise<KontoZustand> {
  const ich = await aktuellerBenutzer();

  const alt = String(formData.get("alt") ?? "");
  const neu = String(formData.get("neu") ?? "");
  const wiederholung = String(formData.get("wiederholung") ?? "");

  const konto = await db.query.benutzer.findFirst({
    where: eq(benutzer.id, ich.id),
    columns: { passwortHash: true },
  });
  if (!konto || !(await pruefePasswort(alt, konto.passwortHash))) {
    return { fehler: "Das bisherige Passwort stimmt nicht." };
  }

  const problem = passwortProblem(neu);
  if (problem) return { fehler: problem };
  if (neu !== wiederholung) {
    return { fehler: "Die beiden neuen Passwörter stimmen nicht überein." };
  }

  await db
    .update(benutzer)
    .set({ passwortHash: await hashePasswort(neu), updatedAt: new Date() })
    .where(eq(benutzer.id, ich.id));

  // Andere Geräte werden abgemeldet, die aktuelle Sitzung bleibt bestehen —
  // sonst würde man sich beim Passwortwechsel selbst hinauswerfen.
  const dieses = (await cookies()).get(SESSION_COOKIE)?.value;
  if (dieses) {
    await db
      .delete(session)
      .where(and(eq(session.benutzerId, ich.id), ne(session.token, dieses)));
  }

  revalidatePath("/mein-konto");
  return { hinweis: "Passwort geändert. Andere Geräte wurden abgemeldet." };
}

/**
 * Wann der Vorbereitungsdurchgang für dieses Konto läuft.
 *
 * Der Cron auf dem Server fragt stündlich nach; hier steht, wann jemand
 * drankommen möchte. Die Mittwochnacht war nie mehr als eine Vorgabe.
 */
export async function speichereVorbereitung(
  _zustand: KontoZustand,
  formData: FormData
): Promise<KontoZustand> {
  const ich = await aktuellerBenutzer();

  const aktiv = formData.get("aktiv") === "an";
  const tagRoh = String(formData.get("tag") ?? "taeglich");
  const stunde = Number(formData.get("stunde") ?? 3);
  const tageVoraus = Number(formData.get("tageVoraus") ?? 10);

  if (!Number.isInteger(stunde) || stunde < 0 || stunde > 23) {
    return { fehler: "Die Stunde muss zwischen 0 und 23 liegen." };
  }
  if (!Number.isInteger(tageVoraus) || tageVoraus < 1 || tageVoraus > 60) {
    return { fehler: "Der Vorlauf muss zwischen 1 und 60 Tagen liegen." };
  }

  const tag = tagRoh === "taeglich" ? null : Number(tagRoh);
  if (tag !== null && (!Number.isInteger(tag) || tag < 0 || tag > 6)) {
    return { fehler: "Ungültiger Wochentag." };
  }

  await db
    .update(benutzer)
    .set({
      vorbereitungAktiv: aktiv,
      vorbereitungTag: tag,
      vorbereitungStunde: stunde,
      vorbereitungTageVoraus: tageVoraus,
      updatedAt: new Date(),
    })
    .where(eq(benutzer.id, ich.id));

  revalidatePath("/mein-konto");
  return { hinweis: "Gespeichert." };
}

export async function getMeinKonto() {
  const ich = await aktuellerBenutzer();
  const konto = await db.query.benutzer.findFirst({
    where: eq(benutzer.id, ich.id),
    columns: {
      name: true,
      email: true,
      istAdmin: true,
      createdAt: true,
      vorbereitungAktiv: true,
      vorbereitungTag: true,
      vorbereitungStunde: true,
      vorbereitungTageVoraus: true,
    },
  });
  return konto!;
}
