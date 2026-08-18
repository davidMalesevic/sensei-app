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

export default async function SequenzenPage() {
  const sequenzenList = await getSequenzen();

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
                <TableHead>Titel</TableHead>
                <TableHead>Modul</TableHead>
                <TableHead>Klasse</TableHead>
                <TableHead>Semester</TableHead>
                <TableHead>Handlungskompetenzen</TableHead>
                <TableHead>Praxisbezug</TableHead>
                <TableHead className="w-[80px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sequenzenList.map((s) => (
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
