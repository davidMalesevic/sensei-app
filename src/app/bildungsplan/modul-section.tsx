"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Document,
  DocumentBlank,
  PresentationFile,
  Link as LinkIcon,
  Video,
  Pen,
  Launch,
  Add,
  Attachment,
} from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import { DeleteButton } from "@/components/delete-button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { createMaterial, deleteMaterial } from "@/app/materialien/actions";
import { ModulBaumSection, type BaumBlock } from "./modulbaum-section";
import { MaterialBlockEtikett } from "./material-etikett";
import { MaterialAuswerten } from "./material-auswerten";
import {
  ModulplanSection,
  type ModularPlanEintragItem,
} from "./modulplan-section";

type MaterialItem = {
  id: string;
  titel: string;
  typ: string;
  dateiPfad: string | null;
  url: string | null;
  notiz: string | null;
  createdAt: Date;
  /** Etikett: null = gilt fürs ganze Modul, sonst genau dieser Block. */
  blockNummer: number | null;
};

type ModulData = {
  id: string;
  nummer: number;
  bezeichnung: string | null;
  lehrjahr: number | null;
  materialien: MaterialItem[];
  modularPlan: ModularPlanEintragItem[];
  bloecke: BaumBlock[];
};

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

/**
 * Carbon File Uploader mit Ablagefläche: gestrichelter Rahmen, beim Ziehen
 * färbt sich die Fläche und der Rahmen wird zur Interaktionsfarbe.
 */
function DropZone({
  modulId,
  children,
}: {
  modulId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const [auswertung, setAuswertung] = useState<string | null>(null);
  const dragCounter = useState(0);

  async function uploadFiles(prepared: { name: string; blob: Blob }[]) {
    if (prepared.length === 0) return;

    console.log(`[upload] starting ${prepared.length} files:`, prepared.map(p => `${p.name} (${p.blob.size}b)`));
    setAuswertung(null);
    setIsUploading(true);
    setUploadCount(prepared.length);
    try {
      for (let i = 0; i < prepared.length; i++) {
        const { name, blob } = prepared[i];
        console.log(`[upload] ${i + 1}/${prepared.length}: ${name} (${blob.size}b)`);
        const formData = new FormData();
        formData.append("file", blob, name);
        formData.append("modulId", modulId);
        formData.append("titel", name);
        formData.append("typ", "dokument");
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const json = await res.json();
        console.log(`[upload] ${i + 1}/${prepared.length} response:`, res.status, json);

        // Smartlearn-Export erkannt: Ergebnis sichtbar machen, statt die
        // Datei stumm liegen zu lassen.
        const a = json?.auswertung;
        if (a?.erkannt) {
          setAuswertung(
            a.uebernommen
              ? `Smartlearn-Export erkannt: ${a.wochenziele} Wochenziele` +
                  (a.bloecke ? `, ${a.bloecke} Blöcke, ${a.aufgaben} Aufgaben` : "") +
                  " übernommen."
              : "Smartlearn-Export erkannt. Das Modul hat bereits einen Modulplan — " +
                  "zum Ersetzen das Scan-Symbol beim Material drücken."
          );
        }
      }
      console.log("[upload] all done, refreshing");
      router.refresh();
    } catch (err) {
      console.error("[upload] error:", err);
    } finally {
      setIsUploading(false);
      setUploadCount(0);
    }
  }

  function prepareFiles(files: FileList | File[]) {
    const prepared: { name: string; blob: Blob }[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      prepared.push({ name: f.name, blob: new Blob([f], { type: f.type }) });
    }
    return prepared;
  }

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter[1]((c) => c + 1);
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter[1]((c) => {
      const next = c - 1;
      if (next <= 0) setIsDragging(false);
      return Math.max(0, next);
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter[1](0);
    if (e.dataTransfer.files?.length) {
      const prepared = prepareFiles(e.dataTransfer.files);
      uploadFiles(prepared);
    }
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative transition-colors duration-[110ms] ease-carbon-standard",
        isDragging && "outline-2 outline-offset-2 outline-[var(--ring)]"
      )}
    >
      {isDragging && (
        <div className="absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-border-interactive bg-notification-info">
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 text-primary" />
            <p className="type-heading-02 text-primary">Dateien hier ablegen</p>
          </div>
        </div>
      )}
      {isUploading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/85">
          <div className="text-center">
            <Loading size={24} className="mx-auto mb-2" />
            <p className="type-body-02 text-text-secondary">
              {uploadCount === 1
                ? "Datei wird hochgeladen…"
                : `${uploadCount} Dateien werden hochgeladen…`}
            </p>
          </div>
        </div>
      )}

      {children}

      {auswertung && (
        <Notification kind="success" titel="Ausgewertet" className="mt-4">
          {auswertung}
        </Notification>
      )}

      <div className="mt-4 flex flex-wrap gap-px">
        <label>
          <input
            type="file"
            className="sr-only"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) {
                const prepared = prepareFiles(e.target.files);
                uploadFiles(prepared);
              }
            }}
            disabled={isUploading}
          />
          <span
            className={cn(
              "type-body-compact-02 relative inline-flex h-10 cursor-pointer items-center border border-primary pr-14 pl-[15px] text-primary",
              "transition-colors duration-[70ms] ease-carbon-entrance hover:bg-primary hover:text-white",
              isUploading && "pointer-events-none border-[#c6c6c6] text-[#c6c6c6]"
            )}
          >
            Datei hochladen
            <Upload size={16} className="absolute right-4" />
          </span>
        </label>
        <AddLinkDialog modulId={modulId} />
      </div>
    </div>
  );
}

