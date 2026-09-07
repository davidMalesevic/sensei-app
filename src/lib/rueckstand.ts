import "server-only";

/**
 * Was in diesem Modul für diese Klasse **noch offen** ist — nicht bloss, was
 * der Modulplan für die laufende Woche vorsieht.
 *
 * Der Denkfehler davor war eine nirgends ausgesprochene Annahme: *der
 * Modulplan wird eingehalten*. Real ist der Modulplan eine Absicht und der
 * Übertrag die Wirklichkeit. Blieb in KW 36 die Hälfte von Block 2 liegen,
 * bestand die Faktenliste für KW 37 trotzdem nur aus Block 3 — die offenen
 * Aufgaben waren spurlos weg, und abhaken liessen sie sich auch nicht mehr,
 * weil die Häkchenliste aus demselben Wochenstoff kam.
 *
 * Liegt in einer eigenen Datei, weil sie Modulbaum und Übertrag verbindet:
 * `uebertrag.ts` braucht `markeSchluessel` aus dem Modulbaum, der Modulbaum
 * darf den Übertrag deshalb nicht kennen.
 *
 * Die Benutzer-ID kommt wie bei `entwurf.ts` als erster Parameter herein,
 * damit der Nachtlauf sie ohne Session hereinreichen kann.
 */

import {
  getGeplanteKws,
  getWochenstoff,
  getWochenstoffMehrere,
  kuerzeStoff,
  markenAusStoff,
  markenMenge,
  zaehleAufgaben,
  type StoffBlock,
  type Wochenstoff,
} from "@/lib/modulbaum";
import { holeStandDerKlasse } from "@/lib/uebertrag";

export type RueckstandWoche = {
  kw: number;
  ziel: string | null;
  bloecke: StoffBlock[];
  anzahl: number;
};

export type OffenerStoff = {
  /** Der Stoff der laufenden Woche, um alles je Erledigte gekürzt. */
  diese: Wochenstoff | null;
  /**
   * Derselbe Stoff **ungekürzt** — für «Stoff dieser Woche», wo Erledigtes
   * markiert und nicht entfernt gehört: der Abschnitt ist die Referenz hinter
   * dem Ablauf, und eine Aufgabe, die einfach verschwindet, lässt offen, ob
   * sie erledigt oder nie geplant war.
   */
  dieseRoh: Wochenstoff | null;
  /** Vergleichsschlüssel alles je Erledigten — für `markeSchluessel`-Tests. */
  erledigtSchluessel: string[];
  /** Was aus früheren Wochen aussteht, älteste zuerst. */
  rueckstand: RueckstandWoche[];
  /** Summe der offenen Aufgaben aus früheren Wochen. */
  anzahlRueckstand: number;
  /**
   * Vorwochen mit Unterricht, aber ohne Rückmeldung. Ihr Stand ist unbekannt,
   * deshalb erzeugen sie **keinen** Rückstand — Sensei erfindet keinen
   * Rückstand, den es nicht wissen kann. Genannt wird die Lücke trotzdem.
   */
  wochenOhneRueckmeldung: number[];
};

const LEER: OffenerStoff = {
  diese: null,
  dieseRoh: null,
  erledigtSchluessel: [],
  rueckstand: [],
  anzahlRueckstand: 0,
  wochenOhneRueckmeldung: [],
};

export async function getOffenenStoff(
  benutzerId: string,
  klasseId: string,
  modulId: string | null,
  kw: number | null,
  datum: string | null
): Promise<OffenerStoff> {
  if (!modulId || kw === null) return LEER;

  // Die laufende Woche kommt über den bestehenden Weg herein: nur er
  // unterscheidet «kein Modulplan-Eintrag für diese KW» von «Modul gehört
  // diesem Konto nicht», und auf dieser Unterscheidung steht die Fehlermeldung
  // des Entwurfsgenerators.
  const [stand, geplanteKws, dieseRoh] = await Promise.all([
    holeStandDerKlasse(benutzerId, klasseId, modulId, datum),
    getGeplanteKws(benutzerId, modulId, kw),
    getWochenstoff(benutzerId, modulId, kw),
  ]);
  if (!dieseRoh) return LEER;

  // Rückstand kann nur aus Wochen kommen, die alle drei Bedingungen erfüllen:
  // der Modulplan sieht etwas vor, die Klasse hatte Unterricht *und* der
  // Übertrag ist erfasst. Pauschal erledigte Wochen («Kein Übertrag» = alles
  // lief wie geplant) fallen ebenfalls weg.
  const gerechnet = new Set(stand.gerechneteKws);
  const pauschal = new Set(stand.pauschalErledigteKws);
  const vorwochen = geplanteKws.filter(
    (k) => k < kw && gerechnet.has(k) && !pauschal.has(k)
  );

  const stoffe = await getWochenstoffMehrere(benutzerId, modulId, vorwochen);

  // Pauschal erledigte Wochen zählen vollständig als erledigt. Ihre Marken
  // stehen nicht zwingend in der Datenbank: die Zeilen, die vor dieser
  // Änderung mit «Kein Übertrag» entstanden sind, tragen eine leere Liste.
  // Deshalb wird die Bedeutung des Flags hier gerechnet, statt sie zu lesen.
  const erledigt = new Set(stand.erledigt);
  if (pauschal.size > 0) {
    const pauschalStoffe = await getWochenstoffMehrere(benutzerId, modulId, [
      ...pauschal,
    ]);
    for (const s of pauschalStoffe.values()) {
      for (const m of markenMenge(markenAusStoff(s))) erledigt.add(m);
    }
  }

  const diese = kuerzeStoff(dieseRoh, erledigt);

  /**
   * Der Modulplan wiederholt denselben Block über mehrere Wochen — Block 2 von
   * Modul 278 steht in KW 35, 36 **und** 37, Block C von Modul 168 in KW 36 und
   * 37. Ohne die folgende Abgrenzung erscheint eine offene Aufgabe deshalb
   * einmal pro Woche, in der ihr Block genannt ist: dreifach statt einmal.
   *
   * Zwei Regeln lösen das:
   *
   * 1. **Was diese Woche ohnehin ansteht, ist kein Rückstand.** Nennt der Plan
   *    den Block weiterhin, ist die Aufgabe schlicht Stoff dieser Woche — sonst
   *    stünde der ganze Wochenstoff als Rückstand da und die Woche selbst
   *    schiene leer. Genau so sah es in Modul 278 aus.
   * 2. **Die früheste Woche bekommt den Zuschlag.** Bleibt etwas übrig, gehört
   *    es zu der Woche, in der es zuerst anstand — «Rückstand aus KW 35» ist
   *    die Aussage, nicht «aus KW 36».
   */
  const schonGezeigt = new Set(markenMenge(markenAusStoff(diese)));

  const rueckstand: RueckstandWoche[] = [];
  for (const k of vorwochen) {
    const s = stoffe.get(k);
    if (!s) continue;
    const offen = kuerzeStoff(s, new Set([...erledigt, ...schonGezeigt]), true);
    const anzahl = zaehleAufgaben(offen);
    if (anzahl > 0) {
      rueckstand.push({ kw: k, ziel: s.ziel, bloecke: offen.bloecke, anzahl });
      for (const m of markenMenge(markenAusStoff(offen))) schonGezeigt.add(m);
    }
  }

  return {
    diese,
    dieseRoh,
    erledigtSchluessel: [...erledigt],
    rueckstand,
    anzahlRueckstand: rueckstand.reduce((n, r) => n + r.anzahl, 0),
    wochenOhneRueckmeldung: stand.wochenOhneRueckmeldung.filter((k) => k < kw),
  };
}
