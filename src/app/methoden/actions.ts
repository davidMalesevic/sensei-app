"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  methode,
  methodeAusgeschaltet,
  type MethodenParameter,
} from "@/db/schema";
import bibliotheksDatei from "@/db/daten/vorwissen-methoden.json";
import { aktuellerAdmin, aktuellerBenutzer, benutzerId } from "@/lib/dal";
import {
  ladeBibliothek,
  leseMethodenEin,
  pruefeMethodenDatei,
} from "@/lib/methoden";
import { pruefeAnweisung } from "@/lib/methoden-vorlage";

export type MethodenZustand = { fehler?: string; hinweis?: string };

/**
 * Methodenbibliothek. Geteilte Methoden ändert nur ein Admin, und nur wenn
 * er das ausdrücklich will («für alle speichern»). Jede andere Änderung an
 * einer geteilten Methode wird zur eigenen Fassung.
 */

// ─── Einlesen ────────────────────────────────────────────────────────────────

export async function bibliothekEinlesen(
  _vorher: MethodenZustand,
  formData: FormData
): Promise<MethodenZustand> {
  await aktuellerAdmin();

  let roh: unknown = bibliotheksDatei;
  const datei = formData.get("datei");
  if (datei instanceof File && datei.size > 0) {
    try {
      roh = JSON.parse(await datei.text());
    } catch {
      return { fehler: "Die Datei ist kein gültiges JSON." };
    }
  }

  try {
    const ergebnis = await leseMethodenEin(pruefeMethodenDatei(roh), {
      ueberschreiben: formData.get("ueberschreiben") === "on",
    });
    revalidatePath("/methoden");
    const teile = [
      `${ergebnis.neu} neu`,
      ergebnis.aktualisiert > 0 && `${ergebnis.aktualisiert} überschrieben`,
      ergebnis.uebersprungen > 0 &&
        `${ergebnis.uebersprungen} unverändert gelassen`,
    ].filter(Boolean);
    let hinweis = `Bibliothek eingelesen: ${teile.join(", ")}.`;
    if (ergebnis.fehlenInDatei.length > 0) {
      hinweis += ` Nicht in der Datei, aber noch vorhanden: ${ergebnis.fehlenInDatei.join(", ")}.`;
    }
    return { hinweis };
  } catch (e) {
    return { fehler: (e as Error).message };
  }
}

// ─── Speichern ───────────────────────────────────────────────────────────────

type Formularwerte = Omit<
  typeof methode.$inferInsert,
  "id" | "benutzerId" | "schluessel" | "basisId" | "createdAt" | "updatedAt"
>;

function ganzzahl(formData: FormData, feld: string): number {
  const n = Number(formData.get(feld));
  return Number.isInteger(n) ? n : NaN;
}

