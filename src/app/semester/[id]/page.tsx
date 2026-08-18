import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil } from "lucide-react";
import { getSemesterMitDetails } from "../actions";
import { KalenderEintraegeSection } from "./kalender-eintraege-section";
import { SemesterTimeline } from "./semester-timeline";

export default async function SemesterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sem = await getSemesterMitDetails(id);

  if (!sem) return notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {sem.bezeichnung}
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date(sem.startDatum).toLocaleDateString("de-CH")} –{" "}
            {new Date(sem.endDatum).toLocaleDateString("de-CH")}
          </p>
        </div>
        <Button
          variant="outline"
          render={<Link href={`/semester/${id}/bearbeiten`} />}
        >
          <Pencil className="h-4 w-4" />
          Bearbeiten
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Sequenzen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{sem.sequenzen.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Lektionsblöcke
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sem.sequenzen.reduce(
                (sum, s) => sum + s.lektionsbloecke.length,
                0
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Kalender-Einträge
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sem.kalenderEintraege.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <SemesterTimeline
        startDatum={sem.startDatum}
        endDatum={sem.endDatum}
        kalenderEintraege={sem.kalenderEintraege}
        sequenzen={sem.sequenzen}
      />

      <KalenderEintraegeSection
        semesterId={id}
        eintraege={sem.kalenderEintraege}
      />
    </div>
  );
}
