import Link from "next/link";
import { Add, Edit } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { getKlassen } from "./actions";
import { KlasseDeleteButton } from "./klasse-delete-button";
import { SortableTableHead } from "@/components/sortable-table-head";

type Klasse = Awaited<ReturnType<typeof getKlassen>>[number];

const sortColumns: Record<string, (a: Klasse, b: Klasse) => number> = {
  bezeichnung: (a, b) => a.bezeichnung.localeCompare(b.bezeichnung, "de-CH"),
  beruf: (a, b) => a.beruf.localeCompare(b.beruf, "de-CH"),
  lehrjahr: (a, b) => a.lehrjahr - b.lehrjahr,
};

export default async function KlassenPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const klassenList = await getKlassen();
  const { sort, order } = await searchParams;

  const sortKey = typeof sort === "string" ? sort : undefined;
  const sortOrder = order === "desc" ? "desc" : "asc";
  const compareFn = sortKey ? sortColumns[sortKey] : undefined;

  const sorted = compareFn
    ? [...klassenList].sort((a, b) =>
        sortOrder === "desc" ? compareFn(b, a) : compareFn(a, b)
      )
    : klassenList;

  return (
    <>
      <PageHeader
        titel="Klassen"
        beschreibung="Klassen anlegen und verwalten. Der Stundenplan-Import ordnet ihnen die Kalenderkürzel zu."
        aktionen={
          <Button render={<Link href="/klassen/neu" />}>
            Neue Klasse
            <Add size={16} />
          </Button>
        }
      />

      {klassenList.length === 0 ? (
        <div className="bg-layer p-8">
          <p className="type-body-02 mb-6 text-text-secondary">
            Noch keine Klassen vorhanden.
          </p>
          <Button render={<Link href="/klassen/neu" />}>
            Erste Klasse anlegen
            <Add size={16} />
          </Button>
        </div>
      ) : (
        <Table className="min-w-[48rem] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-layer-accent">
              <SortableTableHead column="bezeichnung" className="w-56">
                Bezeichnung
              </SortableTableHead>
              {/* ohne Breite: der Beruf ist der lange Text */}
              <SortableTableHead column="beruf">Beruf</SortableTableHead>
              <SortableTableHead column="lehrjahr" className="w-40">
                Lehrjahr
              </SortableTableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((k) => (
              <TableRow key={k.id}>
                <TableCell className="font-semibold">{k.bezeichnung}</TableCell>
                <TableCell className="truncate text-text-secondary">{k.beruf}</TableCell>
                <TableCell className="text-text-secondary">
                  {k.lehrjahr}. Lehrjahr
                </TableCell>
                <TableCell className="pr-2">
                  <div className="flex justify-end gap-px">
                    <Button
                      variant="ghost-neutral"
                      size="icon-sm"
                      aria-label={`${k.bezeichnung} bearbeiten`}
                      title="Bearbeiten"
                      render={<Link href={`/klassen/${k.id}/bearbeiten`} />}
                    >
                      <Edit size={16} />
                    </Button>
                    <KlasseDeleteButton id={k.id} bezeichnung={k.bezeichnung} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
