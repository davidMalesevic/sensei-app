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
import { Plus, CheckCircle, AlertCircle, Pencil } from "lucide-react";
import { getSequenzen } from "./actions";
import { SequenzDeleteButton } from "./[id]/sequenz-delete-button";
import { SortableTableHead } from "@/components/sortable-table-head";

const sortColumns: Record<string, (a: any, b: any) => number> = {
  titel: (a, b) => a.titel.localeCompare(b.titel, "de-CH"),
  modul: (a, b) => (a.modul?.nummer ?? 0) - (b.modul?.nummer ?? 0),
  klasse: (a, b) =>
    a.klasse.bezeichnung.localeCompare(b.klasse.bezeichnung, "de-CH"),
  semester: (a, b) =>
    a.semester.bezeichnung.localeCompare(b.semester.bezeichnung, "de-CH"),
  praxisbezug: (a, b) =>
    Number(b.praxisbezug ?? false) - Number(a.praxisbezug ?? false),
};

export default async function SequenzenPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sequenzenList = await getSequenzen();
  const { sort, order } = await searchParams;

  const sortKey = typeof sort === "string" ? sort : undefined;
  const sortOrder = order === "desc" ? "desc" : "asc";
  const compareFn = sortKey ? sortColumns[sortKey] : undefined;

  const sorted = compareFn
    ? [...sequenzenList].sort((a, b) =>
        sortOrder === "desc" ? compareFn(b, a) : compareFn(a, b)
      )
    : sequenzenList;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sequenzen</h1>
          <p className="text-muted-foreground mt-1">
            Unterrichtssequenzen planen und verwalten.
          </p>
        </div>
        <Button render={<Link href="/sequenzen/neu" />}>
          <Plus className="h-4 w-4" />
          Neue Sequenz
        </Button>
      </div>

      {sequenzenList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Noch keine Sequenzen vorhanden.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            render={<Link href="/sequenzen/neu" />}
          >
            <Plus className="h-4 w-4" />
            Erste Sequenz anlegen
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead column="titel">Titel</SortableTableHead>
                <SortableTableHead column="modul">Modul</SortableTableHead>
                <SortableTableHead column="klasse">Klasse</SortableTableHead>
                <SortableTableHead column="semester">
                  Semester
                </SortableTableHead>
                <TableHead>Handlungskompetenzen</TableHead>
                <SortableTableHead column="praxisbezug">
                  Praxisbezug
                </SortableTableHead>
                <TableHead className="w-[80px]">Aktionen</TableHead>
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
                      {s.titel}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {s.modul ? (
                      <Badge variant="outline">M{s.modul.nummer}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">–</span>
                    )}
                  </TableCell>
                  <TableCell>{s.klasse.bezeichnung}</TableCell>
                  <TableCell>{s.semester.bezeichnung}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {s.handlungskompetenzen.length === 0 ? (
                        <span className="text-muted-foreground text-sm">–</span>
                      ) : (
                        s.handlungskompetenzen.map((shk) => (
                          <Badge key={shk.id} variant="secondary">
                            {shk.handlungskompetenz.kuerzel}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {s.praxisbezug ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        render={<Link href={`/sequenzen/${s.id}/bearbeiten`} />}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <SequenzDeleteButton id={s.id} />
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
