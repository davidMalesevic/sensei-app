"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PresentationFile } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading } from "@/components/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle px-4 py-3">
      <PresentationFile size={16} className="shrink-0 text-text-secondary" />
      <span className="type-label-02 mr-2 text-text-helper">Slides</span>

      <div className="w-56">
        <Select
          value={materialId}
          onValueChange={(v) => setMaterialId(String(v))}
          items={{
            [KEINE]: "keine Zuordnung",
            ...Object.fromEntries(praesentationen.map((p) => [p.id, p.titel])),
          }}
        >
          <SelectTrigger size="sm" aria-label="Präsentation für diesen Block">
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
      </div>

      <Input
        value={von}
        onChange={(e) => setVon(e.target.value)}
        placeholder="von"
        aria-label="Erste Slide"
        inputMode="numeric"
        className="h-10 w-20"
      />
      <span className="text-text-helper">–</span>
      <Input
        value={bis}
        onChange={(e) => setBis(e.target.value)}
        placeholder="bis"
        aria-label="Letzte Slide"
        inputMode="numeric"
        className="h-10 w-20"
      />

      {veraendert && (
        <Button size="sm" onClick={speichern} disabled={speichert}>
          Sichern
          {speichert && <Loading size={16} />}
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
      <p className="type-body-02 bg-layer p-6 text-text-secondary">
        Noch kein Aufgabenbaum. Er entsteht beim Import des Smartlearn-Exports
        (HTML) zusammen mit dem Modulplan.
      </p>
    );
  }

  const aufgabenGesamt = bloecke
    .flatMap((b) => b.auftraege)
    .flatMap((a) => a.aufgaben)
    .filter((a) => !a.parentId).length;

  return (
    <div>
      <p className="type-helper-02 mb-4 text-text-helper">
        {bloecke.length} Blöcke · {aufgabenGesamt} Aufgaben
      </p>

      <div className="space-y-px">
        {bloecke.map((b) => (
          <div key={b.id} className="bg-layer">
            <div className="flex flex-wrap items-center gap-3 border-b border-border-strong bg-layer-accent px-4 py-3">
              <Badge variant="high-contrast" size="sm">
                Block {b.schluessel}
              </Badge>
              <span className="type-heading-compact-02 min-w-0 flex-1 text-foreground">
                {b.titel}
              </span>
            </div>

            {b.auftraege.map((a) => {
              const oben = a.aufgaben.filter((x) => !x.parentId);
              return (
                <div
                  key={a.id}
                  className="border-b border-border-subtle px-4 py-3 last:border-b-0"
                >
                  <code className="type-helper-02 font-mono text-text-helper">
                    {a.code}
                  </code>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {oben.map((auf) => {
                      const teil = a.aufgaben.filter((t) => t.parentId === auf.id);
                      return (
                        <Badge key={auf.id} variant="cool-gray" size="sm">
                          {auf.bezeichnung}
                          {teil.length > 0 && (
                            <span className="ml-1 opacity-70">+{teil.length}</span>
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
