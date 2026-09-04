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
import { erledigtMarke, type Wochenstoff } from "@/lib/modulbaum";
import type { OffenerStoff } from "@/lib/rueckstand";
import { schweizerHeute } from "@/lib/zeit";

/**
 * Gegliedert wie «Stoff dieser Woche»: der LA-Code trägt die Gruppe, die
 * Aufgaben stehen darunter. Eine flache Liste wiederholte den Code auf jeder
 * Zeile — bei vier LAs derselben Woche liest sich das als Rauschen, und die
 * beiden Abschnitte sähen ohne Grund verschieden aus.
 */
function baueGruppen(bloecke: Wochenstoff["bloecke"]) {
  return bloecke.flatMap((b) =>
    b.auftraege
      .map((a) => ({
        code: a.code,
        aufgaben:
          // Module ohne nummerierte Aufgaben (z.B. 168): dort ist der LA
          // selbst die Einheit, die abgehakt wird.
          a.aufgaben.length === 0
            ? [
                {
                  wert: a.code,
                  // Der Code steht schon als Gruppenkopf darüber — hier
                  // nochmals wäre er nur Rauschen.
                  bezeichnung: "ganzer Lern- und Arbeitsauftrag",
                  teilaufgaben: [] as string[],
                },
              ]
            : a.aufgaben.map((auf) => ({
                wert: erledigtMarke(a.code, auf.bezeichnung),
                bezeichnung: auf.bezeichnung,
                teilaufgaben: auf.teilaufgaben.map((t) => t.bezeichnung),
              })),
      }))
      .filter((g) => g.aufgaben.length > 0)
  );
}