function AddLinkDialog({ modulId }: { modulId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        Link / Notiz
        <Add size={16} />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Material hinzufügen</DialogTitle>
        </DialogHeader>

        <form
          action={async (formData) => {
            await createMaterial(formData);
            setOpen(false);
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody>
            <input type="hidden" name="modulId" value={modulId} />

            <div className="mb-8">
              <Label htmlFor="titel">Titel</Label>
              <Input
                id="titel"
                name="titel"
                placeholder="z.B. Scrum-Übersicht"
                className="mt-2"
                required
              />
            </div>

            <div className="mb-8">
              <Label htmlFor="typ">Typ</Label>
              <div className="mt-2">
                <Select name="typ" defaultValue="link" required items={typLabels}>
                  <SelectTrigger id="typ">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-8">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                name="url"
                placeholder="https://…"
                className="mt-2"
              />
              <HelperText className="mt-2">
                Leer lassen, wenn es nur eine Notiz ist.
              </HelperText>
            </div>

            <div>
              <Label htmlFor="notiz">Notiz</Label>
              <Textarea
                id="notiz"
                name="notiz"
                placeholder="Hinweise zum Material…"
                rows={2}
                className="mt-2"
              />
            </div>
          </DialogBody>

          <DialogFooter showCloseButton>
            <Button type="submit" className="h-16 flex-1 items-start pt-4">
              Hinzufügen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Ein Modul in der linken Liste. Ausgewählt trägt es — wie in Carbons SideNav —
 * einen 3px-Balken links und eine hellere Fläche.
 */
function ModulZeile({
  modul,
  isSelected,
  onSelect,
}: {
  modul: ModulData;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={isSelected ? "true" : undefined}
      className={cn(
        "relative block w-full border-b border-border-subtle px-4 py-3 text-left last:border-b-0",
        "transition-colors duration-[110ms] ease-carbon-standard",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        isSelected
          ? "bg-layer-selected before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-border-interactive before:content-['']"
          : "hover:bg-layer-hover"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "type-body-compact-02",
            isSelected ? "font-semibold text-foreground" : "text-foreground"
          )}
        >
          Modul {modul.nummer}
        </span>
        {modul.materialien.length > 0 && (
          <Badge variant="cool-gray" size="sm" className="shrink-0">
            <Attachment size={16} />
            {modul.materialien.length}
          </Badge>
        )}
      </div>
      {modul.bezeichnung && (
        <p className="type-helper-02 mt-1 truncate text-text-secondary">
          {modul.bezeichnung}
        </p>
      )}
    </button>
  );
}

export function ModulSection({ module }: { module: ModulData[] }) {
  const [selectedModulId, setSelectedModulId] = useState<string | null>(null);

  const selectedModul = module.find((m) => m.id === selectedModulId);

  const lehrjahre = Array.from(
    new Set(module.map((m) => m.lehrjahr).filter((lj): lj is number => lj !== null))
  ).sort();

  const moduleByLehrjahr = lehrjahre.map((lj) => ({
    lehrjahr: lj,
    module: module.filter((m) => m.lehrjahr === lj),
  }));

  const ohneZuordnung = module.filter((m) => m.lehrjahr === null);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[18rem_1fr]">
      {/* Links: Module nach Lehrjahr */}
      <div className="space-y-6">
        {moduleByLehrjahr.map(({ lehrjahr, module: ljModule }) => (
          <div key={lehrjahr}>
            <h3 className="type-heading-compact-02 mb-2 border-b border-border-strong pb-2 text-foreground">
              {lehrjahr}. Lehrjahr
            </h3>
            <div className="bg-layer">
              {ljModule.map((modul) => (
                <ModulZeile
                  key={modul.id}
                  modul={modul}
                  isSelected={selectedModulId === modul.id}
                  onSelect={() => setSelectedModulId(modul.id)}
                />
              ))}
            </div>
          </div>
        ))}
        {ohneZuordnung.length > 0 && (
          <div>
            <h3 className="type-heading-compact-02 mb-2 border-b border-border-strong pb-2 text-foreground">
              Ohne Lehrjahr
            </h3>
            <div className="bg-layer">
              {ohneZuordnung.map((modul) => (
                <ModulZeile
                  key={modul.id}
                  modul={modul}
                  isSelected={selectedModulId === modul.id}
                  onSelect={() => setSelectedModulId(modul.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rechts: gewähltes Modul mit Material, Baum und Plan */}
      <div className="min-w-0">
        {selectedModul ? (
          <>
            <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-border-strong pb-3">
              <h2 className="type-heading-04 text-foreground">
                Modul {selectedModul.nummer}
                {selectedModul.bezeichnung && (
                  <span className="type-heading-03 ml-3 text-text-secondary">
                    {selectedModul.bezeichnung}
                  </span>
                )}
              </h2>
              {selectedModul.lehrjahr !== null && (
                <Badge variant="cool-gray">
                  {selectedModul.lehrjahr}. Lehrjahr
                </Badge>
              )}
            </div>

            <section className="mb-12">
              <SectionHeader
                titel="Materialien"
                beschreibung={
                  selectedModul.materialien.length > 0
                    ? `${selectedModul.materialien.length} Dateien und Links. Präsentationen als PDF — Seite = Slide.`
                    : "Präsentationen als PDF ablegen — dann wird die Seite zur Foliennummer."
                }
              />

              <DropZone modulId={selectedModul.id}>
                {selectedModul.materialien.length > 0 ? (
                  <div className="bg-layer">
                    {selectedModul.materialien.map((mat) => {
                      const Icon = typIcons[mat.typ] ?? DocumentBlank;
                      return (
                        <div
                          key={mat.id}
                          className="group type-body-compact-02 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border-subtle px-4 py-2 last:border-b-0 hover:bg-layer-hover"
                        >
                          <Icon
                            size={16}
                            className="shrink-0 text-text-secondary"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {mat.titel}
                          </span>
                          <Badge
                            variant={typFarben[mat.typ] ?? "cool-gray"}
                            size="sm"
                            className="shrink-0"
                          >
                            {typLabels[mat.typ] ?? mat.typ}
                          </Badge>
                          <MaterialBlockEtikett
                            materialId={mat.id}
                            blockNummer={mat.blockNummer}
                            bloecke={selectedModul.bloecke}
                          />
                          <MaterialAuswerten
                            materialId={mat.id}
                            dateiPfad={mat.dateiPfad}
                          />
                          {(mat.dateiPfad || mat.url) && (
                            <Button
                              variant="ghost-neutral"
                              size="icon-sm"
                              className="shrink-0"
                              aria-label={`${mat.titel} öffnen`}
                              title="Öffnen"
                              render={
                                <a
                                  href={
                                    mat.dateiPfad
                                      ? `/api/files/${mat.dateiPfad}`
                                      : mat.url!
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              <Launch size={16} />
                            </Button>
                          )}
                          <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <DeleteButton
                              onDelete={() => deleteMaterial(mat.id)}
                              titel="Material löschen"
                              beschreibung={`«${mat.titel}» wird entfernt, samt der daraus gelesenen Aufgaben.`}
                            />
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border-strong bg-layer py-12 text-center">
                    <Upload size={32} className="mb-3 text-text-helper" />
                    <p className="type-body-02 text-text-secondary">
                      Dateien hierher ziehen oder unten hochladen
                    </p>
                  </div>
                )}
              </DropZone>
            </section>

            <section className="mb-12">
              <SectionHeader
                titel="Aufgabenbaum"
                beschreibung="Block ⇒ Lern- und Arbeitsauftrag ⇒ Aufgabe, aus dem Smartlearn-Export gelesen."
              />
              <ModulBaumSection
                bloecke={selectedModul.bloecke}
                praesentationen={selectedModul.materialien
                  .filter(
                    (m) =>
                      m.typ === "praesentation" || m.dateiPfad?.endsWith(".pdf")
                  )
                  .map((m) => ({ id: m.id, titel: m.titel }))}
              />
            </section>

            <ModulplanSection
              modulId={selectedModul.id}
              eintraege={selectedModul.modularPlan}
            />
          </>
        ) : (
          <div className="flex min-h-64 items-center justify-center border-2 border-dashed border-border-subtle bg-layer">
            <p className="type-body-02 text-text-secondary">
              Wähle links ein Modul, um Material, Aufgabenbaum und Plan zu sehen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
