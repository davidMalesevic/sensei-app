import { Badge } from "@/components/ui/badge";
import type { MemoryPaar, TabuKarte } from "@/lib/einstieg-daten";

/**
 * Karten zum Ausschneiden.
 *
 * Ein Raster mit Schnittkanten statt hübscher Kacheln: gedruckt wird das
 * zerschnitten, also muss jede Karte einen sichtbaren Rand haben und für sich
 * allein lesbar sein. `break-inside-avoid` hält eine Karte auf einer Seite.
 */

function Karte({
  kopf,
  children,
}: {
  kopf?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-28 break-inside-avoid flex-col justify-between border border-dashed border-border-strong p-3">
      {kopf && <div className="mb-2">{kopf}</div>}
      <div className="type-body-02">{children}</div>
    </div>
  );
}

export function MemoryKarten({ daten }: { daten: MemoryPaar[] }) {
  // Gemischt, aber deterministisch: der Ausdruck von morgen sieht aus wie der
  // von heute. Gezählt wird über die Paar-Nummer, damit die Zuordnung
  // nachvollziehbar bleibt.
  const karten = daten
    .flatMap((p) => [
      { paar: p.id, seite: "A", text: p.karte_a, typ: p.paartyp },
      { paar: p.id, seite: "B", text: p.karte_b, typ: p.paartyp },
    ])
    .sort((a, b) => (a.paar * 7 + a.seite.charCodeAt(0)) % 13 - ((b.paar * 7 + b.seite.charCodeAt(0)) % 13));

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {karten.map((k) => (
          <Karte key={`${k.paar}${k.seite}`}>{k.text}</Karte>
        ))}
      </div>
      <details className="print:hidden">
        <summary className="type-label-02 cursor-pointer text-text-secondary">
          Paare (Lösung)
        </summary>
        <ul className="type-body-compact-02 mt-2 grid gap-1">
          {daten.map((p) => (
            <li key={p.id}>
              <span className="font-mono">{p.id}</span> {p.karte_a} — {p.karte_b}
              {p.paartyp && (
                <span className="text-text-helper"> · {p.paartyp}</span>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function TabuKarten({ daten }: { daten: TabuKarte[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {daten.map((k) => (
        <Karte
          key={k.begriff}
          kopf={
            <div className="flex items-baseline justify-between gap-2 border-b border-border-strong pb-1">
              <span className="type-heading-02">{k.begriff}</span>
              <Badge variant="ghost" size="sm">
                {k.stufe === 1 ? "leicht" : "schwer"}
              </Badge>
            </div>
          }
        >
          <ul className="type-body-compact-02 grid gap-0.5 text-text-secondary">
            {k.verboten.map((v) => (
              <li key={v}>✗ {v}</li>
            ))}
          </ul>
        </Karte>
      ))}
    </div>
  );
}
