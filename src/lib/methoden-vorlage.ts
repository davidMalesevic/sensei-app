import Mustache from "mustache";

import type { MethodenParameter } from "@/db/schema";

/**
 * Mustache ohne HTML-Escaping. Die Prompts landen nie im Browser als Markup,
 * sondern bei der KI — ein `&amp;` im Lerninhalt wäre dort nur Rauschen.
 * Die Bibliothek setzt ohnehin dreifache Klammern; das hier fängt die
 * doppelten in den Methodenanweisungen ab.
 */
export function rendereVorlage(
  vorlage: string,
  werte: Record<string, unknown>
): string {
  return Mustache.render(vorlage, werte, {}, { escape: (s) => String(s) });
}

/** Parameterwerte: Vorgabe, überschrieben und in die Grenzen geklemmt. */
export function parameterWerte(
  parameter: MethodenParameter[],
  ueberschrieben: Record<string, number> = {}
): Record<string, number> {
  return Object.fromEntries(
    parameter.map((p) => {
      const roh = ueberschrieben[p.name];
      const wert = Number.isFinite(roh) ? roh : p.default;
      return [p.name, Math.min(p.max, Math.max(p.min, Math.round(wert)))];
    })
  );
}

/** Namen aller Variablen, auf die eine Vorlage zugreift. */
export function platzhalter(vorlage: string): string[] {
  try {
    const namen = new Set<string>();
    const sammle = (tokens: Mustache.TemplateSpans) => {
      for (const t of tokens) {
        if (t[0] === "name" || t[0] === "&" || t[0] === "#" || t[0] === "^") {
          namen.add(t[1]);
        }
        // Abschnitte tragen ihre Kinder an Stelle 4.
        const kinder = (t as unknown[])[4];
        if (Array.isArray(kinder)) sammle(kinder as Mustache.TemplateSpans);
      }
    };
    sammle(Mustache.parse(vorlage));
    return [...namen];
  } catch {
    return [];
  }
}

/**
 * Prüft eine Anweisung gegen ihre Parameter. Ein Platzhalter ohne Parameter
 * würde still als leerer Text eingesetzt — «Erstelle  Fragen» —, und die KI
 * rät dann eine Zahl.
 */
export function pruefeAnweisung(
  anweisung: string,
  parameter: MethodenParameter[]
): string | null {
  try {
    Mustache.parse(anweisung);
  } catch (e) {
    return `Die Anweisung ist keine gültige Vorlage: ${(e as Error).message}`;
  }
  const bekannt = new Set(parameter.map((p) => p.name));
  const fremd = platzhalter(anweisung).filter((n) => !bekannt.has(n));
  if (fremd.length > 0) {
    return `Platzhalter ohne Parameter: ${fremd.map((n) => `{{${n}}}`).join(", ")}`;
  }
  return null;
}
