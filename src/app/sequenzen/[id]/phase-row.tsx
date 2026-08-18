"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { updatePhase, deletePhase } from "../actions";
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

const sozialformLabels: Record<string, string> = {
  EA: "EA",
  PA: "PA",
  GA: "GA",
  Plenum: "Plenum",
};

export function PhaseRow({ phase }: { phase: Phase }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const hasDetails = phase.beschreibung || phase.materialien.length > 0;

  if (editing) {
    return (
      <div className="p-3 rounded bg-muted/50 space-y-3">
        <form
          action={async (formData) => {
            await updatePhase(phase.id, formData);
            setEditing(false);
          }}
          className="space-y-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input
              name="bezeichnung"
              defaultValue={phase.bezeichnung}
              className="h-8 w-48"
              required
            />
            <Input
              name="dauerMinuten"
              type="number"
              min="1"
              defaultValue={phase.dauerMinuten ?? ""}
              placeholder="Min."
              className="h-8 w-20"
            />
            <Select name="sozialform" defaultValue={phase.sozialform ?? "keine"}>
              <SelectTrigger className="h-8 w-28">
                <SelectValue placeholder="Form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keine">–</SelectItem>
                <SelectItem value="EA">EA</SelectItem>
                <SelectItem value="PA">PA</SelectItem>
                <SelectItem value="GA">GA</SelectItem>
                <SelectItem value="Plenum">Plenum</SelectItem>
              </SelectContent>
            </Select>
            <Input
              name="methode"
              defaultValue={phase.methode ?? ""}
              placeholder="Methode"
              className="h-8 w-40"
            />
          </div>
          <Textarea
            name="beschreibung"
            defaultValue={phase.beschreibung ?? ""}
            placeholder="Inhalt, Ablauf, Hinweise... (Markdown)"
            rows={4}
            className="text-sm font-mono"
          />
          <div className="flex gap-1">
            <Button type="submit" variant="ghost" size="icon" className="h-8 w-8">
              <Check className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setEditing(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded hover:bg-muted/50">
      <div className="flex items-center gap-2 p-2 group">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <span
          className="text-sm font-medium min-w-0 flex-1 truncate cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          {phase.bezeichnung}
        </span>
        {phase.dauerMinuten && (
          <Badge variant="outline" className="shrink-0">
            {phase.dauerMinuten} Min.
          </Badge>
        )}
        {phase.sozialform && (
          <Badge variant="secondary" className="shrink-0">
            {sozialformLabels[phase.sozialform]}
          </Badge>
        )}
        {phase.methode && (
          <span className="text-xs text-muted-foreground shrink-0">
            {phase.methode}
          </span>
        )}
        {phase.materialien.length > 0 && (
          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={async () => {
              if (confirm("Phase löschen?")) {
                await deletePhase(phase.id);
              }
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="pl-8 pr-2 pb-3 space-y-3">
          {phase.beschreibung ? (
            <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-2">
              {phase.beschreibung}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Kein Inhalt. Klicke auf den Stift um Text hinzuzufügen.
            </p>
          )}
          <MaterialSection
            materialien={phase.materialien}
            phaseId={phase.id}
            compact
          />
        </div>
      )}
    </div>
  );
}
