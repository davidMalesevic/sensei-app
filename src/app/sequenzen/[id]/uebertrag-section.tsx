import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle2 } from "lucide-react";
import {
  speichereUebertrag,
  keinUebertragSetzen,
  uebertragZuruecksetzen,
} from "../uebertrag-actions";
import type { Wochenstoff } from "@/lib/modulbaum";

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
  const heute = new Date().toISOString().slice(0, 10);
  const gehalten = datum !== null && datum <= heute;
  const erfasst = daten.keinUebertrag || daten.uebertrag !== null;

  // Noch nicht stattgefunden und nichts erfasst: nicht im Weg stehen.
  if (!gehalten && !erfasst) return null;

  if (erfasst) {
    const zuruecksetzen = uebertragZuruecksetzen.bind(null, sequenzId);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-500" />
            Übertrag
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {daten.keinUebertrag && !daten.uebertrag ? (
            <p className="text-sm text-muted-foreground">
              Kein Übertrag — nichts nachzutragen.
            </p>
          ) : (
            <>
              {daten.uebertragErledigt && daten.uebertragErledigt.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {daten.uebertragErledigt.map((e) => (
                    <Badge key={e} variant="secondary" className="font-normal">
                      {e}
                    </Badge>
                  ))}
                </div>
              )}
              {daten.uebertragSlideBis !== null && (
                <p className="text-sm">
                  Gekommen bis Slide {daten.uebertragSlideBis}.
                </p>
              )}
              {daten.uebertrag && (
                <p className="text-sm whitespace-pre-wrap">{daten.uebertrag}</p>
              )}
            </>
          )}

          <form action={zuruecksetzen}>
            <Button type="submit" variant="ghost" size="sm">
              Ändern
            </Button>
          </form>
        </CardContent>
      </Card>
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
    <Card className="border-amber-300 dark:border-amber-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4" />
          Übertrag fehlt
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Bis wo seid ihr gekommen? Ohne das fehlt der nächsten Sequenz der
          Ausgangspunkt.
        </p>

        <form action={speichern} className="space-y-4">
          {aufgaben.length > 0 && (
            <div className="space-y-2">
              <Label>Erledigt</Label>
              <div className="space-y-1.5">
                {aufgaben.map((a) => (
                  <label
                    key={a.wert}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      name="erledigt"
                      value={a.wert}
                      className="h-4 w-4 rounded border-input"
                    />
                    <span className="font-medium">{a.bezeichnung}</span>
                    <code className="text-xs text-muted-foreground">
                      {a.code}
                    </code>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="slideBis">Gekommen bis Slide</Label>
            <Input
              id="slideBis"
              name="slideBis"
              inputMode="numeric"
              placeholder="z.B. 22"
              className="w-32"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="uebertrag">Notizen für nächste Woche</Label>
            <Textarea
              id="uebertrag"
              name="uebertrag"
              rows={3}
              placeholder="Was ist offen, was lief anders als geplant, worauf muss ich zurückkommen?"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit">Übertrag sichern</Button>
          </div>
        </form>

        <form action={keiner} className="mt-2">
          <Button type="submit" variant="ghost" size="sm">
            Kein Übertrag
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
