/**
 * Ein Kreuzworträtsel aus einer Wortliste legen.
 *
 * Die KI liefert Wörter und Hinweise, das Gitter baut Sensei — ein Sprach-
 * modell kann keine Buchstaben zählen, und ein «Gitter», das es beschreibt,
 * geht beim Nachrechnen fast immer nicht auf.
 *
 * Das Verfahren ist das übliche gierige: das längste Wort waagrecht in die
 * Mitte, jedes weitere an den besten Kreuzungspunkt, den es findet. Kein
 * Backtracking — dafür **deterministisch**: dieselbe Liste ergibt dasselbe
 * Gitter, sonst sähe ein zweiter Ausdruck anders aus als der erste.
 *
 * Wörter ohne Kreuzung bleiben liegen und werden gemeldet, nicht verschwiegen.
 */

export type GelegtesWort = {
  wort: string;
  anzeigewort: string;
  hinweis: string;
  zeile: number;
  spalte: number;
  waagrecht: boolean;
  /** Nummer im Gitter, wie bei Kreuzworträtseln üblich. */
  nummer: number;
};

export type Gitter = {
  zeilen: number;
  spalten: number;
  /** `null` = schwarzes Feld. */
  felder: (string | null)[][];
  /** Die Nummer, falls hier ein Wort beginnt. */
  nummern: (number | null)[][];
  woerter: GelegtesWort[];
  /** Wörter, für die keine Kreuzung gefunden wurde. */
  ausgelassen: string[];
};

type Platzierung = { zeile: number; spalte: number; waagrecht: boolean };

const MAX = 40;

