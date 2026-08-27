import Link from "next/link";
import { ArrowRight } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { SectionHeader, DataItem } from "@/components/ui/page-header";

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
    <section className="mb-12">
      <SectionHeader
        titel="Stand aus der letzten Lektion"
        aktionen={
          <Link
            href={`/sequenzen/${stand.id}`}
            className="type-body-compact-02 inline-flex items-center gap-2 text-link underline-offset-2 hover:underline"
          >
            {formatiereDatum(stand.startDatum)}
            <ArrowRight size={16} />
          </Link>
        }
      />

      <div className="bg-layer p-4">
        {leer ? (
          <p className="type-body-02 text-text-placeholder">
            Kein Übertrag hinterlegt.
          </p>
        ) : (
          <div className="space-y-4">
            {stand.uebertragSlideBis !== null && (
              <DataItem label="Gekommen bis">
                Slide {stand.uebertragSlideBis}
              </DataItem>
            )}

            {stand.uebertragErledigt && stand.uebertragErledigt.length > 0 && (
              <div>
                <div className="type-label-02 mb-2 text-text-helper">Erledigt</div>
                <div className="flex flex-wrap gap-2">
                  {stand.uebertragErledigt.map((e) => (
                    <Badge key={e} variant="green" size="sm">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {stand.uebertrag && (
              <div>
                <div className="type-label-02 mb-1 text-text-helper">Notiz</div>
                <p className="type-body-02 whitespace-pre-wrap text-foreground">
                  {stand.uebertrag}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
