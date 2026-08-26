"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Zap,
  Repeat,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { generateBaustein, type BausteinArt } from "../actions";

const BAUSTEINE: {
  art: BausteinArt;
  label: string;
  icon: typeof Zap;
}[] = [
  { art: "einstieg", label: "Aktivierender Einstieg", icon: Zap },
  { art: "repetition", label: "Repetitionsblock", icon: Repeat },
];

/**
 * Fügt per KI generierte didaktische Bausteine mit einem Klick als
 * zusätzlichen Lektionsblock an die Sequenz an.
 */
export function BausteinButtons({ sequenzId }: { sequenzId: string }) {
  const router = useRouter();
  const [aktiv, setAktiv] = useState<BausteinArt | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    thema?: string;
    error?: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  function generieren(art: BausteinArt) {
    setAktiv(art);
    setResult(null);
    startTransition(async () => {
      const res = await generateBaustein(sequenzId, art);
      setResult(res);
      if (res.success) router.refresh();
    });
  }

  function schliessen() {
    if (!isPending) {
      setAktiv(null);
      setResult(null);
    }
  }

  return (
    <>
      {BAUSTEINE.map(({ art, label, icon: Icon }) => (
        <Button
          key={art}
          type="button"
          variant="outline"
          onClick={() => generieren(art)}
          disabled={isPending}
        >
          {isPending && aktiv === art ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
          {label}
        </Button>
      ))}

      <Dialog open={aktiv !== null} onOpenChange={schliessen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {aktiv ? BAUSTEINE.find((b) => b.art === aktiv)?.label : ""}
            </DialogTitle>
          </DialogHeader>

          {isPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Baustein wird generiert — das kann bis zu einer Minute dauern…
              </p>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.success ? (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    «{result.thema}» wurde als neuer Lektionsblock am Ende der
                    Sequenz eingefügt.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">{result.error}</p>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={schliessen}>Schliessen</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