export type UebertragDaten = {
  uebertrag: string | null;
  uebertragErledigt: string[] | null;
  uebertragSlideBis: number | null;
  keinUebertrag: boolean;
  uebertragAm: Date | null;
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
  offen,
}: {
  sequenzId: string;
  datum: string | null;
  daten: UebertragDaten;
  /**
   * Laufende Woche **und** Rückstand. Beides muss abhakbar sein: eine
   * nachgeholte Aufgabe aus KW 36 hatte hier bisher gar kein Kästchen, der
   * Rückstand liess sich also nicht auflösen.
   */
  offen: OffenerStoff;
}) {
  const heute = schweizerHeute();
  const gehalten = datum !== null && datum <= heute;
  /**
   * Erfasst ist ein Übertrag, sobald er **gespeichert** wurde — nicht erst,
   * wenn eine Notiz getippt ist. Vorher galt `uebertrag !== null`: wer nur
   * Aufgaben abhakte und eine Slidezahl eintrug, sah das Formular danach
   * unverändert wieder und musste glauben, das Speichern habe nicht
   * funktioniert. Gespeichert war es die ganze Zeit.
   */
  const erfasst = daten.keinUebertrag || daten.uebertragAm !== null;

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
          {/* «Kein Übertrag» materialisiert seit dem Rückstands-Umbau die
              Aufgabenliste der Woche. Die Bedingung darf deshalb nicht mehr
              verlangen, dass sie leer ist — sonst verschwände diese Aussage
              genau dann, wenn sie zutrifft. */}
          {daten.keinUebertrag && !daten.uebertrag ? (
            <div className="space-y-4">
              <p className="type-body-02 text-text-secondary">
                Kein Übertrag — alles lief wie geplant und ist erledigt.
              </p>
              {daten.uebertragErledigt && daten.uebertragErledigt.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {daten.uebertragErledigt.map((e) => (
                    <Badge key={e} variant="green" size="sm">
                      {e}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
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

  // Zwei Abteilungen: erst was liegengeblieben ist, dann was diese Woche neu
  // ansteht. Der Rückstand steht oben, weil er zuerst drankommt.
  const abteilungen = [
    ...offen.rueckstand.map((r) => ({
      titel: `Rückstand aus KW ${r.kw}`,
      rueckstand: true,
      gruppen: baueGruppen(r.bloecke),
    })),
    {
      titel: offen.diese ? `Diese Woche · KW ${offen.diese.kw}` : "Diese Woche",
      rueckstand: false,
      gruppen: baueGruppen(offen.diese?.bloecke ?? []),
    },
  ].filter((a) => a.gruppen.length > 0);

  const anzahlOffen = abteilungen.reduce(
    (n, a) => n + a.gruppen.reduce((m, g) => m + g.aufgaben.length, 0),
    0
  );

  // Was aus dieser Woche schon abgehakt ist, steht nicht mehr zur Wahl — sonst
  // «will» Sensei jede Woche dieselben Aufgaben erledigt haben.
  const alleDieseWoche = (offen.dieseRoh?.bloecke ?? []).reduce(
    (n, b) =>
      n +
      b.auftraege.reduce(
        (m, a) => m + (a.aufgaben.length === 0 ? 1 : a.aufgaben.length),
        0
      ),
    0
  );
  const offenDieseWoche = (offen.diese?.bloecke ?? []).reduce(
    (n, b) =>
      n +
      b.auftraege.reduce(
        (m, a) => m + (a.aufgaben.length === 0 ? 1 : a.aufgaben.length),
        0
      ),
    0
  );
  const uebrig = alleDieseWoche - offenDieseWoche;

  return (
    <section className="mb-12">
      <SectionHeader titel="Übertrag" />

      <Notification kind="warning" titel="Übertrag fehlt" className="mb-4">
        Bis wo seid ihr gekommen? Ohne das fehlt der nächsten Sequenz der
        Ausgangspunkt.
      </Notification>

      <div className="bg-layer p-4">
        <form action={speichern}>
          {anzahlOffen > 0 && (
            <fieldset className="mb-8">
              <legend className="type-label-02 mb-3 text-text-secondary">
                Erledigt
              </legend>
              {uebrig > 0 && (
                <HelperText className="mb-3">
                  {uebrig}{" "}
                  {uebrig === 1 ? "Aufgabe dieser Woche gilt" : "Aufgaben dieser Woche gelten"}{" "}
                  bereits als erledigt und {uebrig === 1 ? "steht" : "stehen"} hier
                  nicht mehr.
                </HelperText>
              )}
              <div className="space-y-6">
                {abteilungen.map((abt) => (
                  <div key={abt.titel}>
                    {/* Der Rückstand trägt einen 3px-Balken links: er ist der
                        Grund, warum diese Liste überhaupt länger sein kann als
                        die Woche. */}
                    <div
                      className={
                        abt.rueckstand
                          ? "mb-2 border-l-[3px] border-l-border-interactive pl-3"
                          : "mb-2"
                      }
                    >
                      <span className="type-label-02 text-text-secondary">
                        {abt.titel}
                      </span>
                    </div>
                    {abt.gruppen.map((g) => (
                      <div
                        key={g.code}
                        className="border-b border-border-subtle py-3 last:border-b-0 last:pb-0"
                      >
                        <code className="type-helper-02 font-mono text-text-helper">
                          {g.code}
                        </code>
                        <div className="mt-2">
                          {g.aufgaben.map((auf) => (
                            <label
                              key={auf.wert}
                              className="type-body-02 flex cursor-pointer items-baseline gap-3 py-1"
                            >
                              <input
                                type="checkbox"
                                name="erledigt"
                                value={auf.wert}
                                className="carbon-checkbox shrink-0 self-center"
                              />
                              <span className="type-heading-compact-02 text-foreground">
                                {auf.bezeichnung}
                              </span>
                              {auf.teilaufgaben.length > 0 && (
                                <span className="text-text-secondary">
                                  {auf.teilaufgaben.join(", ")}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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

        {/* Der Knopf schliesst die Woche ab: ihre Aufgaben gelten danach als
            erledigt und kommen nie wieder. Was er behauptet, muss deshalb
            draufstehen — dieselbe Lektion wie beim Ablauf-Weitergeben, wo
            «Ablauf ersetzen» eine fertige Planung gekostet hat. */}
        <form action={keiner} className="mt-4">
          <Button type="submit" variant="ghost" size="sm">
            {anzahlOffen > 0
              ? `Kein Übertrag · alle ${anzahlOffen} ${anzahlOffen === 1 ? "Aufgabe" : "Aufgaben"} erledigt`
              : "Kein Übertrag · alles wie geplant"}
          </Button>
        </form>
      </div>
    </section>
  );
}
