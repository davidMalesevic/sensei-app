import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

export type VorherigerUebertrag = {
  id: string;
  startDatum: string | null;
  uebertrag: string | null;
  uebertragErledigt: string[] | null;
  uebertragSlideBis: number | null;
  keinUebertrag: boolean;
};

function formatiereDatum(datum: string | null): string {
  if (!datum) return "";
  const d = new Date(datum + "T00:00:00");
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" });
}

/**
 * «Wo fange ich an» — der Übertrag der letzten Sequenz derselben Klasse im
 * selben Modul. Das ist der erste Blick vor dem Unterricht.
 */
export function StandSection({ stand }: { stand: VorherigerUebertrag }) {
  const leer =
    stand.keinUebertrag &&
    !stand.uebertrag &&
    !stand.uebertragSlideBis &&
    !stand.uebertragErledigt?.length;

  return (
    <Card className="bg-muted/40">
      <CardContent className="py-4 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Stand aus der letzten Lektion</span>
          <Link
            href={`/sequenzen/${stand.id}`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {formatiereDatum(stand.startDatum)}
          </Link>
        </div>

        {leer ? (
          <p className="text-sm text-muted-foreground">
            Kein Übertrag hinterlegt.
          </p>
        ) : (
          <>
            {stand.uebertragSlideBis !== null && (
              <p className="text-sm">
                Gekommen bis <strong>Slide {stand.uebertragSlideBis}</strong>.
              </p>
            )}
            {stand.uebertragErledigt && stand.uebertragErledigt.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {stand.uebertragErledigt.map((e) => (
                  <Badge key={e} variant="secondary" className="font-normal">
                    {e}
                  </Badge>
                ))}
              </div>
            )}
            {stand.uebertrag && (
              <p className="text-sm whitespace-pre-wrap">{stand.uebertrag}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
