"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2, Calendar } from "lucide-react";
import { createKalenderEintrag, deleteKalenderEintrag } from "../actions";

type KalenderEintrag = {
  id: string;
  bezeichnung: string;
  typ: "feiertag" | "ferien" | "pruefung" | "sonstiges";
  startDatum: string;
  endDatum: string;
};

const typLabels: Record<string, string> = {
  feiertag: "Feiertag",
  ferien: "Ferien",
  pruefung: "Prüfung",
  sonstiges: "Sonstiges",
};

const typColors: Record<string, string> = {
  feiertag: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  ferien: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pruefung: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sonstiges: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

export function KalenderEintraegeSection({
  semesterId,
  eintraege,
}: {
  semesterId: string;
  eintraege: KalenderEintrag[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Kalender-Einträge
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="outline" />}>
            <Plus className="h-4 w-4" />
            Eintrag hinzufügen
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Kalender-Eintrag hinzufügen</DialogTitle>
            </DialogHeader>
            <form
              action={async (formData) => {
                await createKalenderEintrag(formData);
                setOpen(false);
              }}
              className="space-y-4"
            >
              <input type="hidden" name="semesterId" value={semesterId} />

              <div className="space-y-2">
                <Label htmlFor="bezeichnung">Bezeichnung</Label>
                <Input
                  id="bezeichnung"
                  name="bezeichnung"
                  placeholder="z.B. Herbstferien, Nationalfeiertag"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="typ">Typ</Label>
                <Select name="typ" defaultValue="feiertag" required items={typLabels}>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDatum">Von</Label>
                  <Input
                    id="startDatum"
                    name="startDatum"
                    type="date"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDatum">Bis</Label>
                  <Input
                    id="endDatum"
                    name="endDatum"
                    type="date"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                Hinzufügen
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {eintraege.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Noch keine Kalender-Einträge. Füge Feiertage, Ferien und
            Prüfungstage hinzu.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {eintraege.map((ke) => (
            <div
              key={ke.id}
              className="flex items-center gap-3 p-2 rounded border text-sm"
            >
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typColors[ke.typ]}`}
              >
                {typLabels[ke.typ]}
              </span>
              <span className="font-medium flex-1">{ke.bezeichnung}</span>
              <span className="text-muted-foreground text-xs">
                {new Date(ke.startDatum).toLocaleDateString("de-CH")}
                {ke.startDatum !== ke.endDatum &&
                  ` – ${new Date(ke.endDatum).toLocaleDateString("de-CH")}`}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={async () => {
                  if (confirm("Eintrag löschen?")) {
                    await deleteKalenderEintrag(ke.id);
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
