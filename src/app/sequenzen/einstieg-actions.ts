"use server";

import { benutzerId } from "@/lib/dal";
import * as einstieg from "@/lib/einstieg";

/**
 * Dünne Hüllen um `src/lib/einstieg.ts` — wie bei `entwurf-actions.ts`.
 * Die Benutzer-ID kommt hier aus der Sitzung und nie als Parameter herein.
 */

export async function arbeiteEinstiegAus(
  sequenzId: string,
  optionen?: einstieg.AusarbeitenOptionen
) {
  return einstieg.arbeiteEinstiegAus(await benutzerId(), sequenzId, optionen);
}

export async function loeschePaket(sequenzId: string) {
  return einstieg.loeschePaket(await benutzerId(), sequenzId);
}

export async function holePaket(sequenzId: string) {
  return einstieg.holePaket(await benutzerId(), sequenzId);
}
