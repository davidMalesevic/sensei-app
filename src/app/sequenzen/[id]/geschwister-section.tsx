"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, Unlink } from "@carbon/icons-react";

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

/**
 * Dasselbe Modul, dieselbe Woche, andere Klasse.
 *
 * Von sieben Sequenzen pro Woche sind vier Dubletten — einmal planen, dann
 * übernehmen. Fortschritt und Notizen bleiben pro Klasse getrennt, damit
 * sichtbar wird, wenn die Klassen auseinanderlaufen.
 */
export function GeschwisterSection({
  sequenzId,
  eigeneSchritte,
  uebernommenVon,
  geschwister,
}: {
  sequenzId: string;
  eigeneSchritte: number;
  uebernommenVon: string | null;
  geschwister: Geschwister[];
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();

  if (geschwister.length === 0) return null;

  const quelle = geschwister.find((g) => g.id === uebernommenVon);

  function uebernehmen(quelleId: string) {
    startTransition(async () => {
      await uebernehmeAblauf(sequenzId, quelleId);
      router.refresh();
    });
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

              {g.schritte > 0 && g.id !== uebernommenVon && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto shrink-0"
                  onClick={() => uebernehmen(g.id)}
                  disabled={laeuft}
                  title={
                    eigeneSchritte > 0
                      ? "Ersetzt den hiesigen Ablauf"
                      : "Ablauf von dieser Klasse übernehmen"
                  }
                >
                  {eigeneSchritte > 0 ? "Ablauf ersetzen" : "Ablauf übernehmen"}
                  <Copy size={16} />
                </Button>
              )}
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
