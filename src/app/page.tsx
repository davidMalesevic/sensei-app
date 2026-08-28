import Link from "next/link";
import { and, asc, eq, gte, isNotNull } from "drizzle-orm";
import {
  ArrowRight,
  Calendar,
  Layers,
  Book,
  Education,
  Time,
} from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";
import { PageHeader, SectionHeader, DataItem } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db";
import { sequenz } from "@/db/schema";
import { getOffeneUebertraege } from "./sequenzen/uebertrag-actions";
import { getKWFromDateString } from "@/lib/kw";
import { findeAktuelle, schweizerHeute, schweizerJetzt } from "@/lib/zeit";
import { statusTag } from "@/lib/status";
import { benutzerId } from "@/lib/dal";

export const dynamic = "force-dynamic";

const SCHNELLZUGRIFF = [
  {
    title: "Stundenplan",
    description: "Sequenzen aus dem Kalender, Entwürfe anstossen",
    href: "/stundenplan",
    icon: Calendar,
  },
  {
    title: "Sequenzen",
    description: "Alle Unterrichtssequenzen",
    href: "/sequenzen",
    icon: Layers,
  },
  {
    title: "Bildungsplan",
    description: "Module, Modulpläne und Aufgabenbäume",
    href: "/bildungsplan",
    icon: Book,
  },
  {
    title: "Klassen",
    description: "Klassen und Pendenzen",
    href: "/klassen",
    icon: Education,
  },
];

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tag(datum: string): string {
  const d = new Date(datum + "T00:00:00");
  return `${WOCHENTAGE[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

/** Die nächsten Unterrichtstage — die Sequenz ist die Einheit, nicht der Block. */
async function getNaechsteSequenzen() {
  const bId = await benutzerId();
  const heute = schweizerHeute();

  return db.query.sequenz.findMany({
    where: and(
      eq(sequenz.benutzerId, bId),
      isNotNull(sequenz.kalenderKurs),
      gte(sequenz.startDatum, heute)
    ),
    orderBy: [asc(sequenz.startDatum), asc(sequenz.startZeit)],
    limit: 8,
    columns: {
      id: true,
      titel: true,
      startDatum: true,
      startZeit: true,
      endZeit: true,
      lektionen: true,
      raum: true,
      status: true,
    },
    with: {
      klasse: { columns: { bezeichnung: true } },
      modul: { columns: { nummer: true } },
    },
  });
}

export default async function Dashboard() {
  const [naechste, offen] = await Promise.all([
    getNaechsteSequenzen(),
    getOffeneUebertraege(),
  ]);

  const jetzt = schweizerJetzt();
  const { laufend, naechste: kommend } = findeAktuelle(naechste, jetzt);
  const hervorgehoben = laufend ?? kommend;
  const kwHeute = getKWFromDateString(jetzt.datum);

  return (
    <>
      <PageHeader
        titel="Dashboard"
        beschreibung={`${tag(jetzt.datum)} ${jetzt.zeit} Uhr · KW ${kwHeute ?? "—"}`}
      />

      {offen.length > 0 && (
        <Notification
          kind="error"
          titel={`${offen.length} Lektionen ohne Übertrag`}
          className="mb-8"
          action={
            <Button variant="ghost" size="sm" render={<Link href="/stundenplan" />}>
              Nachtragen
              <ArrowRight size={16} />
            </Button>
          }
        >
          Ohne den Stand fehlt der Folgewoche der Ausgangspunkt.
        </Notification>
      )}

      {hervorgehoben && (
        <Link
          href={`/sequenzen/${hervorgehoben.id}`}
          className="mb-8 block border-l-[3px] border-l-border-interactive bg-layer p-6 transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
        >
          <div className="type-label-02 flex items-center gap-2 text-text-helper">
            <Time size={16} />
            {laufend ? "Läuft gerade" : "Als nächstes"}
          </div>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="type-heading-04 text-foreground">
              {hervorgehoben.klasse.bezeichnung}
            </span>
            <span className="type-heading-03 text-text-secondary">
              {hervorgehoben.modul
                ? `Modul ${hervorgehoben.modul.nummer}`
                : "ohne Modul"}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-start gap-x-12 gap-y-4">
            <DataItem label="Wann">
              {hervorgehoben.startDatum ? tag(hervorgehoben.startDatum) : "—"}{" "}
              {hervorgehoben.startZeit}–{hervorgehoben.endZeit}
            </DataItem>
            <DataItem label="Raum">{hervorgehoben.raum ?? "—"}</DataItem>
            <DataItem label="Lektionen">{hervorgehoben.lektionen ?? "—"}</DataItem>
            <DataItem label="Stand">
              <Badge
                variant={statusTag(hervorgehoben.status).variant}
                size="sm"
              >
                {statusTag(hervorgehoben.status).label}
              </Badge>
            </DataItem>
          </div>
        </Link>
      )}

      <section className="mb-8">
        <SectionHeader
          titel="Nächste Sequenzen"
          aktionen={
            <Button variant="ghost" size="sm" render={<Link href="/sequenzen" />}>
              Alle ansehen
              <ArrowRight size={16} />
            </Button>
          }
        />

        {naechste.length === 0 ? (
          <div className="type-body-02 bg-layer p-6 text-text-secondary">
            Keine anstehenden Sequenzen.{" "}
            <Link href="/stundenplan" className="text-link underline underline-offset-2">
              Stundenplan importieren
            </Link>
          </div>
        ) : (
          <Table className="min-w-[60rem] table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-layer-accent">
                <TableHead className="w-32">Tag</TableHead>
                <TableHead className="w-36">Zeit</TableHead>
                <TableHead className="w-36">Klasse</TableHead>
                {/* ohne Breite: schluckt den Überschuss */}
                <TableHead>Modul</TableHead>
                <TableHead className="w-24">Raum</TableHead>
                <TableHead className="w-20">KW</TableHead>
                <TableHead className="w-40">Stand</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {naechste.map((s) => (
                <TableRow
                  key={s.id}
                  data-state={s.id === hervorgehoben?.id ? "selected" : undefined}
                >
                  <TableCell className="whitespace-nowrap text-text-secondary">
                    {s.startDatum ? tag(s.startDatum) : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-text-secondary">
                    {s.startZeit}–{s.endZeit}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/sequenzen/${s.id}`}
                      className="text-link underline-offset-2 hover:underline"
                    >
                      {s.klasse.bezeichnung}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {s.modul ? `Modul ${s.modul.nummer}` : "—"}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {s.raum ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums text-text-secondary">
                    {getKWFromDateString(s.startDatum) ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusTag(s.status).variant}
                      size="sm"
                    >
                      {statusTag(s.status).label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <SectionHeader titel="Schnellzugriff" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SCHNELLZUGRIFF.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group relative flex min-h-36 flex-col bg-layer p-4 transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <Icon size={20} className="mb-4 text-foreground" />
                <p className="type-heading-compact-02 text-foreground">
                  {l.title}
                </p>
                <p className="type-body-02 mt-1 pr-6 text-text-secondary">
                  {l.description}
                </p>
                <ArrowRight
                  size={20}
                  className="absolute right-4 bottom-4 text-primary"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
