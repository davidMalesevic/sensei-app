import type { Mindmap as MindmapDaten } from "@/lib/einstieg-daten";

/**
 * Mindmap als Baum, von links nach rechts.
 *
 * Gezeichnet wird serverseitig als SVG — kein Skript, kein Nachladen, und im
 * Ausdruck steht dasselbe wie am Bildschirm. Das Layout ist die übliche
 * Tiefensuche: jedes Blatt bekommt eine eigene Zeile, jeder Knoten sitzt auf
 * der Mitte seiner Kinder.
 */

type Knoten = {
  text: string;
  tiefe: number;
  y: number;
  kinder: Knoten[];
};

const ZEILE = 34;
const SPALTE = 190;
const RAND = 12;

function lege(daten: MindmapDaten, tiefe: number, zaehler: { y: number }): Knoten {
  if (daten.kinder.length === 0) {
    const y = zaehler.y;
    zaehler.y += 1;
    return { text: daten.text, tiefe, y, kinder: [] };
  }
  const kinder = daten.kinder.map((k) => lege(k, tiefe + 1, zaehler));
  const y = (kinder[0].y + kinder[kinder.length - 1].y) / 2;
  return { text: daten.text, tiefe, y, kinder };
}

function alle(k: Knoten): Knoten[] {
  return [k, ...k.kinder.flatMap(alle)];
}

/** Umbruch von Hand: SVG kennt keinen Textfluss. */
function umbrechen(text: string, proZeile: number): string[] {
  const woerter = text.split(/\s+/);
  const zeilen: string[] = [];
  let aktuell = "";
  for (const w of woerter) {
    if (aktuell && (aktuell + " " + w).length > proZeile) {
      zeilen.push(aktuell);
      aktuell = w;
    } else {
      aktuell = aktuell ? `${aktuell} ${w}` : w;
    }
  }
  if (aktuell) zeilen.push(aktuell);
  return zeilen.slice(0, 3);
}

export function Mindmap({ daten }: { daten: MindmapDaten }) {
  const wurzel = lege(daten, 0, { y: 0 });
  const knoten = alle(wurzel);
  const maxTiefe = Math.max(...knoten.map((k) => k.tiefe));
  const maxY = Math.max(...knoten.map((k) => k.y));

  const breite = (maxTiefe + 1) * SPALTE + RAND * 2;
  const hoehe = (maxY + 1) * ZEILE + RAND * 2;
  const x = (k: Knoten) => RAND + k.tiefe * SPALTE;
  const y = (k: Knoten) => RAND + k.y * ZEILE + ZEILE / 2;

  return (
    <svg
      viewBox={`0 0 ${breite} ${hoehe}`}
      className="w-full"
      style={{ maxHeight: `${hoehe}px` }}
      role="img"
      aria-label={`Mindmap zu ${daten.text}`}
    >
      {knoten.flatMap((k) =>
        k.kinder.map((kind) => {
          const x1 = x(k) + 150;
          const x2 = x(kind);
          const mitte = (x1 + x2) / 2;
          return (
            <path
              key={`${k.text}-${kind.text}-${kind.y}`}
              d={`M ${x1} ${y(k)} C ${mitte} ${y(k)}, ${mitte} ${y(kind)}, ${x2} ${y(kind)}`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={1}
            />
          );
        })
      )}
      {knoten.map((k) => {
        const zeilen = umbrechen(k.text, k.tiefe === 0 ? 18 : 22);
        return (
          <g key={`${k.tiefe}-${k.y}-${k.text}`}>
            {k.tiefe === 0 && (
              <rect
                x={x(k) - 6}
                y={y(k) - 14}
                width={156}
                height={28}
                fill="var(--layer-accent)"
              />
            )}
            <text
              x={x(k)}
              y={y(k) - (zeilen.length - 1) * 6}
              className={
                k.tiefe === 0
                  ? "type-heading-compact-02"
                  : k.tiefe === 1
                    ? "type-body-compact-02"
                    : "type-helper-02"
              }
              fill="currentColor"
              dominantBaseline="middle"
            >
              {zeilen.map((z, i) => (
                <tspan key={i} x={x(k)} dy={i === 0 ? 0 : 12}>
                  {z}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
