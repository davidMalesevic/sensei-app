import "server-only";

/**
 * Welche Instanz läuft hier?
 *
 * Gesetzt über `INSTANZ` in der jeweiligen `.env.production`. Die Testinstanz
 * soll auf den ersten Blick von der Produktion zu unterscheiden sein — sonst
 * bearbeitet man irgendwann echte Unterrichtsplanung im Glauben, es sei nur
 * ein Test.
 */
export type Instanz = { istTest: boolean; name: string };

export function instanz(): Instanz {
  const istTest = process.env.INSTANZ === "test";
  return { istTest, name: istTest ? "Sensei-Test" : "Sensei" };
}
