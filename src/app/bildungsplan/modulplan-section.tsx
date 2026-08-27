"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CalendarRange,
  Upload,
  Loader2,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import {
  importModularPlan,
  createModularPlanEintrag,
  deleteModularPlanEintrag,
} from "@/app/bildungsplan/modulplan-actions";

export type ModularPlanEintragItem = {
  id: string;
  kw: number;
  ziel: string;
  beschreibung: string | null;
  lbHinweis: string | null;
};

function ImportDialog({ modulId }: { modulId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<
    { ok: boolean; message: string } | null
  >(null);

  function reset() {
    setText("");
    setFeedback(null);
  }

  async function handleTextImport() {
    setBusy(true);
    setFeedback(null);
    const result = await importModularPlan(modulId, text);
    setBusy(false);
    if (result.success) {
      setFeedback({
        ok: true,
        message:
          result.quelle === "smartlearn"
            ? `${result.count} Wochenziele direkt aus dem Smartlearn-Export gelesen.`
            : `${result.count} Wochenziele importiert.`,
      });
      setText("");
      router.refresh();
    } else {
      setFeedback({ ok: false, message: result.error ?? "Import fehlgeschlagen." });
    }
  }

  async function handleFile(file: File) {
    setBusy(true);
    setFeedback(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("modulId", modulId);

    try {
      const res = await fetch("/api/modulplan/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Beim HTML-Export kommt der Aufgabenbaum mit — das muss sichtbar
        // sein, sonst weiss man nicht, ob die Kette KW → Block → Aufgabe steht.
        const baum = data.baum?.ok
          ? ` Aufgabenbaum: ${data.baum.bloecke} Blöcke, ${data.baum.aufgaben} Aufgaben.`
          : data.baum?.error
            ? ` Kein Aufgabenbaum: ${data.baum.error}`
            : "";

        setFeedback({
          ok: true,
          message:
            (data.quelle === "smartlearn"
              ? `${data.count} Wochenziele direkt aus dem Smartlearn-Export «${file.name}» gelesen.`
              : `${data.count} Wochenziele aus «${file.name}» importiert.`) + baum,
        });
        router.refresh();
      } else {
        setFeedback({
          ok: false,
          message: data.error ?? "Import fehlgeschlagen.",
        });
      }
    } catch (e) {
      setFeedback({ ok: false, message: `Upload-Fehler: ${e}` });
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Upload className="h-3.5 w-3.5" />
        Modulplan importieren
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Modulplan importieren</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Bestehende Wochenziele dieses Moduls werden ersetzt. Smartlearn-Exporte
          und JSON werden direkt gelesen, übriges HTML und PDF per KI in
          Wochenziele übersetzt.
        </p>

        <div className="space-y-2">
          <Label htmlFor="modulplan-datei">Datei (PDF, HTML, JSON, CSV, TXT)</Label>
          <Input
            id="modulplan-datei"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.html,.htm,.json,.csv,.txt,.md,.xml"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        <div className="space-y-2 flex-1 flex flex-col">
          <Label htmlFor="modulplan-text">…oder Inhalt einfügen</Label>
          <Textarea
            id="modulplan-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              '{\n  "eintraege": [\n    { "kw": 34, "ziel": "Scrum-Grundlagen" }\n  ]\n}\n\n…oder Text/HTML aus dem Modulplan.'
            }
            className="flex-1 min-h-[200px] font-mono text-xs resize-none"
            disabled={busy}
          />
        </div>

        {feedback && (
          <div
            className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
              feedback.ok
                ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200"
            }`}
          >
            {feedback.ok ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Schliessen
          </Button>
          <Button onClick={handleTextImport} disabled={busy || !text.trim()}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Text importieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NeuerEintragDialog({ modulId }: { modulId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        <Plus className="h-3.5 w-3.5" />
        Woche
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wochenziel hinzufügen</DialogTitle>
        </DialogHeader>
        <form
          action={async (formData) => {
            await createModularPlanEintrag(formData);
            setOpen(false);
          }}
          className="space-y-4"
        >
          <input type="hidden" name="modulId" value={modulId} />

          <div className="space-y-2">
            <Label htmlFor="kw">Kalenderwoche</Label>
            <Input
              id="kw"
              name="kw"
              type="number"
              min="1"
              max="53"
              placeholder="34"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ziel">Ziel</Label>
            <Input
              id="ziel"
              name="ziel"
              placeholder="z.B. Scrum-Rollen kennen und unterscheiden"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lbHinweis">Leistungsbeurteilung</Label>
            <Input
              id="lbHinweis"
              name="lbHinweis"
              placeholder="z.B. Abgabe Transferarbeit Kommunikation"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea
              id="beschreibung"
              name="beschreibung"
              rows={3}
              placeholder="Details zur Woche…"
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

export function ModulplanSection({
  modulId,
  eintraege,
}: {
  modulId: string;
  eintraege: ModularPlanEintragItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <CalendarRange className="h-4 w-4" />
          Modulplan
          {eintraege.length > 0 && (
            <span className="text-muted-foreground font-normal">
              ({eintraege.length} Wochen)
            </span>
          )}
        </h4>
        <div className="flex gap-1">
          <NeuerEintragDialog modulId={modulId} />
          <ImportDialog modulId={modulId} />
        </div>
      </div>

      {eintraege.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Noch kein Modulplan hinterlegt. Importiere ihn als PDF, HTML oder
            JSON — die Wochenziele erscheinen dann im Sequenz-Cockpit.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {eintraege.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-2 group text-sm rounded-md p-2 hover:bg-muted/50"
            >
              <Badge variant="outline" className="shrink-0 mt-0.5">
                KW {e.kw}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{e.ziel}</p>
                {e.lbHinweis && (
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    LB: {e.lbHinweis}
                  </p>
                )}
                {e.beschreibung && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {e.beschreibung}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteModularPlanEintrag(e.id);
                    router.refresh();
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
