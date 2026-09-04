import "server-only";

/**
 * Minutenschätzung für die Aufgaben eines Moduls.
 *
 * **Warum die KI hier ausnahmsweise eine Zahl liefern darf:** Im
 * Smartlearn-Export steht keine einzige Zeitangabe — geprüft am
 * Beispielexport, und keine der Tabellen `modul_aufgabe`, `modul_auftrag`,
 * `modul_block` hatte vorher ein Zeitfeld. Eine Dauer kann deshalb nie ein
 * Fakt sein. Sie ist entweder geschätzt oder getippt, und genau das hält
 * `dauer_quelle` fest: die Oberfläche zeigt `~` für geschätzt und `✎` für
 * gesetzt, damit eine Schätzung nicht neben LA-Code und Slidenummer steht und
 * aussieht wie diese.
 *
 * **Eine Korrektur wird nie überschrieben.** Geschrieben wird nur, wo
 * `dauer_quelle` `NULL` oder `'ki'` ist. Der Lauf ist damit idempotent und
 * beliebig oft wiederholbar.
 *
 * Gewöhnliches Servermodul mit `bId` als erstem Parameter — wie `entwurf.ts`:
 * in einer `"use server"`-Datei könnte jeder Browser eine fremde ID schicken.
 */

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { db } from "@/db";
import { modul, modulAufgabe, modulAuftrag, modulBlock } from "@/db/schema";
import { callAI, parseJsonFromAI } from "@/lib/ai";

type Posten = {
  id: string;
  art: "aufgabe" | "auftrag" | "block";
  /** Was im Prompt steht — Bezeichnung plus etwas Kontext. */
  beschreibung: string;
};

/** Auf ein unterrichtstaugliches Mass ziehen. */
function plausibel(roh: unknown): number | null {
  const n = typeof roh === "number" ? roh : Number(roh);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(180, Math.max(5, Math.round(n / 5) * 5));
}

