"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MachineLearningModel } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { InlineLoading } from "@/components/ui/loading";
import { erzeugeEntwuerfe } from "@/app/sequenzen/entwurf-actions";
import { schweizerDatumPlus } from "@/lib/zeit";

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
      const res = await erzeugeEntwuerfe(schweizerDatumPlus(0), schweizerDatumPlus(10));
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
    <div className="flex flex-wrap items-center gap-4">
      <Button variant="outline" size="sm" onClick={starten} disabled={laeuft}>
        Entwürfe für die nächsten 10 Tage
        <MachineLearningModel size={16} />
      </Button>
      {laeuft && <InlineLoading text="Die KI ordnet und formuliert…" />}
      {!laeuft && meldung && <InlineLoading status="finished" text={meldung} />}
    </div>
  );
}
