import { Checkmark } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Notification } from "@/components/ui/notification";
import { SectionHeader, DataItem } from "@/components/ui/page-header";
import {
  speichereUebertrag,
  keinUebertragSetzen,
  uebertragZuruecksetzen,
} from "../uebertrag-actions";
import type { Wochenstoff } from "@/lib/modulbaum";
import { schweizerHeute } from "@/lib/zeit";

export type UebertragDaten = {
  uebertrag: string | null;
  uebertragErledigt: string[] | null;
  uebertragSlideBis: number | null;
  keinUebertrag: boolean;
};

/**
 * Der Übertrag nach der Lektion — die einzige Eingabe, die im neuen Prozess
 * bleibt. Die Häkchen kommen aus dem Wochenstoff, damit nur noch angeklickt
 * statt getippt werden muss.
 */
export function UebertragSection({
  sequenzId,
  datum,
  daten,
  stoff,
}: {
  sequenzId: string;
  datum: string | null;
  daten: UebertragDaten;
  stoff: Wochenstoff | null;
}) {
  const heute = schweizerHeute();
  const gehalten = datum !== null && datum <= heute;
  const erfasst = daten.keinUebertrag || daten.uebertrag !== null;

  // Noch nicht stattgefunden und nichts erfasst: nicht im Weg stehen.
  if (!gehalten && !erfasst) return null;

  if (erfasst) {
    const zuruecksetzen = uebertragZuruecksetzen.bind(null, sequenzId);
    return (
      <section className="mb-12">
        <SectionHeader
          titel="Übertrag"
          aktionen={
            <form action={zuruecksetzen}>
              <Button type="submit" variant="ghost" size="sm">
                Ändern
              </Button>
            </form>
          }
        />

        <div className="border-l-[3px] border-l-support-success bg-layer p-4">
          {daten.keinUebertrag && !daten.uebertrag ? (
            <p className="type-body-02 text-text-secondary">
              Kein Übertrag — nichts nachzutragen.
            </p>
          ) : (
            <div className="space-y-4">
              {daten.uebertragSlideBis !== null && (
                <DataItem label="Gekommen bis">
                  Slide {daten.uebertragSlideBis}
                </DataItem>
              )}

              {daten.uebertragErledigt && daten.uebertragErledigt.length > 0 && (
                <div>
                  <div className="type-label-02 mb-2 text-text-helper">
                    Erledigt
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {daten.uebertragErledigt.map((e) => (
                      <Badge key={e} variant="green" size="sm">
                        {e}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {daten.uebertrag && (
                <div>
                  <div className="type-label-02 mb-1 text-text-helper">Notiz</div>
                  <p className="type-body-02 whitespace-pre-wrap text-foreground">
                    {daten.uebertrag}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  const speichern = speichereUebertrag.bind(null, sequenzId);
  const keiner = keinUebertragSetzen.bind(null, sequenzId);

  const aufgaben = (stoff?.bloecke ?? []).flatMap((b) =>
    b.auftraege.flatMap((a) =>
      a.aufgaben.map((auf) => ({
        wert: `${a.code} · ${auf.bezeichnung}`,
        code: a.code,
        bezeichnung: auf.bezeichnung,
      }))
    )
  );

  return (
    <section className="mb-12">
      <SectionHeader titel="Übertrag" />

      <Notification kind="warning" titel="Übertrag fehlt" className="mb-4">
        Bis wo seid ihr gekommen? Ohne das fehlt der nächsten Sequenz der
        Ausgangspunkt.
      </Notification>

      <div className="bg-layer p-4">
        <form action={speichern}>
          {aufgaben.length > 0 && (
            <fieldset className="mb-8">
              <legend className="type-label-02 mb-3 text-text-secondary">
                Erledigt
              </legend>
              <div>
                {aufgaben.map((a) => (
                  <label
                    key={a.wert}
                    className="type-body-compact-02 flex cursor-pointer items-center gap-3 border-b border-border-subtle py-2 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      name="erledigt"
                      value={a.wert}
                      className="carbon-checkbox"
                    />
                    <span className="font-semibold">{a.bezeichnung}</span>
                    <code className="type-helper-02 font-mono text-text-helper">
                      {a.code}
                    </code>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mb-8 max-w-xs">
            <Label htmlFor="slideBis">Gekommen bis Slide</Label>
            <Input
              id="slideBis"
              name="slideBis"
              inputMode="numeric"
              placeholder="z.B. 22"
              className="mt-2"
            />
          </div>

          <div className="mb-8 max-w-2xl">
            <Label htmlFor="uebertrag">Notizen für nächste Woche</Label>
            <Textarea
              id="uebertrag"
              name="uebertrag"
              rows={3}
              className="mt-2"
              placeholder="Was ist offen, was lief anders als geplant, worauf muss ich zurückkommen?"
            />
            <HelperText className="mt-2">
              Die App kann nichts wissen, was nicht getippt wird.
            </HelperText>
          </div>

          <Button type="submit">
            Übertrag sichern
            <Checkmark size={16} />
          </Button>
        </form>

        <form action={keiner} className="mt-4">
          <Button type="submit" variant="ghost" size="sm">
            Kein Übertrag
          </Button>
        </form>
      </div>
    </section>
  );
}
