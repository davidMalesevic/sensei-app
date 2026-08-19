"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";
import { generatePrompt } from "./actions";

export function PromptButton({
  klasseId,
  modulId,
  excludeSequenzId,
  disabled,
}: {
  klasseId: string;
  modulId: string | null;
  excludeSequenzId?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => {
      const result = await generatePrompt(klasseId, modulId, excludeSequenzId);
      setPrompt(result);
      setOpen(true);
    });
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleGenerate}
        disabled={disabled || isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Prompt erstellen
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Prompt für KI-Unterrichtsplanung</DialogTitle>
          </DialogHeader>
          <Textarea
            value={prompt}
            readOnly
            className="flex-1 min-h-[400px] font-mono text-xs resize-none"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Schliessen
            </Button>
            <Button onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Kopiert!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  In Zwischenablage kopieren
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