async function leseFormular(
  formData: FormData
): Promise<{ werte: Formularwerte } | { fehler: string }> {
  const bibliothek = await ladeBibliothek();
  if (!bibliothek) return { fehler: "Die Bibliothek ist noch nicht eingelesen." };

  const name = String(formData.get("name") ?? "").trim();
  const kategorie = String(formData.get("kategorie") ?? "");
  const schwerpunkt = String(formData.get("schwerpunkt") ?? "");
  const kurzbeschreibung = String(formData.get("kurzbeschreibung") ?? "").trim();
  const anweisung = String(formData.get("anweisung") ?? "").trim();
  const material = String(formData.get("material") ?? "")
    .split("\n")
    .map((z) => z.trim())
    .filter(Boolean);
  const dauerMin = ganzzahl(formData, "dauerMin");
  const dauerMax = ganzzahl(formData, "dauerMax");
  const dauerStandard = ganzzahl(formData, "dauerStandard");

  let sozialform: string[];
  let parameter: MethodenParameter[];
  try {
    sozialform = JSON.parse(String(formData.get("sozialform") ?? "[]"));
    parameter = JSON.parse(String(formData.get("parameter") ?? "[]"));
  } catch {
    return { fehler: "Sozialform oder Parameter sind unlesbar." };
  }

  if (!name) return { fehler: "Der Name fehlt." };
  if (!bibliothek.kategorien.some((k) => k.id === kategorie)) {
    return { fehler: "Bitte eine Kategorie wählen." };
  }
  if (!(schwerpunkt in bibliothek.schwerpunkte)) {
    return { fehler: "Bitte einen Schwerpunkt wählen." };
  }
  if (sozialform.length === 0) {
    return { fehler: "Mindestens eine Sozialform wählen." };
  }
  if (sozialform.some((s) => !(s in bibliothek.sozialformen))) {
    return { fehler: "Unbekannte Sozialform." };
  }
  if (
    ![dauerMin, dauerMax, dauerStandard].every((n) => n >= 1) ||
    dauerMin > dauerStandard ||
    dauerStandard > dauerMax
  ) {
    return {
      fehler: "Dauer: ganze Minuten, und es muss gelten min ≤ Standard ≤ max.",
    };
  }
  if (!kurzbeschreibung) return { fehler: "Die Kurzbeschreibung fehlt." };
  if (!anweisung) return { fehler: "Die Anweisung fehlt." };

  const namen = new Set<string>();
  for (const p of parameter) {
    if (!/^[a-z][a-z0-9_]*$/.test(p.name)) {
      return {
        fehler: `Parametername «${p.name}»: nur Kleinbuchstaben, Ziffern und _, beginnend mit einem Buchstaben.`,
      };
    }
    if (namen.has(p.name)) return { fehler: `Parameter «${p.name}» ist doppelt.` };
    namen.add(p.name);
    if (
      ![p.min, p.max, p.default].every(Number.isInteger) ||
      p.min > p.default ||
      p.default > p.max
    ) {
      return {
        fehler: `Parameter «${p.name}»: ganze Zahlen, und es muss gelten min ≤ Vorgabe ≤ max.`,
      };
    }
    p.typ = "integer";
    p.beschreibung = String(p.beschreibung ?? "").trim();
  }

  const anweisungsFehler = pruefeAnweisung(anweisung, parameter);
  if (anweisungsFehler) return { fehler: anweisungsFehler };

  return {
    werte: {
      name,
      kategorie,
      schwerpunkt,
      sozialform,
      dauerMin,
      dauerMax,
      dauerStandard,
      kurzbeschreibung,
      material,
      parameter,
      anweisung,
    },
  };
}

function neuerSchluessel(name: string): string {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
  return `eigen_${slug || "methode"}_${randomBytes(3).toString("hex")}`;
}

/**
 * `ziel` = «geteilt» speichert eine geteilte Methode für alle (nur Admins).
 * Sonst entsteht bzw. ändert sich die eigene Fassung.
 */
