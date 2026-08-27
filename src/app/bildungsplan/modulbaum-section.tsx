"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Layers, Loader2, Presentation } from "lucide-react";
import { setzeBlockSlides } from "./actions";

const KEINE = "keine";

export type BaumAufgabe = {
  id: string;
  bezeichnung: string;
  parentId: string | null;
};

export type BaumAuftrag = {
  id: string;
  code: string;
  aufgaben: BaumAufgabe[];
};

export type BaumBlock = {
  id: string;
  schluessel: string;
  nummer: number | null;
  titel: string;
  slideMaterialId: string | null;
  slideVon: number | null;
  slideBis: number | null;
  auftraege: BaumAuftrag[];
};

export type PraesentationOption = { id: string; titel: string };

/**
 * Slidezuordnung für einen Block. Nötig nur, wenn eine Präsentation fürs ganze
 * Modul gilt — hängt die Präsentation am Block selbst, ist hier nichts zu tun.
 */
function SlideZuordnung({
  block,
  praesentationen,
}: {
  block: BaumBlock;
  praesentationen: PraesentationOption[];
}) {
  const router = useRouter();
  const [materialId, setMaterialId] = useState(block.slideMaterialId ?? KEINE);
  const [von, setVon] = useState(block.slideVon?.toString() ?? "");
  const [bis, setBis] = useState(block.slideBis?.toString() ?? "");
  const [speichert, startTransition] = useTransition();

  function speichern() {
    startTransition(async () => {
      await setzeBlockSlides(
        block.id,
        materialId === KEINE ? null : materialId,
        von ? Number(von) : null,
        bis ? Number(bis) : null
      );
      router.refresh();
    });
  }

  const veraendert =
    (block.slideMaterialId ?? KEINE) !== materialId ||
    (block.slideVon?.toString() ?? "") !== von ||
    (block.slideBis?.toString() ?? "") !== bis;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Presentation className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <Select
        value={materialId}
        onValueChange={(v) => setMaterialId(String(v))}
        items={{
          [KEINE]: "keine Zuordnung",
          ...Object.fromEntries(praesentationen.map((p) => [p.id, p.titel])),
        }}
      >
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={KEINE}>keine Zuordnung</SelectItem>
          {praesentationen.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.titel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={von}
        onChange={(e) => setVon(e.target.value)}
        placeholder="von"
        inputMode="numeric"
        className="h-8 w-16 text-xs"
      />
      <span className="text-xs text-muted-foreground">–</span>
      <Input
        value={bis}
        onChange={(e) => setBis(e.target.value)}
        placeholder="bis"
        inputMode="numeric"
        className="h-8 w-16 text-xs"
      />
      {veraendert && (
        <Button size="sm" className="h-8" onClick={speichern} disabled={speichert}>
          {speichert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sichern"}
        </Button>
      )}
    </div>
  );
}

export function ModulBaumSection({
  bloecke,
  praesentationen,
}: {
  bloecke: BaumBlock[];
  praesentationen: PraesentationOption[];
}) {
  if (bloecke.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Noch kein Aufgabenbaum. Er entsteht beim Import des Smartlearn-Exports
        (HTML) zusammen mit dem Modulplan.
      </div>
    );
  }

  const aufgabenGesamt = bloecke
    .flatMap((b) => b.auftraege)
    .flatMap((a) => a.aufgaben)
    .filter((a) => !a.parentId).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">
          {bloecke.length} Blöcke · {aufgabenGesamt} Aufgaben
        </span>
      </div>

      <div className="space-y-3">
        {bloecke.map((b) => (
          <div key={b.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Block {b.schluessel}</Badge>
              <span className="text-sm font-medium">{b.titel}</span>
            </div>

            {b.auftraege.map((a) => {
              const oben = a.aufgaben.filter((x) => !x.parentId);
              return (
                <div key={a.id} className="pl-1 space-y-1">
                  <code className="text-xs text-muted-foreground">{a.code}</code>
                  <div className="flex flex-wrap gap-1">
                    {oben.map((auf) => {
                      const teil = a.aufgaben.filter((t) => t.parentId === auf.id);
                      return (
                        <Badge key={auf.id} variant="secondary" className="font-normal">
                          {auf.bezeichnung}
                          {teil.length > 0 && (
                            <span className="text-muted-foreground ml-1">
                              +{teil.length}
                            </span>
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {praesentationen.length > 0 && (
              <SlideZuordnung block={b} praesentationen={praesentationen} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
