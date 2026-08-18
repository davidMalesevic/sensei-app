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

export default async function KlassenPage() {
  const klassenList = await getKlassen();

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
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Beruf</TableHead>
                <TableHead>Lehrjahr</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {klassenList.map((k) => (
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
