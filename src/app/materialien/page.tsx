import Link from "next/link";
import {
  Document,
  DocumentBlank,
  PresentationFile,
  Link as LinkIcon,
  Video,
  Pen,
  Launch,
} from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
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

const typIcons: Record<string, typeof Document> = {
  arbeitsblatt: Document,
  praesentation: PresentationFile,
  link: LinkIcon,
  video: Video,
  dokument: DocumentBlank,
  notiz: Pen,
  sonstiges: DocumentBlank,
};

/** Carbon-Tags ordnen nach Art, nicht nach Wichtigkeit. */
const typFarben: Record<
  string,
  "blue" | "purple" | "teal" | "magenta" | "cool-gray" | "green"
> = {
  arbeitsblatt: "blue",
  praesentation: "purple",
  link: "teal",
  video: "magenta",
  dokument: "cool-gray",
  notiz: "green",
};

function getZuordnung(mat: {
  sequenz: { id: string; titel: string } | null;
  lektionsblock: { id: string; thema: string | null; sequenzId: string } | null;
  phase: { id: string; bezeichnung: string; lektionsblockId: string } | null;
}) {
  if (mat.phase)
    return { label: `Phase: ${mat.phase.bezeichnung}`, type: "Phase" };
  if (mat.lektionsblock)
    return { label: `Block: ${mat.lektionsblock.thema ?? "–"}`, type: "Block" };
  if (mat.sequenz)
    return {
      label: mat.sequenz.titel,
      type: "Sequenz",
      href: `/sequenzen/${mat.sequenz.id}`,
    };
  return { label: "–", type: "Ohne" };
}

export default async function MaterialienPage() {
  const materialienList = await getMaterialien();

  return (
    <>
      <PageHeader
        titel="Materialien"
        beschreibung="Alle Unterrichtsmaterialien auf einen Blick. Material hängt am Modul, nicht an der Sequenz."
      />

      {materialienList.length === 0 ? (
        <div className="bg-layer p-8">
          <p className="type-body-02 max-w-2xl text-text-secondary">
            Noch keine Materialien vorhanden. Sie werden im Bildungsplan beim
            jeweiligen Modul hochgeladen — Präsentationen als PDF, damit die
            Seitenzahl zur Foliennummer wird.
          </p>
        </div>
      ) : (
        <Table className="min-w-[52rem] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-layer-accent">
              {/* ohne Breite: Titel und Zuordnung teilen sich den Rest */}
              <TableHead>Titel</TableHead>
              <TableHead className="w-44">Typ</TableHead>
              <TableHead>Zuordnung</TableHead>
              <TableHead className="w-24 text-right">
                <span className="sr-only">Aktionen</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materialienList.map((mat) => {
              const Icon = typIcons[mat.typ] ?? DocumentBlank;
              const zuordnung = getZuordnung(mat);
              return (
                <TableRow key={mat.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Icon
                        size={16}
                        className="shrink-0 text-text-secondary"
                      />
                      <span className="truncate font-semibold">{mat.titel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={typFarben[mat.typ] ?? "cool-gray"}
                      size="sm"
                    >
                      {typLabels[mat.typ] ?? mat.typ}
                    </Badge>
                  </TableCell>
                  <TableCell className="truncate text-text-secondary">
                    {zuordnung.href ? (
                      <Link
                        href={zuordnung.href}
                        className="text-link underline-offset-2 hover:underline"
                      >
                        {zuordnung.label}
                      </Link>
                    ) : (
                      zuordnung.label
                    )}
                  </TableCell>
                  <TableCell className="pr-2">
                    <div className="flex justify-end gap-px">
                      {mat.url && (
                        <Button
                          variant="ghost-neutral"
                          size="icon-sm"
                          aria-label={`${mat.titel} öffnen`}
                          title="Öffnen"
                          render={
                            <a
                              href={mat.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <Launch size={16} />
                        </Button>
                      )}
                      <MaterialDeleteButton id={mat.id} titel={mat.titel} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </>
  );
}
