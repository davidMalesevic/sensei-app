"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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
import {
  Upload,
  Loader2,
  FileText,
  Presentation,
  Link as LinkIcon,
  Video,
  File,
  StickyNote,
  Trash2,
  ExternalLink,
  Plus,
  Paperclip,
} from "lucide-react";
import { createMaterial, deleteMaterial } from "@/app/materialien/actions";

type MaterialItem = {
  id: string;
  titel: string;
  typ: string;
  dateiPfad: string | null;
  url: string | null;
  notiz: string | null;
  createdAt: Date;
};

type ModulData = {
  id: string;
  nummer: number;
  bezeichnung: string | null;
  lehrjahr: number | null;
  materialien: MaterialItem[];
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

const typIcons: Record<string, typeof FileText> = {
  arbeitsblatt: FileText,
  praesentation: Presentation,
  link: LinkIcon,
  video: Video,
  dokument: File,
  notiz: StickyNote,
  sonstiges: File,
};

function UploadDialog({
  modulId,
  modulNummer,
}: {
  modulId: string;
  modulNummer: number;
}) {
  const [isUploading, setIsUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("modulId", modulId);
      formData.append("titel", file.name);
      formData.append("typ", "dokument");

      await fetch("/api/upload", { method: "POST", body: formData });
      window.location.reload();
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <label className="cursor-pointer">
      <input
        type="file"
        className="hidden"
        onChange={handleUpload}
        disabled={isUploading}
      />
      <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-dashed hover:bg-muted transition-colors cursor-pointer">
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {isUploading ? "Wird hochgeladen..." : "Datei hochladen"}
      </span>
    </label>
  );
}

function AddLinkDialog({ modulId }: { modulId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Plus className="h-3.5 w-3.5" />
        Link / Notiz
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
          className="space-y-4"
        >
          <input type="hidden" name="modulId" value={modulId} />

          <div className="space-y-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              name="titel"
              placeholder="z.B. Scrum-Übersicht"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="typ">Typ</Label>
            <Select name="typ" defaultValue="link" required items={typLabels}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label htmlFor="url">URL</Label>
            <Input id="url" name="url" placeholder="https://..." />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notiz">Notiz</Label>
            <Textarea
              id="notiz"
              name="notiz"
              placeholder="Hinweise zum Material..."
              rows={2}
            />
          </div>

          <Button type="submit" className="w-full">
            Hinzufügen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModulCard({
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
      className={`w-full text-left rounded-lg border p-3 transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">
          Modul {modul.nummer}
        </span>
        {modul.materialien.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            <Paperclip className="h-3 w-3" />
            {modul.materialien.length}
          </Badge>
        )}
      </div>
      {modul.bezeichnung && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Left side: Module list by Lehrjahr */}
      <div className="space-y-4">
        {moduleByLehrjahr.map(({ lehrjahr, module: ljModule }) => (
          <div key={lehrjahr}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {lehrjahr}. Lehrjahr
            </h3>
            <div className="space-y-1">
              {ljModule.map((modul) => (
                <ModulCard
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
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Ohne Lehrjahr
            </h3>
            <div className="space-y-1">
              {ohneZuordnung.map((modul) => (
                <ModulCard
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

      {/* Right side: Selected module detail + materials */}
      <div className="md:col-span-2">
        {selectedModul ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Modul {selectedModul.nummer}
                  {selectedModul.bezeichnung && (
                    <span className="font-normal text-muted-foreground ml-2">
                      {selectedModul.bezeichnung}
                    </span>
                  )}
                </span>
                <Badge variant="outline">
                  {selectedModul.lehrjahr}. Lehrjahr
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Materials list */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Paperclip className="h-4 w-4" />
                  Materialien
                  {selectedModul.materialien.length > 0 && (
                    <span className="text-muted-foreground font-normal">
                      ({selectedModul.materialien.length})
                    </span>
                  )}
                </h4>

                {selectedModul.materialien.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedModul.materialien.map((mat) => {
                      const Icon = typIcons[mat.typ] ?? File;
                      return (
                        <div
                          key={mat.id}
                          className="flex items-center gap-2 group text-sm rounded-md p-2 hover:bg-muted/50"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 min-w-0 truncate">
                            {mat.titel}
                          </span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {typLabels[mat.typ] ?? mat.typ}
                          </Badge>
                          {mat.dateiPfad && (
                            <a
                              href={`/api/files/${mat.dateiPfad}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {mat.url && (
                            <a
                              href={mat.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-foreground shrink-0"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                            onClick={async () => {
                              if (confirm("Material löschen?")) {
                                await deleteMaterial(mat.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    Noch kein Material für dieses Modul vorhanden.
                  </p>
                )}
              </div>

              {/* Upload + Add buttons */}
              <div className="flex gap-2 pt-2 border-t">
                <UploadDialog
                  modulId={selectedModul.id}
                  modulNummer={selectedModul.nummer}
                />
                <AddLinkDialog modulId={selectedModul.id} />
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px] rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              Wähle ein Modul aus, um Details und Materialien zu sehen.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
