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
import { Plus, Pencil } from "lucide-react";
import { getKlassen } from "./actions";
import { KlasseDeleteButton } from "./klasse-delete-button";
import { SortableTableHead } from "@/components/sortable-table-head";

const sortColumns: Record<string, (a: any, b: any) => number> = {
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Klassen</h1>
          <p className="text-muted-foreground mt-1">
            Klassen anlegen und verwalten.
          </p>
        </div>
        <Button render={<Link href="/klassen/neu" />}>
          <Plus className="h-4 w-4" />
          Neue Klasse
        </Button>
      </div>

      {klassenList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Noch keine Klassen vorhanden.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            render={<Link href="/klassen/neu" />}
          >
            <Plus className="h-4 w-4" />
            Erste Klasse anlegen
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="bezeichnung">
                  Bezeichnung
                </SortableTableHead>
                <SortableTableHead column="beruf">Beruf</SortableTableHead>
                <SortableTableHead column="lehrjahr">
                  Lehrjahr
                </SortableTableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">
                    {k.bezeichnung}
                  </TableCell>
                  <TableCell>{k.beruf}</TableCell>
                  <TableCell>{k.lehrjahr}. Lehrjahr</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        render={<Link href={`/klassen/${k.id}/bearbeiten`} />}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <KlasseDeleteButton id={k.id} />
                    </div>
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
