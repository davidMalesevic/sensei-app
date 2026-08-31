import { notFound } from "next/navigation";
import Link from "next/link";
import { Printer } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { PageHeader, DataItem } from "@/components/ui/page-header";
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

const WOCHENTAGE = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

function langesDatum(datum: string | null): string {
  if (!datum) return "ohne Datum";
  const d = new Date(datum + "T00:00:00");
  return `${WOCHENTAGE[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.${d.getFullYear()}`;
}

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
    seq.modulId && kw !== null
      ? getWochenstoff(seq.benutzerId, seq.modulId, kw)
      : null,
    getVorherigenUebertrag(seq.klasseId, seq.modulId, seq.startDatum, id),
  ]);

  const zeitraum =
    seq.startZeit && seq.endZeit ? `${seq.startZeit}–${seq.endZeit}` : "—";

  return (
    <>
      <PageHeader
        titel={seq.titel}
        beschreibung={langesDatum(seq.startDatum)}
        breadcrumb={[
          { label: "Sequenzen", href: "/sequenzen" },
          { label: seq.klasse.bezeichnung },
        ]}
        aktionen={
          <>
            <Button
              variant="ghost-neutral"
              size="icon"
              aria-label="Drucken"
              title="PDF / Drucken"
              render={<Link href={`/sequenzen/${id}/drucken`} />}
            >
              <Printer size={20} />
            </Button>
            <SequenzDeleteButton id={id} bezeichnung={seq.titel} />
          </>
        }
      >
        <div className="mt-6 flex flex-wrap gap-x-12 gap-y-4 bg-layer p-4">
          <DataItem label="Klasse">{seq.klasse.bezeichnung}</DataItem>
          <DataItem label="Zeit">{zeitraum}</DataItem>
          <DataItem label="Lektionen">{seq.lektionen ?? "—"}</DataItem>
          <DataItem label="Raum">{seq.raum ?? "—"}</DataItem>
          <DataItem label="Kalenderwoche">{kw ?? "—"}</DataItem>
        </div>
      </PageHeader>

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

      {stoff && (
        <WochenstoffSection
          stoff={stoff}
          bereitsErledigt={stand?.uebertragErledigt ?? []}
        />
      )}

      <UebertragSection
        sequenzId={id}
        datum={seq.startDatum}
        daten={{
          uebertrag: seq.uebertrag,
          uebertragErledigt: seq.uebertragErledigt,
          uebertragSlideBis: seq.uebertragSlideBis,
          keinUebertrag: seq.keinUebertrag,
          uebertragAm: seq.uebertragAm,
        }}
        stoff={stoff}
        bereitsErledigt={stand?.uebertragErledigt ?? []}
      />

      <NotizenSection sequenzId={id} notiz={seq.cockpitNotiz} />
    </>
  );
}
