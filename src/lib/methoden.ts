import "server-only";

import { and, asc, eq, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import {
  methode,
  methodeAusgeschaltet,
  methodenBibliothek,
  type MethodenParameter,
} from "@/db/schema";

/**
 * Die Methodenbibliothek, wie ein Konto sie sieht.
 *
 * Geteilte Methoden gehören niemandem. Eine eigene Fassung trägt denselben
 * Schlüssel und verdeckt die geteilte — nur für dieses Konto. Eigene neue
 * Methoden haben einen Schlüssel, den es geteilt nicht gibt.
 */

export type Methode = typeof methode.$inferSelect;

export type Herkunft = "geteilt" | "fassung" | "eigene";

export type WirksameMethode = Methode & {
  herkunft: Herkunft;
  ausgeschaltet: boolean;
};

export const BIBLIOTHEK_ID = "standard";

export async function ladeBibliothek() {
  return (
    (await db.query.methodenBibliothek.findFirst({
      where: eq(methodenBibliothek.id, BIBLIOTHEK_ID),
    })) ?? null
  );
}

export function herkunftVon(m: Methode): Herkunft {
  if (m.benutzerId === null) return "geteilt";
  return m.basisId ? "fassung" : "eigene";
}

/** Alle Methoden, die für dieses Konto gelten — eigene Fassungen zuerst. */
export async function wirksameMethoden(
  bId: string
): Promise<WirksameMethode[]> {
  const [zeilen, aus] = await Promise.all([
    db
      .select()
      .from(methode)
      .where(or(isNull(methode.benutzerId), eq(methode.benutzerId, bId)))
      .orderBy(asc(methode.sortierung), asc(methode.name)),
    db
      .select({ schluessel: methodeAusgeschaltet.schluessel })
      .from(methodeAusgeschaltet)
      .where(eq(methodeAusgeschaltet.benutzerId, bId)),
  ]);

  const eigeneSchluessel = new Set(
    zeilen.filter((m) => m.benutzerId === bId).map((m) => m.schluessel)
  );
  const ausgeschaltet = new Set(aus.map((a) => a.schluessel));

  return zeilen
    .filter((m) => !(m.benutzerId === null && eigeneSchluessel.has(m.schluessel)))
    .map((m) => ({
      ...m,
      herkunft: herkunftVon(m),
      ausgeschaltet: ausgeschaltet.has(m.schluessel),
    }));
}

/**
 * Eine Methode, die dieses Konto sehen darf: geteilt oder eigen. Zu einer
 * geteilten Methode kommt die ID der eigenen Fassung mit, falls es eine gibt.
 */
export async function ladeMethode(bId: string, id: string) {
  const m = await db.query.methode.findFirst({
    where: and(
      eq(methode.id, id),
      or(isNull(methode.benutzerId), eq(methode.benutzerId, bId))
    ),
  });
  if (!m) return null;

  const [fassung, aus] = await Promise.all([
    m.benutzerId === null
      ? db.query.methode.findFirst({
          where: and(
            eq(methode.benutzerId, bId),
            eq(methode.schluessel, m.schluessel)
          ),
          columns: { id: true },
        })
      : undefined,
    db.query.methodeAusgeschaltet.findFirst({
      where: and(
        eq(methodeAusgeschaltet.benutzerId, bId),
        eq(methodeAusgeschaltet.schluessel, m.schluessel)
      ),
    }),
  ]);

  return {
    ...m,
    herkunft: herkunftVon(m),
    ausgeschaltet: !!aus,
    eigeneFassungId: fassung?.id ?? null,
  };
}

// ─── Einlesen aus der JSON-Datei ─────────────────────────────────────────────

type MethodeInDatei = {
  id: string;
  name: string;
  kategorie: string;
  sozialform: string[];
  dauer_minuten: { min: number; max: number; standard: number };
  schwerpunkt: string;
  kurzbeschreibung: string;
  material: string[];
  parameter: MethodenParameter[];
  anweisung: string;
  daten_json_schema: unknown;
};

export type MethodenDatei = {
  schema_version: string;
  titel: string;
  beschreibung?: string;
  sozialformen: Record<string, string>;
  schwerpunkte: Record<string, string>;
  kategorien: { id: string; name: string }[];
  variablen: unknown;
  system_prompt: string;
  user_prompt_template: string;
  ausgabe_schema: unknown;
  methoden: MethodeInDatei[];
};

/**
 * Grobe Formprüfung. Die Datei kommt aus dem Repo oder von einem Admin; es
 * geht darum, eine falsche Datei mit klarer Meldung abzuweisen, bevor die
 * Hälfte geschrieben ist.
 */
export function pruefeMethodenDatei(roh: unknown): MethodenDatei {
  const d = roh as Partial<MethodenDatei>;
  const fehlt = (
    [
      "schema_version",
      "titel",
      "sozialformen",
      "schwerpunkte",
      "kategorien",
      "system_prompt",
      "user_prompt_template",
      "ausgabe_schema",
      "methoden",
    ] as const
  ).filter((k) => d?.[k] === undefined);
  if (fehlt.length > 0) {
    throw new Error(`Keine Methodenbibliothek — es fehlt: ${fehlt.join(", ")}`);
  }
  if (!Array.isArray(d.methoden) || d.methoden.length === 0) {
    throw new Error("Die Datei enthält keine Methoden.");
  }
  const kategorien = new Set(d.kategorien!.map((k) => k.id));
  const gesehen = new Set<string>();
  for (const m of d.methoden) {
    const wo = `Methode «${m?.name ?? m?.id ?? "?"}»`;
    if (!m.id || !m.name || !m.anweisung || !m.dauer_minuten) {
      throw new Error(`${wo}: id, name, anweisung oder dauer_minuten fehlt.`);
    }
    if (gesehen.has(m.id)) throw new Error(`${wo}: id doppelt vergeben.`);
    gesehen.add(m.id);
    if (!kategorien.has(m.kategorie)) {
      throw new Error(`${wo}: unbekannte Kategorie «${m.kategorie}».`);
    }
    if (!(m.schwerpunkt in d.schwerpunkte!)) {
      throw new Error(`${wo}: unbekannter Schwerpunkt «${m.schwerpunkt}».`);
    }
    for (const s of m.sozialform ?? []) {
      if (!(s in d.sozialformen!)) {
        throw new Error(`${wo}: unbekannte Sozialform «${s}».`);
      }
    }
  }
  return d as MethodenDatei;
}

export type EinleseErgebnis = {
  neu: number;
  aktualisiert: number;
  uebersprungen: number;
  /** Geteilte Methoden, die in der Datei fehlen — gemeldet, nicht gelöscht. */
  fehlenInDatei: string[];
};

/**
 * Schreibt Bibliothek und geteilte Methoden.
 *
 * Die gemeinsamen Teile (Prompts, Schema, Wertelisten) werden immer
 * übernommen — sie sind in der Oberfläche nicht bearbeitbar, die Datei ist
 * also die einzige Quelle. Geteilte Methoden dagegen kann ein Admin
 * bearbeitet haben; die bleiben unangetastet, ausser `ueberschreiben` ist
 * gesetzt. Eigene Fassungen fasst das Einlesen nie an.
 */
export async function leseMethodenEin(
  datei: MethodenDatei,
  { ueberschreiben }: { ueberschreiben: boolean }
): Promise<EinleseErgebnis> {
  return db.transaction(async (tx) => {
    const bibliothek = {
      schemaVersion: datei.schema_version,
      titel: datei.titel,
      beschreibung: datei.beschreibung ?? null,
      systemPrompt: datei.system_prompt,
      userPromptTemplate: datei.user_prompt_template,
      ausgabeSchema: datei.ausgabe_schema,
      sozialformen: datei.sozialformen,
      schwerpunkte: datei.schwerpunkte,
      kategorien: datei.kategorien,
      variablen: datei.variablen ?? [],
      eingelesenAm: new Date(),
    };
    await tx
      .insert(methodenBibliothek)
      .values({ id: BIBLIOTHEK_ID, ...bibliothek })
      .onConflictDoUpdate({ target: methodenBibliothek.id, set: bibliothek });

    const vorhanden = await tx
      .select({ id: methode.id, schluessel: methode.schluessel })
      .from(methode)
      .where(isNull(methode.benutzerId));
    const nachSchluessel = new Map(vorhanden.map((v) => [v.schluessel, v.id]));

    const ergebnis: EinleseErgebnis = {
      neu: 0,
      aktualisiert: 0,
      uebersprungen: 0,
      fehlenInDatei: [],
    };

    for (const [i, m] of datei.methoden.entries()) {
      const werte = {
        name: m.name,
        kategorie: m.kategorie,
        sozialform: m.sozialform ?? [],
        dauerMin: m.dauer_minuten.min,
        dauerMax: m.dauer_minuten.max,
        dauerStandard: m.dauer_minuten.standard,
        schwerpunkt: m.schwerpunkt,
        kurzbeschreibung: m.kurzbeschreibung ?? "",
        material: m.material ?? [],
        parameter: m.parameter ?? [],
        anweisung: m.anweisung,
        datenJsonSchema: m.daten_json_schema ?? null,
        sortierung: i,
      };
      const id = nachSchluessel.get(m.id);
      if (!id) {
        await tx.insert(methode).values({ schluessel: m.id, ...werte });
        ergebnis.neu++;
      } else if (ueberschreiben) {
        await tx
          .update(methode)
          .set({ ...werte, updatedAt: new Date() })
          .where(eq(methode.id, id));
        ergebnis.aktualisiert++;
      } else {
        // Die Reihenfolge darf trotzdem der Datei folgen.
        await tx
          .update(methode)
          .set({ sortierung: i })
          .where(eq(methode.id, id));
        ergebnis.uebersprungen++;
      }
    }

    const inDatei = new Set(datei.methoden.map((m) => m.id));
    ergebnis.fehlenInDatei = vorhanden
      .filter((v) => !inDatei.has(v.schluessel))
      .map((v) => v.schluessel);

    return ergebnis;
  });
}
