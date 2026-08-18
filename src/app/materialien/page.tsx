import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Presentation,
  Link as LinkIcon,
  Video,
  StickyNote,
  File,
  ExternalLink,
} from "lucide-react";
import { getMaterialien } from "./actions";
import { MaterialDeleteButton } from "./material-delete-button";

const typLabels: Record<string, string> = {
  arbeitsblatt: "Arbeitsblatt",
  praesentation: "Präsentation",
  link: "Link",
  video: "Video",
  dokument: "Dokument",
  notiz: "Notiz",
  sonstiges: "Sonstiges",
};

const typIcons: Record<string, typeof FileText> = {
  arbeitsblatt: FileText,
  praesentation: Presentation,
  link: LinkIcon,
  video: Video,
  dokument: File,
  notiz: StickyNote,
  sonstiges: File,
};

function getZuordnung(mat: {
  sequenz: { id: string; titel: string } | null;
  lektionsblock: { id: string; thema: string | null; sequenzId: string } | null;
  phase: { id: string; bezeichnung: string; lektionsblockId: string } | null;
}) {
  if (mat.phase) return { label: `Phase: ${mat.phase.bezeichnung}`, type: "Phase" };
  if (mat.lektionsblock) return { label: `Block: ${mat.lektionsblock.thema ?? "–"}`, type: "Block" };
  if (mat.sequenz) return { label: mat.sequenz.titel, type: "Sequenz", href: `/sequenzen/${mat.sequenz.id}` };
  return { label: "–", type: "Ohne" };
}

export default async function MaterialienPage() {
  const materialienList = await getMaterialien();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Materialien</h1>
        <p className="text-muted-foreground mt-1">
          Alle Unterrichtsmaterialien auf einen Blick.
        </p>
      </div>

      {materialienList.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Noch keine Materialien vorhanden. Materialien können direkt bei
            einer Sequenz, einem Lektionsblock oder einer Phase hinzugefügt
            werden.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead className="w-[120px]">Typ</TableHead>
                <TableHead>Zuordnung</TableHead>
                <TableHead className="w-[60px]">Link</TableHead>
                <TableHead className="w-[60px]">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materialienList.map((mat) => {
                const Icon = typIcons[mat.typ] ?? File;
                const zuordnung = getZuordnung(mat);
                return (
                  <TableRow key={mat.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                        {mat.titel}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {typLabels[mat.typ] ?? mat.typ}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {zuordnung.href ? (
                        <Link href={zuordnung.href} className="hover:underline">
                          {zuordnung.label}
                        </Link>
                      ) : (
                        zuordnung.label
                      )}
                    </TableCell>
                    <TableCell>
                      {mat.url && (
                        <a
                          href={mat.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell>
                      <MaterialDeleteButton id={mat.id} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
