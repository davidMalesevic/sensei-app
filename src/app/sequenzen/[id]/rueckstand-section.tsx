import { Badge } from "@/components/ui/badge";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import type { OffenerStoff } from "@/lib/rueckstand";

/**
 * Was aus früheren Wochen noch aussteht.
 *
 * Bis zum Rückstands-Umbau gab es diesen Abschnitt nicht — und die Sache auch
 * nicht: die Planung sah ausschliesslich die Modulplan-Zeile der laufenden
 * KW. Blieb in KW 36 die Hälfte von Block 2 liegen, war sie in KW 37 spurlos
 * verschwunden, weil KW 37 nur noch Block 3 nennt.
 *
 * Bewusst **sachlich, nicht rot**: Rückstand ist im Unterricht der Normalfall
 * und keine Störung. `support-error` ist für Gefahr reserviert.
 */
export function RueckstandSection({ offen }: { offen: OffenerStoff }) {
  const { rueckstand, anzahlRueckstand, wochenOhneRueckmeldung } = offen;
  if (rueckstand.length === 0 && wochenOhneRueckmeldung.length === 0) return null;

  // Wer den Übertrag über ein Semester nicht ausfüllt, bekäme sonst eine Liste
  // aus zwanzig Kalenderwochen zu lesen. Die jüngsten sind die, die zählen.
  const HOECHSTENS = 3;
  const letzteWochen = wochenOhneRueckmeldung.slice(-HOECHSTENS);
  const weitere = wochenOhneRueckmeldung.length - letzteWochen.length;

  return (
    <section className="mb-12">
      <SectionHeader
        titel="Rückstand"
        beschreibung={
          rueckstand.length > 0
            ? "Aus früheren Wochen offen — steht im Ablauf vor dem Stoff dieser Woche."
            : undefined
        }
        aktionen={
          anzahlRueckstand > 0 ? (
            <Badge variant="blue">
              {anzahlRueckstand} {anzahlRueckstand === 1 ? "Aufgabe" : "Aufgaben"}
            </Badge>
          ) : undefined
        }
      />

      {/* Ohne Rückmeldung weiss Sensei den Stand jener Woche nicht — und
          erfindet ihn nicht. Genannt wird die Lücke trotzdem, sonst sieht die
          Rückstandszahl vollständiger aus, als sie ist. */}
      {wochenOhneRueckmeldung.length > 0 && (
        <Notification
          kind="info"
          titel={
            wochenOhneRueckmeldung.length === 1
              ? `KW ${wochenOhneRueckmeldung[0]} ohne Rückmeldung`
              : `${wochenOhneRueckmeldung.length} Wochen ohne Rückmeldung`
          }
          className="mb-4"
        >
          {wochenOhneRueckmeldung.length > 1 && (
            <>
              KW {letzteWochen.join(", ")}
              {weitere > 0 && ` und ${weitere} weitere`}.{" "}
            </>
          )}
          Ohne Übertrag ist nicht bestimmbar, was dort offen blieb — diese
          Wochen sind im Rückstand deshalb nicht enthalten.
        </Notification>
      )}

      {rueckstand.length > 0 && (
        <div className="space-y-px">
          {rueckstand.map((r) => (
            <div key={r.kw} className="bg-layer">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-strong bg-layer-accent px-4 py-3">
                <Badge variant="blue" size="sm">
                  KW {r.kw}
                </Badge>
                {r.ziel && (
                  <span className="type-heading-compact-02 min-w-0 flex-1 text-foreground">
                    {r.ziel}
                  </span>
                )}
                <span className="type-body-compact-02 text-text-secondary">
                  {r.anzahl} offen
                </span>
              </div>

              {r.bloecke.map((b) => (
                <div key={b.schluessel}>
                  {b.auftraege.map((a) => (
                    <div
                      key={a.code}
                      className="border-b border-border-subtle px-4 py-3 last:border-b-0"
                    >
                      <code className="type-helper-02 font-mono text-text-helper">
                        {a.code}
                      </code>
                      <ul className="mt-2 space-y-1">
                        {/* Module ohne nummerierte Aufgaben: dort ist der LA
                            selbst die Einheit — sonst stünde hier nichts. */}
                        {a.aufgaben.length === 0 ? (
                          <li className="type-body-02 text-text-secondary">
                            ganzer Lern- und Arbeitsauftrag
                          </li>
                        ) : (
                          a.aufgaben.map((auf) => (
                            <li
                              key={auf.bezeichnung}
                              className="type-body-02 flex flex-wrap items-baseline gap-x-2"
                            >
                              <span className="type-heading-compact-02 text-foreground">
                                {auf.bezeichnung}
                              </span>
                              {auf.teilaufgaben.length > 0 && (
                                <span className="text-text-secondary">
                                  {auf.teilaufgaben.map((t) => t.bezeichnung).join(", ")}
                                </span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
