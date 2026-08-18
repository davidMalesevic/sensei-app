"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
  Clock,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import {
  createLektionsblock,
  deleteLektionsblock,
  createPhase,
  updatePhase,
  deletePhase,
} from "../actions";
import { PhaseRow } from "./phase-row";
import { MaterialSection } from "@/components/material-section";

type MaterialItem = {
  id: string;
  titel: string;
  typ: string;
  url: string | null;
  notiz: string | null;
};

type Phase = {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  dauerMinuten: number | null;
  sozialform: "EA" | "PA" | "GA" | "Plenum" | null;
  methode: string | null;
  sortierung: number;
  materialien: MaterialItem[];
};

type Lektionsblock = {
  id: string;
  datum: string | null;
  blockTyp: "2er" | "4er";
  thema: string | null;
  sortierung: number;
  phasenmodell: { id: string; name: string } | null;
  phasen: Phase[];
  materialien: MaterialItem[];
};

type Phasenmodell = {
  id: string;
  name: string;
  beschreibung: string | null;
  phasenTemplates: {
    id: string;
    kuerzel: string;
    bezeichnung: string;
    zweck: string | null;
    sortierung: number;
    optional: boolean;
  }[];
};

function getBlockDauer(blockTyp: "2er" | "4er"): number {
  return blockTyp === "2er" ? 90 : 180;
}

function NewBlockDialog({
  sequenzId,
  phasenmodelle,
}: {
  sequenzId: string;
  phasenmodelle: Phasenmodell[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="h-4 w-4" />
        Lektionsblock hinzufügen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neuer Lektionsblock</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createLektionsblock(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="sequenzId" value={sequenzId} />

          <div className="space-y-2">
            <Label htmlFor="thema">Thema</Label>
            <Input
              id="thema"
              name="thema"
              placeholder="z.B. Einführung Scrum"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="blockTyp">Blocktyp</Label>
              <Select name="blockTyp" defaultValue="2er" required>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2er">2er-Block (90 Min.)</SelectItem>
                  <SelectItem value="4er">4er-Block (180 Min.)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="datum">Datum</Label>
              <Input id="datum" name="datum" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phasenmodellId">Phasenmodell</Label>
            <Select name="phasenmodellId" defaultValue="frei">
              <SelectTrigger>
                <SelectValue placeholder="Kein Modell (frei)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="frei">Frei (kein Modell)</SelectItem>
                {phasenmodelle.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.name} ({pm.phasenTemplates.length} Phasen)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Phasen werden aus dem gewählten Modell generiert und können danach
              angepasst werden.
            </p>
          </div>

          <Button type="submit" className="w-full">
            Lektionsblock anlegen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewPhaseDialog({ lektionsblockId }: { lektionsblockId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus className="h-3 w-3" />
        Phase hinzufügen
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Neue Phase</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createPhase(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input
            type="hidden"
            name="lektionsblockId"
            value={lektionsblockId}
          />

          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input
              id="bezeichnung"
              name="bezeichnung"
              placeholder="z.B. Einstieg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dauerMinuten">Dauer (Min.)</Label>
              <Input
                id="dauerMinuten"
                name="dauerMinuten"
                type="number"
                min="1"
                placeholder="15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sozialform">Sozialform</Label>
              <Select name="sozialform" defaultValue="keine">
                <SelectTrigger>
                  <SelectValue placeholder="Wählen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keine">–</SelectItem>
                  <SelectItem value="EA">EA (Einzelarbeit)</SelectItem>
                  <SelectItem value="PA">PA (Partnerarbeit)</SelectItem>
                  <SelectItem value="GA">GA (Gruppenarbeit)</SelectItem>
                  <SelectItem value="Plenum">Plenum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="methode">Methode</Label>
            <Input
              id="methode"
              name="methode"
              placeholder="z.B. Think-Pair-Share"
            />
          </div>

          <Button type="submit" className="w-full">
            Phase hinzufügen
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LektionsblockCard({
  block,
}: {
  block: Lektionsblock;
}) {
  const maxMinuten = getBlockDauer(block.blockTyp);
  const totalMinuten = block.phasen.reduce(
    (sum, p) => sum + (p.dauerMinuten ?? 0),
    0
  );
  const isOvertime = totalMinuten > maxMinuten;
  const hasAnyTime = block.phasen.some((p) => p.dauerMinuten);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {block.thema || `Block ${block.sortierung + 1}`}
              <Badge variant="outline">{block.blockTyp}-Block</Badge>
              {block.phasenmodell && (
                <Badge variant="secondary">{block.phasenmodell.name}</Badge>
              )}
            </CardTitle>
            {block.datum && (
              <CardDescription>
                {new Date(block.datum).toLocaleDateString("de-CH", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasAnyTime && (
              <div
                className={`flex items-center gap-1 text-sm ${
                  isOvertime ? "text-red-600 font-medium" : "text-muted-foreground"
                }`}
              >
                {isOvertime ? (
                  <AlertTriangle className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                {totalMinuten} / {maxMinuten} Min.
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={async () => {
                if (confirm("Lektionsblock löschen?")) {
                  await deleteLektionsblock(block.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {block.phasen.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Noch keine Phasen vorhanden.
          </p>
        ) : (
          <div className="space-y-1">
            {block.phasen.map((p) => (
              <PhaseRow key={p.id} phase={p} />
            ))}
          </div>
        )}

        {isOvertime && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-2 rounded">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Zeitüberschreitung: {totalMinuten - maxMinuten} Minuten über dem{" "}
            {block.blockTyp === "2er" ? "2er" : "4er"}-Block ({maxMinuten}{" "}
            Min.)
          </div>
        )}

        <div className="mt-3 border-t pt-3">
          <MaterialSection
            materialien={block.materialien}
            lektionsblockId={block.id}
            compact
          />
        </div>

        <div className="mt-3 border-t pt-3">
          <NewPhaseDialog lektionsblockId={block.id} />
        </div>
      </CardContent>
    </Card>
  );
}

export function LektionsbloeckeSection({
  sequenzId,
  lektionsbloecke,
  phasenmodelle,
}: {
  sequenzId: string;
  lektionsbloecke: Lektionsblock[];
  phasenmodelle: Phasenmodell[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Lektionsblöcke</h2>
        <NewBlockDialog sequenzId={sequenzId} phasenmodelle={phasenmodelle} />
      </div>

      {lektionsbloecke.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            Noch keine Lektionsblöcke vorhanden. Füge den ersten Block hinzu und
            wähle ein Phasenmodell.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {lektionsbloecke.map((block) => (
            <LektionsblockCard key={block.id} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