export async function methodeSpeichern(
  _vorher: MethodenZustand,
  formData: FormData
): Promise<MethodenZustand> {
  const ich = await aktuellerBenutzer();
  const gelesen = await leseFormular(formData);
  if ("fehler" in gelesen) return gelesen;
  const { werte } = gelesen;

  const id = String(formData.get("id") ?? "");
  let zielId: string;

  if (!id) {
    const [neu] = await db
      .insert(methode)
      .values({
        ...werte,
        benutzerId: ich.id,
        schluessel: neuerSchluessel(werte.name),
        sortierung: 10_000,
      })
      .returning({ id: methode.id });
    zielId = neu.id;
  } else {
    const alt = await db.query.methode.findFirst({
      where: and(
        eq(methode.id, id),
        or(isNull(methode.benutzerId), eq(methode.benutzerId, ich.id))
      ),
    });
    if (!alt) return { fehler: "Methode nicht gefunden." };

    if (alt.benutzerId === ich.id) {
      await db
        .update(methode)
        .set({ ...werte, updatedAt: new Date() })
        .where(and(eq(methode.id, alt.id), eq(methode.benutzerId, ich.id)));
      zielId = alt.id;
    } else if (formData.get("ziel") === "geteilt") {
      if (!ich.istAdmin) return { fehler: "Nur Admins ändern die geteilte Fassung." };
      await db
        .update(methode)
        .set({ ...werte, updatedAt: new Date() })
        .where(and(eq(methode.id, alt.id), isNull(methode.benutzerId)));
      zielId = alt.id;
    } else {
      // Eigene Fassung einer geteilten Methode. Gibt es schon eine, wird
      // sie ersetzt — ein Konto hat pro Schlüssel höchstens eine.
      const [fassung] = await db
        .insert(methode)
        .values({
          ...werte,
          benutzerId: ich.id,
          schluessel: alt.schluessel,
          basisId: alt.id,
          datenJsonSchema: alt.datenJsonSchema,
          sortierung: alt.sortierung,
        })
        .onConflictDoUpdate({
          target: [methode.benutzerId, methode.schluessel],
          set: { ...werte, basisId: alt.id, updatedAt: new Date() },
        })
        .returning({ id: methode.id });
      zielId = fassung.id;
    }
  }

  revalidatePath("/methoden");
  redirect(`/methoden/${zielId}`);
}

// ─── An / aus, verwerfen, löschen ────────────────────────────────────────────

async function sichtbarerSchluessel(bId: string, schluessel: string) {
  const m = await db.query.methode.findFirst({
    where: and(
      eq(methode.schluessel, schluessel),
      or(isNull(methode.benutzerId), eq(methode.benutzerId, bId))
    ),
    columns: { id: true },
  });
  return !!m;
}

export async function methodeSchalten(schluessel: string, an: boolean) {
  const bId = await benutzerId();
  if (!(await sichtbarerSchluessel(bId, schluessel))) return;

  if (an) {
    await db
      .delete(methodeAusgeschaltet)
      .where(
        and(
          eq(methodeAusgeschaltet.benutzerId, bId),
          eq(methodeAusgeschaltet.schluessel, schluessel)
        )
      );
  } else {
    await db
      .insert(methodeAusgeschaltet)
      .values({ benutzerId: bId, schluessel })
      .onConflictDoNothing();
  }
  revalidatePath("/methoden");
}

/** Eigene Fassung weg — es gilt wieder die geteilte. */
export async function fassungVerwerfen(id: string) {
  const bId = await benutzerId();
  const [weg] = await db
    .delete(methode)
    .where(and(eq(methode.id, id), eq(methode.benutzerId, bId)))
    .returning({ basisId: methode.basisId, schluessel: methode.schluessel });
  if (!weg) return;

  revalidatePath("/methoden");
  const basis = await db.query.methode.findFirst({
    where: and(eq(methode.schluessel, weg.schluessel), isNull(methode.benutzerId)),
    columns: { id: true },
  });
  redirect(basis ? `/methoden/${basis.id}` : "/methoden");
}

/**
 * Eigene Methode löschen. Geteilte löscht nur ein Admin; eigene Fassungen
 * anderer Konten bleiben dabei stehen und werden zu eigenen Methoden.
 */
export async function methodeLoeschen(id: string) {
  const ich = await aktuellerBenutzer();
  const m = await db.query.methode.findFirst({
    where: eq(methode.id, id),
    columns: { benutzerId: true },
  });
  if (!m) return;
  if (m.benutzerId === null ? !ich.istAdmin : m.benutzerId !== ich.id) return;

  await db
    .delete(methode)
    .where(
      and(
        eq(methode.id, id),
        m.benutzerId === null
          ? isNull(methode.benutzerId)
          : eq(methode.benutzerId, ich.id)
      )
    );
  revalidatePath("/methoden");
  redirect("/methoden");
}
