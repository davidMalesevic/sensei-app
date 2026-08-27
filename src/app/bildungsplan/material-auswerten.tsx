"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, ScanText } from "lucide-react";
import { leseModulAusMaterial } from "./actions";

const LESBAR = [".html", ".htm", ".json", ".pdf", ".csv", ".txt", ".md"];

/**
 * Auftrag an Sensei, aus einem hochgeladenen Export Modulplan und
 * Aufgabenbaum zu lesen — direkt dort, wo die Datei schon liegt.
 */
export function MaterialAuswerten({
  materialId,
  dateiPfad,
}: {
  materialId: string;
  dateiPfad: string | null;
}) {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  const lesbar =
    dateiPfad !== null &&
    LESBAR.some((e) => dateiPfad.toLowerCase().endsWith(e));
  if (!lesbar) return null;

  function auswerten() {
    setMeldung(null);
    startTransition(async () => {
      const res = await leseModulAusMaterial(materialId);
      if (!res.ok) {
        setMeldung(res.fehler ?? "Auswertung fehlgeschlagen.");
        return;
      }
      const teile = [`${res.wochenziele} Wochenziele`];
      if (res.bloecke) teile.push(`${res.bloecke} Blöcke, ${res.aufgaben} Aufgaben`);
      if (res.fehler) teile.push(`kein Aufgabenbaum (${res.fehler})`);
      setMeldung(teile.join(" · "));
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        title="Modulplan und Aufgabenbaum aus dieser Datei lesen"
        onClick={auswerten}
        disabled={laeuft}
      >
        {laeuft ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ScanText className="h-3.5 w-3.5" />
        )}
      </Button>
      {meldung && (
        <span className="text-xs text-muted-foreground shrink-0">{meldung}</span>
      )}
    </>
  );
}
