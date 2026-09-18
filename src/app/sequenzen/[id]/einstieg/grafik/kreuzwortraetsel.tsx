import type { RaetselWort } from "@/lib/einstieg-daten";
import { baueGitter } from "@/lib/kreuzwortraetsel";

/**
 * Kreuzworträtsel: Gitter zum Ausfüllen, Hinweise daneben, Lösung getrennt.
 *
 * Das Gitter rechnet `src/lib/kreuzwortraetsel.ts` — die KI liefert nur Wörter
 * und Hinweise. Ein Sprachmodell kann keine Buchstaben zählen; ein Gitter, das
 * es beschreibt, geht beim Nachrechnen fast immer nicht auf.
 */
export function Kreuzwortraetsel({
  daten,
  loesung = false,
}: {
  daten: RaetselWort[];
  /** Mit Buchstaben statt leeren Feldern — nur für die Lehrperson. */
  loesung?: boolean;
}) {
  const gitter = baueGitter(daten);
  if (!gitter) return null;

  const waagrecht = gitter.woerter.filter((w) => w.waagrecht);
  const senkrecht = gitter.woerter.filter((w) => !w.waagrecht);

  return (
    <div className="grid gap-6">
      <div className="overflow-x-auto">
        <table
          className="border-collapse"
          role="presentation"
          style={{ tableLayout: "fixed" }}
        >
          <tbody>
            {gitter.felder.map((zeile, z) => (
              <tr key={z}>
                {zeile.map((feld, s) => {
                  const nummer = gitter.nummern[z][s];
                  if (feld === null) {
                    return <td key={s} className="size-8 border-0" />;
                  }
                  return (
                    <td
                      key={s}
                      className="relative size-8 border border-border-strong text-center align-middle"
                    >
                      {nummer !== null && (
                        <span className="absolute top-0 left-0.5 text-[9px] leading-none text-text-helper">
                          {nummer}
                        </span>
                      )}
                      {loesung && (
                        <span className="type-body-compact-02 font-mono">{feld}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {[
          { titel: "Waagrecht", woerter: waagrecht },
          { titel: "Senkrecht", woerter: senkrecht },
        ].map((spalte) => (
          <div key={spalte.titel}>
            <h4 className="type-heading-compact-02 mb-1">{spalte.titel}</h4>
            <ul className="type-body-compact-02 grid gap-1">
              {spalte.woerter.map((w) => (
                <li key={`${w.nummer}-${w.wort}`}>
                  <span className="font-mono">{w.nummer}</span> {w.hinweis}{" "}
                  <span className="text-text-helper">({w.wort.length})</span>
                  {loesung && (
                    <span className="ml-1 font-mono text-text-secondary">
                      → {w.anzeigewort}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {gitter.ausgelassen.length > 0 && (
        <p className="type-helper-02 text-text-helper">
          Ohne Kreuzung geblieben und deshalb nicht im Gitter:{" "}
          {gitter.ausgelassen.join(", ")}. Als mündliche Zusatzfrage brauchbar.
        </p>
      )}
    </div>
  );
}
