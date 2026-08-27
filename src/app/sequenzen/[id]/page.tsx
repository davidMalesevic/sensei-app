import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Briefcase, Paperclip, Printer } from "lucide-react";
import {
  getSequenzById,
  getPhasenmodelle,
  getVorherigeNotiz,
  getCockpitData,
  saveUebergabenotiz,
} from "../actions";
import { getSequenzKontext } from "@/lib/kontext";
import { SequenzDeleteButton } from "./sequenz-delete-button";
import { LektionsbloeckeSection } from "./lektionsbloecke-section";
import { MaterialSection } from "@/components/material-section";
import { UebergabenotizSection } from "./uebergabenotiz-section";
import { ContextHeader } from "./context-header";
import { CockpitView } from "./cockpit-view";
import { AnsichtToggle, type Ansicht } from "./ansicht-toggle";
import { WochenstoffSection } from "./wochenstoff-section";
import { UebertragSection } from "./uebertrag-section";
import { StandSection } from "./stand-section";
import { AblaufSection } from "./ablauf-section";
import { getAblauf } from "../entwurf-actions";
import { getVorherigenUebertrag } from "../uebertrag-actions";
import { getWochenstoff } from "@/lib/modulbaum";
import { getKWFromDateString } from "@/lib/kw";

export default async function SequenzDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ansicht?: string }>;
}) {
  const { id } = await params;
  const { ansicht: ansichtParam } = await searchParams;
  const ansicht: Ansicht = ansichtParam === "cockpit" ? "cockpit" : "planung";

  const [seq, phasenmodelle, kontext] = await Promise.all([
    getSequenzById(id),
    getPhasenmodelle(),
    getSequenzKontext(id),
  ]);

  if (!seq || !kontext) return notFound();

  const cockpitData = ansicht === "cockpit" ? await getCockpitData(id) : null;

  // KW + Modul ⇒ Block ⇒ LA ⇒ Aufgaben; rein gerechnet, ohne KI.
  const kw = getKWFromDateString(seq.startDatum);
  const stoff =
    seq.modulId && kw !== null ? await getWochenstoff(seq.modulId, kw) : null;

  const ablauf = await getAblauf(id);

  const stand = await getVorherigenUebertrag(
    seq.klasseId,
    seq.modulId,
    seq.startDatum,
    id
  );
  const vorherigeNotiz = await getVorherigeNotiz(seq.klasseId, seq.modulId, id);
  const saveNotizAction = saveUebergabenotiz.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{seq.titel}</h1>
          <p className="text-muted-foreground mt-1">
            {seq.modul && `Modul ${seq.modul.nummer} · `}
            {seq.klasse.bezeichnung}
            {seq.semester && ` · ${seq.semester.bezeichnung}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<Link href={`/sequenzen/${id}/drucken`} />}
          >
            <Printer className="h-4 w-4" />
            PDF / Drucken
          </Button>
          <Button
            variant="outline"
            render={<Link href={`/sequenzen/${id}/bearbeiten`} />}
          >
            <Pencil className="h-4 w-4" />
            Bearbeiten
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

      <AnsichtToggle sequenzId={id} aktiv={ansicht} />

      {ansicht === "cockpit" && cockpitData ? (
        <CockpitView data={cockpitData} kontext={kontext} />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {seq.beschreibung && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Beschreibung</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">
                    {seq.beschreibung}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4" />
                  Praxisbezug
                </CardTitle>
              </CardHeader>
              <CardContent>
                {seq.praxisbezug ? (
                  <p className="text-sm whitespace-pre-wrap">
                    {seq.praxisbezug}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Noch kein Praxisbezug dokumentiert.{" "}
                    <Link
                      href={`/sequenzen/${id}/bearbeiten`}
                      className="underline"
                    >
                      Jetzt hinzufügen
                    </Link>
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {seq.handlungskompetenzen.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Zugeordnete Handlungskompetenzen
              </h2>
              <div className="flex flex-wrap gap-2">
                {seq.handlungskompetenzen.map((shk) => (
                  <Badge key={shk.id} variant="secondary">
                    {shk.handlungskompetenz.kuerzel} –{" "}
                    {shk.handlungskompetenz.bezeichnung}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Materialien (Sequenz)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <MaterialSection materialien={seq.materialien} sequenzId={id} />
            </CardContent>
          </Card>

          <LektionsbloeckeSection
            sequenzId={id}
            klasseId={seq.klasseId}
            modulId={seq.modulId}
            lektionsbloecke={seq.lektionsbloecke}
            phasenmodelle={phasenmodelle}
          />
        </>
      )}

      <UebergabenotizSection
        sequenzId={id}
        currentNotiz={seq.uebergabenotiz}
        vorherigeNotiz={vorherigeNotiz}
        saveAction={saveNotizAction}
      />
    </div>
  );
}
