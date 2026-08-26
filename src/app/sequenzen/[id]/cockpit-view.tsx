"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Anchor,
  Sparkles,
  Loader2,
  ListChecks,
  StickyNote,
  Paperclip,
  ExternalLink,
  Trash2,
  Target,
  Check,
  AlertTriangle,
  Zap,
  Repeat,
  Plus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { materialHref } from "@/lib/material-link";
import {
  extractMaterialTasks,
  deleteMaterialTask,
} from "@/app/materialien/actions";
import {
  saveCockpitNotiz,
  generateBaustein,
  createAnker,
  deleteAnker,
  type BausteinArt,
} from "../actions";
import type { CockpitMaterial, CockpitAnker } from "../actions";
import type { SequenzKontext } from "@/lib/kontext";

type CockpitData = {
  id: string;
  titel: string;
  beschreibung: string | null;
  praxisbezug: string | null;
  cockpitNotiz: string | null;
  modulLabel: string | null;
  handlungskompetenzen: { id: string; kuerzel: string; bezeichnung: string }[];
  lektionsbloecke: {
    id: string;
    thema: string | null;
    blockTyp: "2er" | "4er";
    datum: string | null;
    sortierung: number;
  }[];
  anker: CockpitAnker[];
  materialien: CockpitMaterial[];
};

const ANKER_LABELS: Record<CockpitAnker["art"], string> = {
  einstieg: "Einstieg",
  repetition: "Repetition",
  aufgabe: "Aufgabe",
  referenz: "Referenz",
  modus: "Modus",
  notiz: "Notiz",
};

const HERKUNFT_LABELS: Record<CockpitMaterial["herkunft"], string> = {
  sequenz: "Sequenz",
  block: "Block",
  phase: "Phase",
  modul: "Modul",
};


const BAUSTEINE: { art: BausteinArt; label: string; icon: typeof Zap }[] = [
  { art: "einstieg", label: "Aktivierender Einstieg", icon: Zap },
  { art: "repetition", label: "Repetitionsblock", icon: Repeat },
];

function NeuerAnkerDialog({ sequenzId }: { sequenzId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus className="h-3.5 w-3.5" />
        Anker
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Anker hinzufügen</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createAnker(formData);
            setOpen(false);
            router.refresh();
          }}
          className="space-y-4"
        >
          <input type="hidden" name="sequenzId" value={sequenzId} />

          <div className="space-y-2">
            <Label htmlFor="art">Art</Label>
            <Select name="art" defaultValue="aufgabe" items={ANKER_LABELS}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ANKER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              name="titel"
              placeholder="z.B. Aufgabe 4.2 aus Smartlearn / Freie Arbeit"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="text">Details</Label>
            <Textarea
              id="text"
              name="text"
              rows={3}
              placeholder="z.B. Präsentation PR_119_5000 → Folie 15-20"
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

