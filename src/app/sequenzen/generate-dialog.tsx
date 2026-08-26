"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { generateWithAI } from "./actions";

export type BlockConfigForGenerate = {
  blockTyp: string;
  phasenmodellName: string | null;
  thema: string;
};

export function GenerateButton({
  sequenzId,
  klasseId,
  modulId,
  excludeSequenzId,
  blockConfigs,
  hasExistingBlocks,
  disabled,
}: {
  sequenzId: string;
  klasseId: string;
  modulId: string | null;
  excludeSequenzId?: string;
  blockConfigs?: BlockConfigForGenerate[];
  hasExistingBlocks: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    count: number;
    error?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (hasExistingBlocks) {
      setConfirming(true);
      setOpen(true);
    } else {
      startGeneration();
    }
  }

  function startGeneration() {
    setConfirming(false);
    setResult(null);
    setOpen(true);
    startTransition(async () => {
      const res = await generateWithAI(
        sequenzId,
        klasseId,
        modulId,
        excludeSequenzId,
        blockConfigs,
        undefined
      );
      setResult(res);
    });
  }

  function handleClose() {
    if (!isPending) {
      setOpen(false);
      setResult(null);
      setConfirming(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={disabled || isPending}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        KI generieren
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>KI-Unterrichtsplanung</DialogTitle>
          </DialogHeader>

          {confirming ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="text-sm">
                  Die bestehenden Lektionsblöcke werden durch die KI-Planung
                  ersetzt. Dieser Vorgang kann nicht rückgängig gemacht werden.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Abbrechen
                </Button>
                <Button onClick={startGeneration}>
                  <Sparkles className="h-4 w-4" />
                  Trotzdem generieren
                </Button>
              </div>
            </div>
          ) : isPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Planung wird generiert — das kann bis zu einer Minute dauern…
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.success ? (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    {result.count} Lektionsblock{result.count !== 1 ? "e" : ""}{" "}
                    erfolgreich generiert und importiert.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{result.error}</p>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={handleClose}>Schliessen</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