export async function schaetzeModulZeiten(
  benutzerId: string,
  modulId: string
): Promise<{ ok: boolean; geschaetzt?: number; uebersprungen?: number; fehler?: string }> {
  const eigenes = await db.query.modul.findFirst({
    where: and(eq(modul.id, modulId), eq(modul.benutzerId, benutzerId)),
    columns: { id: true, nummer: true, bezeichnung: true },
  });
  if (!eigenes) return { ok: false, fehler: "Modul nicht gefunden." };

  const bloecke = await db.query.modulBlock.findMany({
    where: eq(modulBlock.modulId, modulId),
    orderBy: (b, { asc }) => [asc(b.nummer), asc(b.schluessel)],
    with: {
      auftraege: {
        orderBy: (a, { asc }) => [asc(a.sortierung)],
        with: { aufgaben: { orderBy: (a, { asc }) => [asc(a.sortierung)] } },
      },
    },
  });

  if (bloecke.length === 0) {
    return {
      ok: false,
      fehler:
        "Zum Modul fehlt der Aufgabenbaum — er entsteht beim Import des Smartlearn-Exports.",
    };
  }

  // Nur was noch keine gesetzte Zahl trägt. Eine Korrektur ist eine Aussage
  // der Lehrperson und überlebt jeden weiteren Schätzlauf.
  const posten: Posten[] = [];
  let uebersprungen = 0;

  for (const b of bloecke) {
    // Der Theorieteil eines Blocks: seine Länge hängt am Slideumfang.
    if (b.slideMaterialId) {
      if (b.dauerQuelle === "person") uebersprungen += 1;
      else {
        const umfang =
          b.slideVon !== null && b.slideBis !== null
            ? `${b.slideBis - b.slideVon + 1} Slides`
            : "Umfang unbekannt";
        posten.push({
          id: b.id,
          art: "block",
          beschreibung: `Theorieteil «${b.titel}» (${umfang})`,
        });
      }
    }

    for (const a of b.auftraege) {
      // Modul ohne nummerierte Aufgaben (z.B. 168): der LA ist die Einheit.
      if (a.aufgaben.length === 0) {
        if (a.dauerQuelle === "person") uebersprungen += 1;
        else {
          posten.push({
            id: a.id,
            art: "auftrag",
            beschreibung: `Lern- und Arbeitsauftrag ${a.code}: ${
              a.aufgabenstellung?.slice(0, 300) ?? "ohne Aufgabenstellung"
            }`,
          });
        }
        continue;
      }

      for (const auf of a.aufgaben.filter((x) => !x.parentId)) {
        if (auf.dauerQuelle === "person") {
          uebersprungen += 1;
          continue;
        }
        const teil = a.aufgaben.filter((t) => t.parentId === auf.id);
        posten.push({
          id: auf.id,
          art: "aufgabe",
          beschreibung:
            `${a.code} · ${auf.bezeichnung}` +
            (teil.length > 0 ? ` (${teil.length} Teilaufgaben)` : "") +
            `: ${auf.text?.slice(0, 300) ?? "ohne Text"}`,
        });
      }
    }
  }

  if (posten.length === 0) {
    return { ok: true, geschaetzt: 0, uebersprungen };
  }

  const liste = posten.map((p, i) => `  ${i}: ${p.beschreibung}`).join("\n");

  const prompt = `Du schätzt den Zeitbedarf von Aufgaben an einer Schweizer Berufsfachschule.

MODUL
  ${eigenes.nummer}${eigenes.bezeichnung ? ` – ${eigenes.bezeichnung}` : ""}

AUFGABEN
${liste}

AUFGABE
Schätze für jeden Eintrag, wie viele Minuten eine durchschnittliche Klasse im
Unterricht dafür braucht — inklusive Erklärung und Nachfragen, ohne Besprechung
im Plenum.

Regeln:
1. Eine Lektion sind 45 Minuten. Die meisten Einzelaufgaben liegen zwischen 10
   und 40 Minuten.
2. Ein ganzer Lern- und Arbeitsauftrag ohne nummerierte Aufgaben dauert länger
   als eine einzelne Aufgabe.
3. Für einen Theorieteil rechne rund 1 bis 2 Minuten pro Slide.
4. Runde auf 5 Minuten.
5. Gib für JEDEN Eintrag eine Zahl an, auch bei dünner Beschreibung. Schätze
   dann konservativ.

Antworte AUSSCHLIESSLICH mit JSON:
{"zeiten":[{"i":0,"minuten":25},{"i":1,"minuten":40}]}`;

  const antwort = await callAI(prompt, 0.3);
  if (!antwort.success) return { ok: false, fehler: antwort.error };

  const geparst = parseJsonFromAI<{ zeiten?: { i?: number; minuten?: unknown }[] }>(
    antwort.content
  );
  const zeiten = Array.isArray(geparst?.zeiten) ? geparst.zeiten : [];
  if (zeiten.length === 0) {
    return { ok: false, fehler: "Die KI hat keine verwertbaren Zeiten geliefert." };
  }

  // Nach Tabelle sammeln, damit daraus wenige Updates werden statt einem pro
  // Aufgabe — ein Modul hat schnell 30 davon.
  const proTabelle = { aufgabe: new Map<string, number>(), auftrag: new Map<string, number>(), block: new Map<string, number>() };

  for (const z of zeiten) {
    const i = typeof z.i === "number" ? z.i : Number(z.i);
    const p = posten[i];
    const minuten = plausibel(z.minuten);
    if (!p || minuten === null) continue;
    proTabelle[p.art].set(p.id, minuten);
  }

  let geschaetzt = 0;

  for (const [art, werte] of Object.entries(proTabelle) as [
    Posten["art"],
    Map<string, number>,
  ][]) {
    if (werte.size === 0) continue;
    const tabelle =
      art === "aufgabe" ? modulAufgabe : art === "auftrag" ? modulAuftrag : modulBlock;

    // Gruppiert nach Minutenwert: gleiche Zahl, ein Update.
    const nachWert = new Map<number, string[]>();
    for (const [id, min] of werte) {
      if (!nachWert.has(min)) nachWert.set(min, []);
      nachWert.get(min)!.push(id);
    }

    for (const [min, ids] of nachWert) {
      const treffer = await db
        .update(tabelle)
        .set({ dauerMinuten: min, dauerQuelle: "ki" })
        .where(
          and(
            inArray(tabelle.id, ids),
            // Der Schutz der Korrektur steht auch hier im WHERE, nicht nur in
            // der Auswahl oben: zwischen Lesen und Schreiben kann jemand eine
            // Zahl gesetzt haben, und die soll gewinnen.
            or(isNull(tabelle.dauerQuelle), eq(tabelle.dauerQuelle, "ki"))
          )
        )
        .returning({ id: tabelle.id });
      geschaetzt += treffer.length;
    }
  }

  return { ok: true, geschaetzt, uebersprungen };
}