function AnkerListe({
  sequenzId,
  anker,
}: {
  sequenzId: string;
  anker: CockpitAnker[];
}) {
  const router = useRouter();
  const [aktiv, setAktiv] = useState<BausteinArt | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function generieren(art: BausteinArt) {
    setAktiv(art);
    setFehler(null);
    startTransition(async () => {
      const res = await generateBaustein(sequenzId, art);
      setAktiv(null);
      if (res.success) {
        router.refresh();
      } else {
        setFehler(res.error ?? "Generierung fehlgeschlagen.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {BAUSTEINE.map(({ art, label, icon: Icon }) => (
          <Button
            key={art}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => generieren(art)}
            disabled={isPending}
          >
            {isPending && aktiv === art ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {label}
          </Button>
        ))}
        <NeuerAnkerDialog sequenzId={sequenzId} />
      </div>

      {fehler && (
        <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded p-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{fehler}</span>
        </div>
      )}

      {isPending && aktiv && (
        <p className="text-sm text-muted-foreground">
          {BAUSTEINE.find((b) => b.art === aktiv)?.label} wird generiert — das
          kann bis zu einer Minute dauern…
        </p>
      )}

      {anker.length > 0 && (
        <div className="space-y-2">
          {anker.map((a) => (
            <div key={a.id} className="rounded-lg border p-3 group">
              <div className="flex items-start gap-2">
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {ANKER_LABELS[a.art]}
                </Badge>
                <span className="flex-1 min-w-0 text-sm font-medium">
                  {a.titel}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteAnker(a.id);
                      router.refresh();
                    })
                  }
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {a.text && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1.5 pl-1">
                  {a.text}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialTasks({ material }: { material: CockpitMaterial }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const href = materialHref(material);

  function extrahieren() {
    setFehler(null);
    startTransition(async () => {
      const res = await extractMaterialTasks(material.id);
      if (!res.success) {
        setFehler(res.error ?? "Extraktion fehlgeschlagen.");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <span className="flex-1 min-w-0 text-sm font-medium">
          {material.titel}
        </span>
        <Badge variant="outline" className="text-xs shrink-0">
          {HERKUNFT_LABELS[material.herkunft]}
        </Badge>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0"
          onClick={extrahieren}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {material.tasks.length > 0 ? "Neu extrahieren" : "Aufgaben extrahieren"}
        </Button>
      </div>

      {fehler && (
        <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded p-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{fehler}</span>
        </div>
      )}

      {material.tasks.length > 0 ? (
        <ul className="space-y-1 pl-6">
          {material.tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-2 group text-sm">
              <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <span className="flex-1 min-w-0">
                {task.bezeichnung && (
                  <span className="font-medium">{task.bezeichnung}: </span>
                )}
                {task.taskText}
              </span>
              {task.referenz &&
                (() => {
                  const sprung = materialHref(material, task.referenz);
                  return sprung ? (
                    <a
                      href={sprung}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                      title={`Im Material öffnen: ${task.referenz}`}
                    >
                      <Badge
                        variant="secondary"
                        className="text-[10px] hover:bg-secondary/70 cursor-pointer"
                      >
                        {task.referenz}
                      </Badge>
                    </a>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {task.referenz}
                    </Badge>
                  );
                })()}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteMaterialTask(task.id);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground pl-6">
          Noch keine Aufgaben extrahiert.
        </p>
      )}
    </div>
  );
}

function CockpitNotizen({
  sequenzId,
  notiz,
}: {
  sequenzId: string;
  notiz: string | null;
}) {
  const [wert, setWert] = useState(notiz ?? "");
  const [gespeichert, setGespeichert] = useState(false);
  const saveAction = saveCockpitNotiz.bind(null, sequenzId);

  return (
    <form
      action={async (formData) => {
        await saveAction(formData);
        setGespeichert(true);
        setTimeout(() => setGespeichert(false), 2000);
      }}
      className="space-y-2"
    >
      <Textarea
        name="cockpitNotiz"
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        rows={6}
        placeholder="Freie Notizen, Links, Merkpunkte für diese Sequenz…"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="outline">
          {gespeichert ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Gespeichert
            </>
          ) : (
            "Notizen speichern"
          )}
        </Button>
      </div>
    </form>
  );
}

/**
 * Reduzierte Arbeitsansicht der Sequenz: Anker statt Detailplanung.
 * Zeigt Grobziele, die aus Materialien extrahierten Aufgaben und freie Notizen.
 */
export function CockpitView({
  data,
  kontext,
}: {
  data: CockpitData;
  kontext: SequenzKontext;
}) {
  const ziel = kontext.aktuellesZiel ?? kontext.naechstesZiel;
  const anzahlTasks = data.materialien.reduce(
    (sum, m) => sum + m.tasks.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* Anker: Grobziele */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Anchor className="h-4 w-4" />
            Anker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ziel && (
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">
                  KW {ziel.kw}: {ziel.ziel}
                </p>
                {ziel.beschreibung && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {ziel.beschreibung}
                  </p>
                )}
              </div>
            </div>
          )}

          {data.beschreibung && (
            <p className="text-sm whitespace-pre-wrap">{data.beschreibung}</p>
          )}

          {data.praxisbezug && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Praxisbezug
              </p>
              <p className="text-sm whitespace-pre-wrap">{data.praxisbezug}</p>
            </div>
          )}

          {data.handlungskompetenzen.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.handlungskompetenzen.map((hk) => (
                <Badge key={hk.id} variant="secondary">
                  {hk.kuerzel} – {hk.bezeichnung}
                </Badge>
              ))}
            </div>
          )}

          {data.lektionsbloecke.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                Blöcke
              </p>
              <ol className="space-y-1">
                {data.lektionsbloecke.map((lb, i) => (
                  <li key={lb.id} className="text-sm flex items-center gap-2">
                    <span className="text-muted-foreground tabular-nums">
                      {i + 1}.
                    </span>
                    <span className="flex-1 min-w-0">
                      {lb.thema || `Block ${i + 1}`}
                    </span>
                    {lb.datum && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(lb.datum).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    )}
                    <Badge variant="outline" className="text-xs shrink-0">
                      {lb.blockTyp}
                    </Badge>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="border-t pt-4">
            <AnkerListe sequenzId={data.id} anker={data.anker} />
          </div>
        </CardContent>
      </Card>

      {/* Aufgaben aus Materialien */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Aufgaben aus Materialien
            {anzahlTasks > 0 && (
              <span className="text-muted-foreground font-normal text-sm">
                ({anzahlTasks})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.materialien.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Für diese Sequenz und ihr Modul sind noch keine Materialien
              hinterlegt.
            </p>
          ) : (
            <div className="space-y-2">
              {data.materialien.map((m) => (
                <MaterialTasks key={m.id} material={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Freie Notizen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <StickyNote className="h-4 w-4" />
            Notizen & Referenzen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CockpitNotizen
            sequenzId={data.id}
            notiz={data.cockpitNotiz}
          />
        </CardContent>
      </Card>
    </div>
  );
}
