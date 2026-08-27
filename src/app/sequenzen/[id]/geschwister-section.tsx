"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyCheck, Copy, Loader2, Link2Off, AlertTriangle } from "lucide-react";
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
    <Card className="bg-muted/30">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <CopyCheck className="h-4 w-4" />
          Dieselbe Woche in {geschwister.length} weiteren{" "}
          {geschwister.length === 1 ? "Klasse" : "Klassen"}
          {laeuft && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {quelle && (
          <div className="flex flex-wrap items-center gap-2 text-sm rounded-md bg-background px-3 py-2">
            <span>
              Ablauf übernommen von <strong>{quelle.klasse}</strong> (
              {tag(quelle.startDatum)})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={loesen}
              disabled={laeuft}
              title="Ab hier plant diese Klasse eigenständig"
            >
              <Link2Off className="h-3.5 w-3.5" />
              Übernahme lösen
            </Button>
          </div>
        )}

        <div className="space-y-1">
          {geschwister.map((g) => {
            const stand = standText(g);
            return (
              <div
                key={g.id}
                className="flex flex-wrap items-center gap-3 text-sm rounded-md px-2 py-1.5 hover:bg-background"
              >
                <Link
                  href={`/sequenzen/${g.id}`}
                  className="w-24 shrink-0 font-medium hover:underline"
                >
                  {g.klasse}
                </Link>
                <span className="w-20 shrink-0 text-muted-foreground">
                  {tag(g.startDatum)}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                  {g.schritte > 0 ? `${g.schritte} Schritte` : "kein Ablauf"}
                </Badge>
                {stand && (
                  <span className="text-xs text-muted-foreground">{stand}</span>
                )}
                {g.uebernommenVon === sequenzId && (
                  <span className="text-xs text-muted-foreground">
                    hat von hier übernommen
                  </span>
                )}

                {g.schritte > 0 && g.id !== uebernommenVon && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => uebernehmen(g.id)}
                    disabled={laeuft}
                    title={
                      eigeneSchritte > 0
                        ? "Ersetzt den hiesigen Ablauf"
                        : "Ablauf von dieser Klasse übernehmen"
                    }
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {eigeneSchritte > 0 ? "Ablauf ersetzen" : "Ablauf übernehmen"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {eigenerStand && (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Der Stand steht pro Klasse — laufen sie auseinander, siehst du es hier.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
