"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  FileText,
  Link as LinkIcon,
  Video,
  StickyNote,
  Presentation,
  File,
  ExternalLink,
} from "lucide-react";
import { createMaterial, deleteMaterial } from "@/app/materialien/actions";

type Material = {
  id: string;
  titel: string;
  typ: string;
  url: string | null;
  notiz: string | null;
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

function AddMaterialDialog({
  sequenzId,
  lektionsblockId,
  phaseId,
}: {
  sequenzId?: string;
  lektionsblockId?: string;
  phaseId?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus className="h-3 w-3" />
        Material
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
          {sequenzId && (
            <input type="hidden" name="sequenzId" value={sequenzId} />
          )}
          {lektionsblockId && (
            <input
              type="hidden"
              name="lektionsblockId"
              value={lektionsblockId}
            />
          )}
          {phaseId && <input type="hidden" name="phaseId" value={phaseId} />}

          <div className="space-y-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              name="titel"
              placeholder="z.B. Arbeitsblatt Scrum-Übersicht"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="typ">Typ</Label>
            <Select name="typ" defaultValue="dokument" required items={typLabels}>
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
            <Label htmlFor="url">URL / Pfad</Label>
            <Input
              id="url"
              name="url"
              placeholder="https://... oder Dateipfad"
            />
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

export function MaterialSection({
  materialien,
  sequenzId,
  lektionsblockId,
  phaseId,
  compact = false,
}: {
  materialien: Material[];
  sequenzId?: string;
  lektionsblockId?: string;
  phaseId?: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-2">
      {materialien.length > 0 && (
        <div className={compact ? "space-y-1" : "space-y-2"}>
          {materialien.map((mat) => {
            const Icon = typIcons[mat.typ] ?? File;
            return (
              <div
                key={mat.id}
                className="flex items-center gap-2 group text-sm"
              >
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 min-w-0 truncate">{mat.titel}</span>
                <Badge variant="outline" className="text-xs shrink-0">
                  {typLabels[mat.typ] ?? mat.typ}
                </Badge>
                {mat.url && (
                  <a
                    href={mat.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  onClick={async () => {
                    if (confirm("Material löschen?")) {
                      await deleteMaterial(mat.id);
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <AddMaterialDialog
        sequenzId={sequenzId}
        lektionsblockId={lektionsblockId}
        phaseId={phaseId}
      />
    </div>
  );
}
