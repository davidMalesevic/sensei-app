"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { erzeugeEntwuerfe } from "@/app/sequenzen/entwurf-actions";

function datumPlus(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  return d.toISOString().slice(0, 10);
}

/**
 * Manueller Anstoss zusätzlich zum Nachtlauf — wenn der Stundenplan sich
 * ändert oder man am Mittwoch nicht warten will.
 */
export function EntwuerfeButton() {
  const router = useRouter();
  const [laeuft, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  function starten() {
    setMeldung(null);
    startTransition(async () => {
      const res = await erzeugeEntwuerfe(datumPlus(0), datumPlus(10));
      const teile = [`${res.erzeugt} Entwürfe erzeugt`];
      if (res.uebernommen > 0)
        teile.push(`${res.uebernommen} auf Parallelklassen übernommen`);
      if (res.fehler.length > 0)
        teile.push(`${res.fehler.length} übersprungen: ${res.fehler[0].grund}`);
      setMeldung(teile.join(" · "));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={starten} disabled={laeuft}>
        {laeuft ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Entwürfe für die nächsten 10 Tage
      </Button>
      {meldung && (
        <span className="text-sm text-muted-foreground">{meldung}</span>
      )}
    </div>
  );
}
