"use server";

import { benutzerId } from "@/lib/dal";
import * as entwurf from "@/lib/entwurf";

/**
 * Dünne Hüllen um `src/lib/entwurf.ts`.
 *
 * Die Engine nimmt die Benutzer-ID als Parameter, damit der Nachtlauf sie ohne
 * Session hereinreichen kann. Hier — und nur hier — kommt sie aus dem
 * Session-Cookie. Deshalb steht die Engine bewusst NICHT in dieser Datei: was
 * aus einer `"use server"`-Datei exportiert wird, ist vom Browser aufrufbar,
 * und eine ID als Parameter wäre dort frei wählbar.
 */

export type { Geschwister } from "@/lib/entwurf";

export async function erzeugeEntwurf(
  sequenzId: string,
  options?: { force?: boolean }
) {
  return entwurf.erzeugeEntwurf(await benutzerId(), sequenzId, options);
}

export async function erzeugeEntwuerfe(vonDatum: string, bisDatum: string) {
  return entwurf.erzeugeEntwuerfe(await benutzerId(), vonDatum, bisDatum);
}

export async function bestaetigeAblauf(sequenzId: string) {
  return entwurf.bestaetigeAblauf(await benutzerId(), sequenzId);
}

export async function getAblauf(sequenzId: string) {
  return entwurf.getAblauf(await benutzerId(), sequenzId);
}

export async function aktualisiereAblaufZeile(
  zeilenId: string,
  werte: { titel?: string; text?: string | null }
) {
  return entwurf.aktualisiereAblaufZeile(await benutzerId(), zeilenId, werte);
}

export async function loescheAblaufZeile(zeilenId: string) {
  return entwurf.loescheAblaufZeile(await benutzerId(), zeilenId);
}

export async function sortiereAblauf(sequenzId: string, ids: string[]) {
  return entwurf.sortiereAblauf(await benutzerId(), sequenzId, ids);
}

export async function fuegeAblaufZeileHinzu(
  sequenzId: string,
  typ: Parameters<typeof entwurf.fuegeAblaufZeileHinzu>[2],
  titel: string
) {
  return entwurf.fuegeAblaufZeileHinzu(await benutzerId(), sequenzId, typ, titel);
}

export async function getGeschwister(sequenzId: string) {
  return entwurf.getGeschwister(await benutzerId(), sequenzId);
}

export async function uebernehmeAblauf(zielId: string, quelleId: string) {
  return entwurf.uebernehmeAblauf(await benutzerId(), zielId, quelleId);
}

export async function loeseUebernahme(sequenzId: string) {
  return entwurf.loeseUebernahme(await benutzerId(), sequenzId);
}
