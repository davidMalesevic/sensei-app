import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { getSequenzById } from "../actions";
import { getSequenzKontext } from "@/lib/kontext";
import { getWochenstoff } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";
import { getAblauf, getGeschwister } from "../entwurf-actions";
import { getVorherigenUebertrag } from "../uebertrag-actions";
import { SequenzDeleteButton } from "./sequenz-delete-button";
import { ContextHeader } from "./context-header";
import { StandSection } from "./stand-section";
import { AblaufSection } from "./ablauf-section";
import { GeschwisterSection } from "./geschwister-section";
import { WochenstoffSection } from "./wochenstoff-section";
import { UebertragSection } from "./uebertrag-section";
import { NotizenSection } from "./notizen-section";

/**
 * Die Sequenzseite ist eine einzige Ansicht — keine Umschaltung mehr zwischen
 * Planung und Cockpit. Der Ablauf *ist* die Planung und zugleich das, was im
 * Unterricht zählt (`erstellungsprozess.md`, Abschnitt 5).
 *
 * Reihenfolge folgt dem Ablauf des Mittwoch-Durchgangs: Kontext, wo wir
 * stehen, was wir tun, wer parallel dasselbe macht, welcher Stoff dahinter
 * liegt, was nachzutragen ist.
 */
export default async function SequenzDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [seq, kontext] = await Promise.all([
    getSequenzById(id),
    getSequenzKontext(id),
  ]);

  if (!seq || !kontext) return notFound();

  const kw = getKWFromDateString(seq.startDatum);
  const [ablauf, geschwister, stoff, stand] = await Promise.all([
    getAblauf(id),
    getGeschwister(id),
    seq.modulId && kw !== null ? getWochenstoff(seq.modulId, kw) : null,
    getVorherigenUebertrag(seq.klasseId, seq.modulId, seq.startDatum, id),
  ]);

  const zeitraum =
    seq.startZeit && seq.endZeit ? `${seq.startZeit}–${seq.endZeit}` : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">{seq.titel}</h1>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground mt-1">
            <span>{seq.klasse.bezeichnung}</span>
            {zeitraum && <span>· {zeitraum}</span>}
            {seq.lektionen && (
              <Badge variant="outline">{seq.lektionen} Lektionen</Badge>
            )}
            {seq.raum && <span>· {seq.raum}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            render={<Link href={`/sequenzen/${id}/drucken`} />}
          >
            <Printer className="h-4 w-4" />
            PDF / Drucken
          </Button>
          <SequenzDeleteButton id={id} />
        </div>
      </div>

      <ContextHeader kontext={kontext} klasseId={seq.klasseId} />

      {stand && <StandSection stand={stand} />}

      <AblaufSection
        sequenzId={id}
        status={seq.status}
        entwurfAm={seq.entwurfAm}
        zeilen={ablauf}
      />

      <GeschwisterSection
        sequenzId={id}
        eigeneSchritte={ablauf.length}
        uebernommenVon={seq.uebernommenVon}
        geschwister={geschwister}
      />

      {stoff && <WochenstoffSection stoff={stoff} />}

      <UebertragSection
        sequenzId={id}
        datum={seq.startDatum}
        daten={{
          uebertrag: seq.uebertrag,
          uebertragErledigt: seq.uebertragErledigt,
          uebertragSlideBis: seq.uebertragSlideBis,
          keinUebertrag: seq.keinUebertrag,
        }}
        stoff={stoff}
      />

      <NotizenSection sequenzId={id} notiz={seq.cockpitNotiz} />
    </div>
  );
}
