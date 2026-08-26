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
} from "lucide-react";
import {
  extractMaterialTasks,
  deleteMaterialTask,
} from "@/app/materialien/actions";
import { saveCockpitNotiz } from "../actions";
import type { CockpitMaterial } from "../actions";
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
  materialien: CockpitMaterial[];
};

const HERKUNFT_LABELS: Record<CockpitMaterial["herkunft"], string> = {
  sequenz: "Sequenz",
  block: "Block",
  phase: "Phase",
  modul: "Modul",
};

function MaterialTasks({ material }: { material: CockpitMaterial }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const href = material.dateiPfad
    ? `/api/files/${material.dateiPfad}`
    : material.url;

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
              <span className="flex-1 min-w-0">{task.taskText}</span>
              {task.referenz && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {task.referenz}
                </Badge>
              )}
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

          {!ziel &&
            !data.beschreibung &&
            !data.praxisbezug &&
            data.handlungskompetenzen.length === 0 &&
            data.lektionsbloecke.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Noch keine Anker vorhanden. Hinterlege einen Modulplan, eine
                Beschreibung oder Lektionsblöcke.
              </p>
            )}
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
