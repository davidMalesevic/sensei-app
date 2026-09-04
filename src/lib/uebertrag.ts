import "server-only";

import { and, asc, desc, eq, isNotNull, lt, ne, or } from "drizzle-orm";

import { db } from "@/db";
import { sequenz } from "@/db/schema";
import { markeSchluessel } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";

/**
 * Der letzte Übertrag derselben Klasse im selben Modul vor dieser Sequenz —
 * die Antwort auf «wo fange ich an».
 *
 * Liegt hier statt in den Server Actions, weil der Nachtlauf sie ohne Session
 * braucht und die Benutzer-ID deshalb hereingereicht wird. In einer
 * `"use server"`-Datei wäre das eine Lücke: der Browser könnte eine fremde ID
 * schicken und den Stand anderer Konten auslesen.
 */
export async function holeVorherigenUebertrag(
  benutzerId: string,
  klasseId: string,
  modulId: string | null,
  datum: string | null,
  currentSequenzId: string
) {
  if (!modulId || !datum) return null;

  const [vorherige] = await db
    .select({
      id: sequenz.id,
      startDatum: sequenz.startDatum,
      uebertrag: sequenz.uebertrag,
      uebertragErledigt: sequenz.uebertragErledigt,
      uebertragSlideBis: sequenz.uebertragSlideBis,
      keinUebertrag: sequenz.keinUebertrag,
    })
    .from(sequenz)
    .where(
      and(
        eq(sequenz.benutzerId, benutzerId),
        eq(sequenz.klasseId, klasseId),
        eq(sequenz.modulId, modulId),
        ne(sequenz.id, currentSequenzId),
        lt(sequenz.startDatum, datum),
        // Ein Übertrag zählt, sobald er gespeichert wurde — auch wenn nur
        // Aufgaben abgehakt und keine Notiz getippt wurde. Vorher wurde
        // solch ein Stand übersehen, und der Entwurfsgenerator plante die
        // längst erledigten Aufgaben erneut ein.
        or(isNotNull(sequenz.uebertragAm), eq(sequenz.keinUebertrag, true))
      )
    )
    .orderBy(desc(sequenz.startDatum))
    .limit(1);

  return vorherige ?? null;
}

/**
 * Was diese Klasse in diesem Modul bis zu einem Datum erledigt hat — und wo
 * Sensei es schlicht nicht weiss.
 *
 * Bis hierher las die Planung nur die **eine** letzte Sequenz und benutzte
 * deren Erledigt-Liste als Abzugsfilter auf die laufende Woche. Der Übertrag
 * konnte Arbeit damit nur wegnehmen, nie mitnehmen: was in KW 36 offen blieb,
 * tauchte in KW 37 nirgends mehr auf, weil der Wochenstoff von KW 37 gar
 * keine Aufgabe aus Block 2 mehr enthält.
 */
export type KlassenStand = {
  /** Vergleichsschlüssel aller je abgehakten Aufgaben, über alle Vorwochen. */
  erledigt: Set<string>;
  /**
   * Wochen, die pauschal als vollständig erledigt gelten («Kein Übertrag» =
   * alles lief wie geplant). Deren Aufgaben werden aus dem Stoff gerechnet,
   * nicht aus der Liste gelesen — die sieben Zeilen, die vor dieser Änderung
   * entstanden sind, tragen noch gar keine.
   */
  pauschalErledigteKws: number[];
  /** Vorwochen mit Lektion **und** Rückmeldung. Nur sie erzeugen Rückstand. */
  gerechneteKws: number[];
  /** Vorwochen mit Lektion, aber ohne Rückmeldung — Stand unbekannt. */
  wochenOhneRueckmeldung: number[];
  /** KW der ersten Lektion dieser Klasse in diesem Modul. */
  abKw: number | null;
};

const LEERER_STAND: KlassenStand = {
  erledigt: new Set(),
  pauschalErledigteKws: [],
  gerechneteKws: [],
  wochenOhneRueckmeldung: [],
  abKw: null,
};

export async function holeStandDerKlasse(
  benutzerId: string,
  klasseId: string,
  modulId: string | null,
  vorDatum: string | null
): Promise<KlassenStand> {
  if (!modulId || !vorDatum) return LEERER_STAND;

  const vorherige = await db
    .select({
      startDatum: sequenz.startDatum,
      uebertragErledigt: sequenz.uebertragErledigt,
      keinUebertrag: sequenz.keinUebertrag,
      uebertragAm: sequenz.uebertragAm,
    })
    .from(sequenz)
    .where(
      and(
        eq(sequenz.benutzerId, benutzerId),
        eq(sequenz.klasseId, klasseId),
        eq(sequenz.modulId, modulId),
        lt(sequenz.startDatum, vorDatum)
      )
    )
    .orderBy(asc(sequenz.startDatum));

  if (vorherige.length === 0) return LEERER_STAND;

  const erledigt = new Set<string>();
  const pauschal = new Set<number>();
  // Eine Woche gilt nur dann als gerechnet, wenn **jede** Lektion darin eine
  // Rückmeldung trägt. Hat die Klasse zweimal in derselben Woche Unterricht
  // und nur eine der beiden Lektionen ist zurückgemeldet, ist der Stand der
  // Woche offen — dann lieber schweigen als einen Rückstand behaupten.
  const proKw = new Map<number, { gesamt: number; gemeldet: number }>();

  for (const s of vorherige) {
    const kw = getKWFromDateString(s.startDatum);
    if (kw === null) continue;

    const zaehler = proKw.get(kw) ?? { gesamt: 0, gemeldet: 0 };
    zaehler.gesamt += 1;

    const gemeldet = s.uebertragAm !== null || s.keinUebertrag;
    if (gemeldet) zaehler.gemeldet += 1;
    proKw.set(kw, zaehler);

    if (!gemeldet) continue;
    for (const m of s.uebertragErledigt ?? []) erledigt.add(markeSchluessel(m));
    if (s.keinUebertrag) pauschal.add(kw);
  }

  const gerechnete: number[] = [];
  const ohneRueckmeldung: number[] = [];
  for (const [kw, z] of proKw) {
    if (z.gemeldet === z.gesamt) gerechnete.push(kw);
    else ohneRueckmeldung.push(kw);
  }

  const alleKws = [...proKw.keys()].sort((a, b) => a - b);

  // «Pauschal erledigt» gilt nur für Wochen, die vollständig zurückgemeldet
  // sind. Hat eine Klasse in derselben Woche drei Lektionen und nur eine davon
  // trägt «Kein Übertrag», ist der Stand der Woche offen — dann darf ihr Stoff
  // nicht als erledigt gelten. In den Testdaten kommt genau das vor (Modul 119,
  // MEDB26A, KW 34), und ohne diese Einschränkung verschwänden die Aufgaben
  // jener Woche stillschweigend.
  const gerechnetMenge = new Set(gerechnete);

  return {
    erledigt,
    pauschalErledigteKws: [...pauschal]
      .filter((k) => gerechnetMenge.has(k))
      .sort((a, b) => a - b),
    gerechneteKws: gerechnete.sort((a, b) => a - b),
    wochenOhneRueckmeldung: ohneRueckmeldung.sort((a, b) => a - b),
    abKw: alleKws[0] ?? null,
  };
}
