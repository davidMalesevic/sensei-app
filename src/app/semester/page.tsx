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
import { getSemester } from "./actions";
import { SemesterDeleteButton } from "./semester-delete-button";

export default async function SemesterPage() {
  const semesterList = await getSemester();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Semester</h1>
          <p className="text-muted-foreground mt-1">
            Semester anlegen und verwalten.
          </p>
        </div>
        <Button render={<Link href="/semester/neu" />}>
          <Plus className="h-4 w-4" />
          Neues Semester
        </Button>
      </div>

      {semesterList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Noch keine Semester vorhanden.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            render={<Link href="/semester/neu" />}
          >
            <Plus className="h-4 w-4" />
            Erstes Semester anlegen
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bezeichnung</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Ende</TableHead>
                <TableHead className="w-[100px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {semesterList.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/semester/${s.id}`}
                      className="hover:underline"
                    >
                      {s.bezeichnung}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {new Date(s.startDatum).toLocaleDateString("de-CH")}
                  </TableCell>
                  <TableCell>
                    {new Date(s.endDatum).toLocaleDateString("de-CH")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        render={<Link href={`/semester/${s.id}/bearbeiten`} />}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <SemesterDeleteButton id={s.id} />
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