export function baueGitter(
  eingabe: { loesungswort: string; anzeigewort: string; hinweis: string }[]
): Gitter | null {
  const woerter = [...eingabe]
    .filter((w) => w.loesungswort.length >= 3)
    // Längste zuerst: sie geben dem Gitter sein Gerüst. Bei gleicher Länge
    // alphabetisch, damit die Reihenfolge nicht vom Zufall abhängt.
    .sort(
      (a, b) =>
        b.loesungswort.length - a.loesungswort.length ||
        a.loesungswort.localeCompare(b.loesungswort)
    );
  if (woerter.length === 0) return null;

  // Ein grosses Feld, am Schluss wird auf das Belegte zugeschnitten.
  const raster: (string | null)[][] = Array.from({ length: MAX }, () =>
    Array<string | null>(MAX).fill(null)
  );
  const gelegt: Omit<GelegtesWort, "nummer">[] = [];
  const ausgelassen: string[] = [];

  const setze = (w: string, p: Platzierung) => {
    for (let i = 0; i < w.length; i++) {
      const z = p.zeile + (p.waagrecht ? 0 : i);
      const s = p.spalte + (p.waagrecht ? i : 0);
      raster[z][s] = w[i];
    }
  };

  /** Passt das Wort hierhin, ohne fremde Wörter zu berühren? */
  const passt = (w: string, p: Platzierung): number | null => {
    const { zeile, spalte, waagrecht } = p;
    if (zeile < 0 || spalte < 0) return null;
    if (waagrecht ? spalte + w.length > MAX : zeile + w.length > MAX) return null;

    // Direkt vor und hinter dem Wort muss frei sein, sonst klebt es an einem
    // anderen und es entsteht ein Wort, das niemand gesucht hat.
    const vorZ = zeile - (waagrecht ? 0 : 1);
    const vorS = spalte - (waagrecht ? 1 : 0);
    const nachZ = zeile + (waagrecht ? 0 : w.length);
    const nachS = spalte + (waagrecht ? w.length : 0);
    if (vorZ >= 0 && vorS >= 0 && raster[vorZ][vorS] !== null) return null;
    if (nachZ < MAX && nachS < MAX && raster[nachZ][nachS] !== null) return null;

    let kreuzungen = 0;
    for (let i = 0; i < w.length; i++) {
      const z = zeile + (waagrecht ? 0 : i);
      const s = spalte + (waagrecht ? i : 0);
      const feld = raster[z][s];

      if (feld !== null) {
        if (feld !== w[i]) return null;
        kreuzungen++;
        continue;
      }

      // Seitlich muss frei bleiben — sonst stünden zwei Wörter parallel
      // aneinander und ergäben senkrecht Buchstabensalat.
      const seiten: [number, number][] = waagrecht
        ? [
            [z - 1, s],
            [z + 1, s],
          ]
        : [
            [z, s - 1],
            [z, s + 1],
          ];
      for (const [zz, ss] of seiten) {
        if (zz >= 0 && zz < MAX && ss >= 0 && ss < MAX && raster[zz][ss] !== null) {
          return null;
        }
      }
    }
    return kreuzungen;
  };

  // Das erste Wort waagrecht in die Mitte.
  const erstes = woerter[0];
  const start: Platzierung = {
    zeile: Math.floor(MAX / 2),
    spalte: Math.floor((MAX - erstes.loesungswort.length) / 2),
    waagrecht: true,
  };
  setze(erstes.loesungswort, start);
  gelegt.push({
    wort: erstes.loesungswort,
    anzeigewort: erstes.anzeigewort,
    hinweis: erstes.hinweis,
    ...start,
  });

  for (const w of woerter.slice(1)) {
    const wort = w.loesungswort;
    let beste: { p: Platzierung; punkte: number } | null = null;

    for (let i = 0; i < wort.length; i++) {
      for (const schon of gelegt) {
        for (let j = 0; j < schon.wort.length; j++) {
          if (schon.wort[j] !== wort[i]) continue;

          // Gekreuzt wird immer quer zur Richtung des getroffenen Wortes.
          const waagrecht = !schon.waagrecht;
          const kreuzZ = schon.zeile + (schon.waagrecht ? 0 : j);
          const kreuzS = schon.spalte + (schon.waagrecht ? j : 0);
          const p: Platzierung = {
            zeile: waagrecht ? kreuzZ : kreuzZ - i,
            spalte: waagrecht ? kreuzS - i : kreuzS,
            waagrecht,
          };

          const kreuzungen = passt(wort, p);
          if (kreuzungen === null || kreuzungen === 0) continue;

          // Mehr Kreuzungen sind besser, und je näher an der Mitte, desto
          // kompakter bleibt das Gitter.
          const mitte = Math.abs(p.zeile - MAX / 2) + Math.abs(p.spalte - MAX / 2);
          const punkte = kreuzungen * 100 - mitte;
          if (!beste || punkte > beste.punkte) beste = { p, punkte };
        }
      }
    }

    if (!beste) {
      ausgelassen.push(w.anzeigewort);
      continue;
    }
    setze(wort, beste.p);
    gelegt.push({
      wort,
      anzeigewort: w.anzeigewort,
      hinweis: w.hinweis,
      ...beste.p,
    });
  }

  // Auf das belegte Rechteck zuschneiden.
  let minZ = MAX,
    maxZ = 0,
    minS = MAX,
    maxS = 0;
  for (let z = 0; z < MAX; z++) {
    for (let s = 0; s < MAX; s++) {
      if (raster[z][s] !== null) {
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
        minS = Math.min(minS, s);
        maxS = Math.max(maxS, s);
      }
    }
  }

  const zeilen = maxZ - minZ + 1;
  const spalten = maxS - minS + 1;
  const felder = Array.from({ length: zeilen }, (_, z) =>
    Array.from({ length: spalten }, (_, s) => raster[minZ + z][minS + s])
  );

  // Nummeriert wird wie üblich: von links oben nach rechts unten, eine Nummer
  // pro Feld, an dem ein Wort beginnt.
  const verschoben = gelegt
    .map((g) => ({ ...g, zeile: g.zeile - minZ, spalte: g.spalte - minS }))
    .sort((a, b) => a.zeile - b.zeile || a.spalte - b.spalte);

  const nummern: (number | null)[][] = Array.from({ length: zeilen }, () =>
    Array<number | null>(spalten).fill(null)
  );
  const woerterMitNummer: GelegtesWort[] = [];
  let naechste = 1;
  for (const g of verschoben) {
    const schon = nummern[g.zeile][g.spalte];
    const nummer = schon ?? naechste;
    if (schon === null) {
      nummern[g.zeile][g.spalte] = nummer;
      naechste++;
    }
    woerterMitNummer.push({ ...g, nummer });
  }

  return {
    zeilen,
    spalten,
    felder,
    nummern,
    woerter: woerterMitNummer.sort(
      (a, b) => a.nummer - b.nummer || Number(b.waagrecht) - Number(a.waagrecht)
    ),
    ausgelassen,
  };
}
