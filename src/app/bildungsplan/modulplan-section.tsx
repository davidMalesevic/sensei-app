"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Add, TrashCan } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loading } from "@/components/ui/loading";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
        Modulplan importieren
        <Upload size={16} />
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modulplan importieren</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <p className="type-body-02 mb-8 text-text-secondary">
            Bestehende Wochenziele dieses Moduls werden ersetzt.
            Smartlearn-Exporte und JSON werden direkt gelesen, übriges HTML und
            PDF per KI in Wochenziele übersetzt.
          </p>

          <div className="mb-8">
            <Label htmlFor="modulplan-datei">Datei</Label>
            <Input
              id="modulplan-datei"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.html,.htm,.json,.csv,.txt,.md,.xml"
              disabled={busy}
              className="mt-2 py-2"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <HelperText className="mt-2">
              PDF, HTML, JSON, CSV oder TXT. Der Import startet sofort.
            </HelperText>
          </div>

          <div>
            <Label htmlFor="modulplan-text">…oder Inhalt einfügen</Label>
            <Textarea
              id="modulplan-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                '{\n  "eintraege": [\n    { "kw": 34, "ziel": "Scrum-Grundlagen" }\n  ]\n}\n\n…oder Text/HTML aus dem Modulplan.'
              }
              className="mt-2 min-h-48 resize-none font-mono text-sm"
              disabled={busy}
            />
          </div>

          {busy && (
            <div className="mt-4 flex items-center gap-2">
              <Loading size={16} />
              <span className="type-body-02 text-text-secondary">
                Wird gelesen…
              </span>
            </div>
          )}

          {feedback && (
            <Notification
              kind={feedback.ok ? "success" : "error"}
              titel={feedback.ok ? "Import gelungen" : "Import fehlgeschlagen"}
              className="mt-4"
            >
              {feedback.message}
            </Notification>
          )}
        </DialogBody>

        <DialogFooter showCloseButton>
          <Button
            onClick={handleTextImport}
            disabled={busy || !text.trim()}
            className="h-16 flex-1 items-start pt-4"
          >
            Text importieren
            <Upload size={16} className="top-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NeuerEintragDialog({ modulId }: { modulId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Woche
        <Add size={16} />
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
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogBody>
            <input type="hidden" name="modulId" value={modulId} />

            <div className="mb-8 max-w-32">
              <Label htmlFor="kw">Kalenderwoche</Label>
              <Input
                id="kw"
                name="kw"
                type="number"
                min="1"
                max="53"
                placeholder="34"
                className="mt-2"
                required
              />
            </div>

            <div className="mb-8">
              <Label htmlFor="ziel">Ziel</Label>
              <Input
                id="ziel"
                name="ziel"
                placeholder="z.B. Scrum-Rollen kennen und unterscheiden"
                className="mt-2"
                required
              />
            </div>

            <div className="mb-8">
              <Label htmlFor="lbHinweis">Leistungsbeurteilung</Label>
              <Input
                id="lbHinweis"
                name="lbHinweis"
                placeholder="z.B. Abgabe Transferarbeit Kommunikation"
                className="mt-2"
              />
            </div>

            <div>
              <Label htmlFor="beschreibung">Beschreibung</Label>
              <Textarea
                id="beschreibung"
                name="beschreibung"
                rows={3}
                placeholder="Details zur Woche…"
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
    <section className="mb-12">
      <SectionHeader
        titel="Modulplan"
        beschreibung={
          eintraege.length > 0
            ? `${eintraege.length} Wochen. Die Kette KW ⇒ Block ⇒ LA ⇒ Aufgaben hängt daran.`
            : undefined
        }
        aktionen={
          <>
            <NeuerEintragDialog modulId={modulId} />
            <ImportDialog modulId={modulId} />
          </>
        }
      />

      {eintraege.length === 0 ? (
        <div className="border-2 border-dashed border-border-subtle bg-layer p-6">
          <p className="type-body-02 text-text-secondary">
            Noch kein Modulplan hinterlegt. Importiere ihn als PDF, HTML oder
            JSON — die Wochenziele erscheinen dann auf der Sequenz-Seite.
          </p>
        </div>
      ) : (
        <div className="bg-layer">
          {eintraege.map((e) => (
            <div
              key={e.id}
              className="group flex items-start gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0 hover:bg-layer-hover"
            >
              <Badge variant="cool-gray" size="sm" className="mt-0.5 shrink-0">
                KW {e.kw}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="type-heading-compact-02 text-foreground">
                  {e.ziel}
                </p>
                {e.lbHinweis && (
                  <p className="type-helper-02 mt-1 font-semibold text-support-caution">
                    LB: {e.lbHinweis}
                  </p>
                )}
                {e.beschreibung && (
                  <p className="type-helper-02 mt-1 whitespace-pre-wrap text-text-secondary">
                    {e.beschreibung}
                  </p>
                )}
              </div>
              <Button
                variant="destructive-ghost"
                size="icon-sm"
                className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Wochenziel KW ${e.kw} löschen`}
                title="Löschen"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteModularPlanEintrag(e.id);
                    router.refresh();
                  })
                }
              >
                <TrashCan size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
