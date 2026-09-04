"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Unlink } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineLoading } from "@/components/ui/loading";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import {
  uebernehmeAblauf,
  loeseUebernahme,
  type Geschwister,
} from "../entwurf-actions";

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tag(datum: string | null): string {
  if (!datum) return "";
  const d = new Date(datum + "T00:00:00");
  return `${WOCHENTAGE[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

function standText(g: {
  uebertragSlideBis: number | null;
  uebertragErledigt: string[] | null;
}): string | null {
  const teile = [
    g.uebertragSlideBis !== null ? `bis Slide ${g.uebertragSlideBis}` : null,
    g.uebertragErledigt?.length ? `${g.uebertragErledigt.length} erledigt` : null,
  ].filter(Boolean);
  return teile.length > 0 ? teile.join(", ") : null;
}

/** Wohin der Ablauf wandert. Beide Richtungen gehen über dieselbe Aktion. */
type Vorhaben = { richtung: "geben" | "holen"; ziel: Geschwister };

/**
 * Dasselbe Modul, dieselbe Woche, andere Klasse.
 *
 * Von sieben Sequenzen pro Woche sind vier Dubletten — einmal planen, dann
 * weitergeben. Fortschritt und Notizen bleiben pro Klasse getrennt, damit
 * sichtbar wird, wenn die Klassen auseinanderlaufen.
 *
 * **Beide Richtungen stehen hier, und beide nennen die Klasse.** Vorher gab es
 * nur ein Holen, und der Knopf hiess «Ablauf ersetzen» — in der Zeile der
 * anderen Klasse gelesen also «ersetze deren Ablauf». Er ersetzte aber den
 * hiesigen: wer eben geplant und bestätigt hatte und ihn weitergeben wollte,
 * holte sich damit den alten Ablauf der Parallelklasse zurück und verlor die
 * eigene Arbeit. Ein Pfeil und der Klassenname sagen jetzt, wohin es geht,
 * und überschrieben wird nichts mehr ohne Rückfrage.
 */
export function GeschwisterSection({
  sequenzId,
  klasse,
  eigeneSchritte,
  uebernommenVon,
  geschwister,
}: {
  sequenzId: string;
  /** Die eigene Klasse — damit die Rückfrage sagen kann, wer was verliert. */
  klasse: string;
  eigeneSchritte: number;
  uebernommenVon: string | null;
  geschwister: Geschwister[];
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();
  const [vorhaben, setVorhaben] = useState<Vorhaben | null>(null);

  if (geschwister.length === 0) return null;

  const quelle = geschwister.find((g) => g.id === uebernommenVon);

  function ausfuehren(v: Vorhaben) {
    setVorhaben(null);
    startTransition(async () => {
      await (v.richtung === "geben"
        ? uebernehmeAblauf(v.ziel.id, sequenzId)
        : uebernehmeAblauf(sequenzId, v.ziel.id));
      router.refresh();
    });
  }

  /**
   * Nur fragen, wenn beim Ziel auch etwas zu verlieren ist. Ein Ablauf, der
   * ohnehin von hier stammt, ist nichts Eigenes — ihn aufzufrischen, nachdem
   * hier nachgebessert wurde, ist der Normalfall und keine Rückfrage wert.
   */
  function anfragen(v: Vorhaben) {
    const zuVerlieren =
      v.richtung === "geben"
        ? v.ziel.uebernommenVon === sequenzId
          ? 0
          : v.ziel.schritte
        : eigeneSchritte;
    if (zuVerlieren === 0) ausfuehren(v);
    else setVorhaben(v);
  }

  function loesen() {
    startTransition(async () => {
      await loeseUebernahme(sequenzId);
      router.refresh();
    });
  }

  const eigenerStand = geschwister.some(
    (g) => standText(g) !== null && g.uebertragSlideBis !== null
  );

  const zielKlasse =
    vorhaben?.richtung === "geben" ? vorhaben.ziel.klasse : klasse;
  const zielSchritte =
    vorhaben?.richtung === "geben" ? vorhaben.ziel.schritte : eigeneSchritte;

  return (
    <section className="mb-12">
      <SectionHeader
        titel="Parallelklassen"
        beschreibung={`Dieselbe Woche in ${geschwister.length} weiteren ${
          geschwister.length === 1 ? "Klasse" : "Klassen"
        }.`}
        aktionen={laeuft ? <InlineLoading /> : undefined}
      />

      {quelle && (
        <Notification
          kind="info"
          titel="Ablauf übernommen"
          className="mb-px"
          action={
            <Button
              variant="ghost"
              size="sm"
              onClick={loesen}
              disabled={laeuft}
              title="Ab hier plant diese Klasse eigenständig"
            >
              Übernahme lösen
              <Unlink size={16} />
            </Button>
          }
        >
          von {quelle.klasse} ({tag(quelle.startDatum)})
        </Notification>
      )}

      {vorhaben && (
        <div className="mb-px">
          <Notification kind="warning" titel={`${zielKlasse} verliert den eigenen Ablauf`}>
            Dort stehen {zielSchritte}{" "}
            {zielSchritte === 1 ? "Schritt" : "Schritte"}; sie werden durch{" "}
            {vorhaben.richtung === "geben" ? klasse : vorhaben.ziel.klasse}{" "}
            ersetzt und sind danach weg.
          </Notification>
          <div className="mt-px flex flex-wrap gap-px">
            <Button
              variant="secondary"
              onClick={() => setVorhaben(null)}
              disabled={laeuft}
            >
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={() => ausfuehren(vorhaben)}
              disabled={laeuft}
            >
              Trotzdem ersetzen
            </Button>
          </div>
        </div>
      )}

      <div className="bg-layer">
        {geschwister.map((g) => {
          const stand = standText(g);
          return (
            <div
              key={g.id}
              className="type-body-compact-02 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3 last:border-b-0"
            >
              <Link
                href={`/sequenzen/${g.id}`}
                className="w-28 shrink-0 font-semibold text-link underline-offset-2 hover:underline"
              >
                {g.klasse}
              </Link>
              <span className="w-24 shrink-0 text-text-secondary">
                {tag(g.startDatum)}
              </span>
              <Badge
                variant={g.schritte > 0 ? "cool-gray" : "outline"}
                size="sm"
                className="shrink-0"
              >
                {g.schritte > 0 ? `${g.schritte} Schritte` : "kein Ablauf"}
              </Badge>
              {stand && (
                <span className="type-helper-02 text-text-helper">{stand}</span>
              )}
              {g.uebernommenVon === sequenzId && (
                <span className="type-helper-02 text-text-helper">
                  hat von hier übernommen
                </span>
              )}
              {/* Unterschiedlicher Rückstand heisst: dort steht anderer Stoff
                  im Ablauf. Übernehmen bringt dann eine Planung, die zum
                  eigenen Stand nicht passt — das gehört an die Zeile, bevor
                  man klickt. */}
              {g.rueckstandWeichtAb && (
                <Badge variant="blue" size="sm" className="shrink-0">
                  anderer Rückstand
                </Badge>
              )}

              <div className="ml-auto flex shrink-0 flex-wrap gap-px">
                {/* Auch dann anbieten, wenn dort schon eine Kopie liegt —
                    sonst liesse sich eine Nachbesserung nie nachreichen. */}
                {eigeneSchritte > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => anfragen({ richtung: "geben", ziel: g })}
                    disabled={laeuft}
                    title={
                      g.uebernommenVon === sequenzId
                        ? `Frischt die Kopie bei ${g.klasse} auf`
                        : g.schritte > 0
                          ? `Ersetzt den Ablauf von ${g.klasse}`
                          : `Gibt diesen Ablauf an ${g.klasse}`
                    }
                  >
                    An {g.klasse} geben
                    <ArrowRight size={16} />
                  </Button>
                )}
                {g.schritte > 0 && g.id !== uebernommenVon && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => anfragen({ richtung: "holen", ziel: g })}
                    disabled={laeuft}
                    title={
                      g.rueckstandWeichtAb
                        ? `${g.klasse} hat einen anderen Rückstand — der Ablauf dort plant anderen Stoff`
                        : eigeneSchritte > 0
                          ? `Ersetzt den Ablauf von ${klasse}`
                          : `Holt den Ablauf von ${g.klasse} hierher`
                    }
                  >
                    Von {g.klasse} holen
                    <ArrowLeft size={16} />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {eigenerStand && (
        <p className="type-helper-02 mt-2 text-text-helper">
          Der Stand steht pro Klasse — laufen sie auseinander, siehst du es hier.
        </p>
      )}
    </section>
  );
}
