import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Briefcase, Paperclip, Printer } from "lucide-react";
import { getSequenzById, getPhasenmodelle, getVorherigeNotiz, saveUebergabenotiz } from "../actions";
import { SequenzDeleteButton } from "./sequenz-delete-button";
import { LektionsbloeckeSection } from "./lektionsbloecke-section";
import { MaterialSection } from "@/components/material-section";
import { UebergabenotizSection } from "./uebergabenotiz-section";

export default async function SequenzDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [seq, phasenmodelle] = await Promise.all([
    getSequenzById(id),
    getPhasenmodelle(),
  ]);

  if (!seq) return notFound();

  const vorherigeNotiz = await getVorherigeNotiz(seq.klasseId, seq.modulId, id);
  const saveNotizAction = saveUebergabenotiz.bind(null, id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{seq.titel}</h1>
          <p className="text-muted-foreground mt-1">
            {seq.modul && `Modul ${seq.modul.nummer} · `}
            {seq.klasse.bezeichnung} · {seq.semester.bezeichnung}
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

      <div className="grid gap-4 md:grid-cols-2">
        {seq.beschreibung && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Beschreibung</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{seq.beschreibung}</p>
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
              <p className="text-sm whitespace-pre-wrap">{seq.praxisbezug}</p>
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
          <MaterialSection
            materialien={seq.materialien}
            sequenzId={id}
          />
        </CardContent>
      </Card>

      <LektionsbloeckeSection
        sequenzId={id}
        lektionsbloecke={seq.lektionsbloecke}
        phasenmodelle={phasenmodelle}
      />

      <UebergabenotizSection
        sequenzId={id}
        currentNotiz={seq.uebergabenotiz}
        vorherigeNotiz={vorherigeNotiz}
        saveAction={saveNotizAction}
      />
    </div>
  );
}
