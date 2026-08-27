import Link from "next/link";
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
import { CalendarDays } from "lucide-react";
import { getSequenzen } from "./actions";
import { SequenzDeleteButton } from "./[id]/sequenz-delete-button";
import { SortableTableHead } from "@/components/sortable-table-head";
import { getKWFromDateString } from "@/lib/kw";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  leer: "kein Ablauf",
  entwurf: "Entwurf",
  bestaetigt: "bestätigt",
  gehalten: "gehalten",
};

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sequenzen</h1>
          <p className="text-muted-foreground mt-1">
            Entstehen aus dem Stundenplan — Klasse × Modul × Unterrichtstag.
          </p>
        </div>
        <Button variant="outline" render={<Link href="/stundenplan" />}>
          <CalendarDays className="h-4 w-4" />
          Stundenplan
        </Button>
      </div>

      {sequenzenList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center space-y-3">
          <p className="text-muted-foreground">
            Noch keine Sequenzen vorhanden.
          </p>
          <Button variant="outline" render={<Link href="/stundenplan" />}>
            <CalendarDays className="h-4 w-4" />
            Stundenplan importieren
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="datum">Datum</SortableTableHead>
                <TableHead className="w-24">Zeit</TableHead>
                <SortableTableHead column="klasse">Klasse</SortableTableHead>
                <SortableTableHead column="modul">Modul</SortableTableHead>
                <TableHead className="w-20">Lektionen</TableHead>
                <TableHead className="w-16">KW</TableHead>
                <SortableTableHead column="status">Status</SortableTableHead>
                <TableHead className="w-20">Raum</TableHead>
                <TableHead className="w-[60px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/sequenzen/${s.id}`}
                      className="hover:underline"
                    >
                      {tag(s.startDatum)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {s.startZeit ? `${s.startZeit}–${s.endZeit}` : "–"}
                  </TableCell>
                  <TableCell>{s.klasse.bezeichnung}</TableCell>
                  <TableCell>
                    {s.modul ? (
                      <Badge variant="outline">M{s.modul.nummer}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">–</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.lektionen ?? "–"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {getKWFromDateString(s.startDatum) ?? "–"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {STATUS_LABEL[s.status] ?? s.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.raum ?? "–"}
                  </TableCell>
                  <TableCell>
                    <SequenzDeleteButton id={s.id} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
