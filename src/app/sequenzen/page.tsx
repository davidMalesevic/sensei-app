import Link from "next/link";
import { Calendar } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { getSequenzen } from "./actions";
import { SequenzDeleteButton } from "./[id]/sequenz-delete-button";
import { SortableTableHead } from "@/components/sortable-table-head";
import { getKWFromDateString } from "@/lib/kw";
import { statusTag } from "@/lib/status";

export const dynamic = "force-dynamic";

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tag(datum: string | null): string {
  if (!datum) return "–";
  const d = new Date(datum + "T00:00:00");
  return `${WOCHENTAGE[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

type Zeile = Awaited<ReturnType<typeof getSequenzen>>[number];

const sortColumns: Record<string, (a: Zeile, b: Zeile) => number> = {
  datum: (a, b) => (a.startDatum ?? "").localeCompare(b.startDatum ?? ""),
  klasse: (a, b) =>
    a.klasse.bezeichnung.localeCompare(b.klasse.bezeichnung, "de-CH"),
  modul: (a, b) => (a.modul?.nummer ?? 0) - (b.modul?.nummer ?? 0),
  status: (a, b) => a.status.localeCompare(b.status),
};

/**
 * Sequenzen entstehen aus dem Stundenplan, nicht über ein Formular — die
 * Liste ist reine Übersicht (`erstellungsprozess.md`, Abschnitt 4.1).
 */
export default async function SequenzenPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sequenzenList = await getSequenzen();
  const { sort, order } = await searchParams;

  const sortKey = typeof sort === "string" ? sort : "datum";
  const sortOrder = order === "desc" ? "desc" : "asc";
  const compareFn = sortColumns[sortKey] ?? sortColumns.datum;

  const sorted = [...sequenzenList].sort((a, b) =>
    sortOrder === "desc" ? compareFn(b, a) : compareFn(a, b)
  );

  return (
    <>
      <PageHeader
        titel="Sequenzen"
        beschreibung="Entstehen aus dem Stundenplan — Klasse × Modul × Unterrichtstag."
        aktionen={
          <Button variant="outline" render={<Link href="/stundenplan" />}>
            Stundenplan
            <Calendar size={16} />
          </Button>
        }
      />

      {sequenzenList.length === 0 ? (
        <div className="bg-layer p-8">
          <p className="type-body-02 mb-6 text-text-secondary">
            Noch keine Sequenzen vorhanden. Sie entstehen beim Import des
            WebUntis-Kalenderexports.
          </p>
          <Button render={<Link href="/stundenplan" />}>
            Stundenplan importieren
            <Calendar size={16} />
          </Button>
        </div>
      ) : (
        <Table className="min-w-[68rem] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-layer-accent">
              <SortableTableHead column="datum" className="w-40">
                Datum
              </SortableTableHead>
              <TableHead className="w-36">Zeit</TableHead>
              <SortableTableHead column="klasse" className="w-36">
                Klasse
              </SortableTableHead>
              <SortableTableHead column="modul" className="w-28">
                Modul
              </SortableTableHead>
              <TableHead className="w-32">Lektionen</TableHead>
              <TableHead className="w-20">KW</TableHead>
              <SortableTableHead column="status" className="w-40">
                Stand
              </SortableTableHead>
              <TableHead className="w-24">Raum</TableHead>
              <TableHead className="text-right">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/sequenzen/${s.id}`}
                    className="text-link underline-offset-2 hover:underline"
                  >
                    {tag(s.startDatum)}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums whitespace-nowrap text-text-secondary">
                  {s.startZeit ? `${s.startZeit}–${s.endZeit}` : "–"}
                </TableCell>
                <TableCell>{s.klasse.bezeichnung}</TableCell>
                <TableCell>
                  {s.modul ? (
                    <Badge variant="cool-gray" size="sm">
                      M{s.modul.nummer}
                    </Badge>
                  ) : (
                    <span className="text-text-placeholder">–</span>
                  )}
                </TableCell>
                <TableCell className="tabular-nums text-text-secondary">
                  {s.lektionen ?? "–"}
                </TableCell>
                <TableCell className="tabular-nums text-text-secondary">
                  {getKWFromDateString(s.startDatum) ?? "–"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusTag(s.status).variant} size="sm">
                    {statusTag(s.status).label}
                  </Badge>
                </TableCell>
                <TableCell className="text-text-secondary">
                  {s.raum ?? "–"}
                </TableCell>
                <TableCell className="pr-2 text-right">
                  <SequenzDeleteButton
                    id={s.id}
                    bezeichnung={`${s.klasse.bezeichnung} · ${tag(s.startDatum)}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
