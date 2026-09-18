import type { Begriffsnetz as Netz } from "@/lib/einstieg-daten";

/**
 * Begriffsnetz: Begriffe auf einem Kreis, Beziehungen als beschriftete Kanten.
 *
 * Ein richtiges Graphenlayout (kräftebasiert) bräuchte ein Skript im Browser
 * und käme bei jedem Laden anders heraus. Der Kreis ist langweilig, aber
 * vorhersagbar, druckbar und bei einem Dutzend Begriffen gut lesbar — und
 * genau darum geht es: die Klasse soll die Verbindungen ziehen, nicht die
 * Grafik bewundern.
 *
 * Die **Fehlverbindungen** stehen bewusst nicht im Bild: sie sind das
 * Material der Lehrperson für die Besprechung, nicht Teil der Vorlage.
 */
export function Begriffsnetz({ daten }: { daten: Netz }) {
  const n = daten.begriffe.length;
  if (n === 0) return null;

  const gr = 300;
  const rand = 110;
  const mitte = gr + rand;
  const punkte = daten.begriffe.map((b, i) => {
    // Oben beginnen und im Uhrzeigersinn: so liest sich die Liste daneben
    // in derselben Reihenfolge wie das Bild.
    const winkel = (i / n) * 2 * Math.PI - Math.PI / 2;
    return {
      begriff: b,
      x: mitte + Math.cos(winkel) * gr,
      y: mitte + Math.sin(winkel) * gr * 0.8,
      rechts: Math.cos(winkel) > 0.1,
      links: Math.cos(winkel) < -0.1,
    };
  });
  const finde = (name: string) =>
    punkte.find((p) => p.begriff.toLowerCase() === name.toLowerCase());

  return (
    <svg
      viewBox={`0 0 ${mitte * 2} ${mitte * 2 - gr * 0.4}`}
      className="w-full"
      role="img"
      aria-label="Begriffsnetz"
    >
      {daten.relationen.map((r, i) => {
        const a = finde(r.von);
        const b = finde(r.nach);
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={i}>
            <path
              d={`M ${a.x} ${a.y} Q ${(mx + mitte) / 2} ${(my + mitte) / 2}, ${b.x} ${b.y}`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth={1}
            />
            <text
              x={(a.x + mx + mitte / 2) / 2.5}
              y={(a.y + my + mitte / 2) / 2.5}
              className="type-helper-02"
              fill="var(--text-helper)"
              textAnchor="middle"
            >
              {r.beschriftung}
            </text>
          </g>
        );
      })}

      {punkte.map((p) => (
        <g key={p.begriff}>
          <circle cx={p.x} cy={p.y} r={6} fill="var(--border-inverse)" />
          <text
            x={p.x + (p.rechts ? 12 : p.links ? -12 : 0)}
            y={p.y - 14}
            className="type-body-compact-02"
            fill="currentColor"
            textAnchor={p.rechts ? "start" : p.links ? "end" : "middle"}
          >
            {p.begriff}
          </text>
        </g>
      ))}
    </svg>
  );
}
