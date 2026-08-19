"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Loader2 } from "lucide-react";
import { importLektionsbloecke } from "../actions";

export function ImportDialog({ sequenzId }: { sequenzId: string }) {
  const [open, setOpen] = useState(false);
  const [jsonInput, setJsonInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleImport() {
    setError(null);
    startTransition(async () => {
      const result = await importLektionsbloecke(sequenzId, jsonInput);
      if (result.success) {
        setJsonInput("");
        setOpen(false);
      } else {
        setError(result.error ?? "Import fehlgeschlagen.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="h-4 w-4" />
        Importieren
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Lektionsblöcke importieren</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Füge den JSON-Output aus der KI-Planung hier ein. Das JSON kann in
          Markdown-Code-Blöcken (<code>```json</code>) eingebettet sein.
        </p>
        <Textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={'{\n  "lektionsbloecke": [\n    ...\n  ]\n}'}
          className="flex-1 min-h-[300px] font-mono text-xs resize-none"
        />
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleImport}
            disabled={!jsonInput.trim() || isPending}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
