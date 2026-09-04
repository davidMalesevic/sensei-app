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
import { setzeAufgabeDauer, zeitenSchaetzen } from "./actions";
import { setzeBlockSlides } from "./actions";

const KEINE = "keine";

export type BaumAufgabe = {
  id: string;
  bezeichnung: string;
  parentId: string | null;
  dauerMinuten: number | null;
  dauerQuelle: string | null;
};

export type BaumAuftrag = {
  id: string;
  code: string;
  aufgaben: BaumAufgabe[];
  /** Nur benutzt, wenn der Auftrag keine nummerierten Aufgaben hat. */
  dauerMinuten: number | null;
  dauerQuelle: string | null;
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

/**
 * Das Minutenfeld einer Aufgabe.
 *
 * Im Smartlearn-Export steht keine Zeitangabe — eine Dauer ist deshalb nie ein
 * Fakt, sondern entweder von der KI geschätzt (`~`) oder hier gesetzt (`✎`).
 * Die Unterscheidung muss sichtbar bleiben, sonst steht eine Schätzung neben
 * LA-Code und Aufgabennummer und sieht aus wie diese.
 *
 * Gesichert wird beim Verlassen des Felds, wie überall sonst auch.
 */
function DauerFeld({
  art,
  id,
  minuten,
  quelle,
  label,
}: {
  art: "aufgabe" | "auftrag" | "block";
  id: string;
  minuten: number | null;
  quelle: string | null;
  label: string;
}) {
  const router = useRouter();
  const [wert, setWert] = useState(minuten?.toString() ?? "");
  const [speichert, startTransition] = useTransition();

  /**
   * Nach einem Schätzlauf kommt ein neuer Wert vom Server. Ohne diesen
   * Abgleich bliebe der lokale Zustand stehen: das Feld zeigte weiter das
   * Alte (oder leer), während in der Datenbank längst etwas anderes steht —
   * genau so sah es nach dem ersten «Zeiten schätzen» aus.
   *
   * Beim Rendern abgeglichen, nicht in einem Effect: `setState` im Effect
   * verbietet die ESLint-Regel `react-hooks/set-state-in-effect`. Dieselbe
   * Lösung wie in `ablauf-section.tsx`.
   */
  const [zuletzt, setZuletzt] = useState(minuten);
  if (minuten !== zuletzt) {
    setZuletzt(minuten);
    setWert(minuten?.toString() ?? "");
  }

  function sichern() {
    const zahl = wert.trim() === "" ? null : Number(wert);
    if ((zahl === null ? null : zahl) === minuten) return;
    startTransition(async () => {
      await setzeAufgabeDauer(art, id, zahl !== null && Number.isFinite(zahl) ? zahl : null);
      router.refresh();
    });
  }

  return (
    <span className="inline-flex shrink-0 items-baseline gap-1">
      <input
        type="text"
        inputMode="numeric"
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        onBlur={sichern}
        aria-label={`Dauer von ${label} in Minuten`}
        placeholder="—"
        className="type-body-compact-02 w-12 border-0 border-b border-border-strong bg-field px-1 py-1 text-right font-mono tabular-nums text-foreground focus:outline-2 focus:-outline-offset-2 focus:outline-border-interactive"
      />
      <span className="type-helper-02 w-8 text-text-helper">
        min
      </span>
      <span
        className="type-helper-02 w-3 text-text-helper"
        title={
          quelle === "person"
            ? "von dir gesetzt — bleibt bei jedem Schätzlauf stehen"
            : quelle === "ki"
              ? "von der KI geschätzt, unbelegt"
              : "keine Angabe"
        }
      >
        {speichert ? "…" : quelle === "person" ? "✎" : quelle === "ki" ? "~" : ""}
      </span>
    </span>
  );
}

export function ModulBaumSection({
  modulId,
  bloecke,
  praesentationen,
}: {
  modulId: string;
  bloecke: BaumBlock[];
  praesentationen: PraesentationOption[];
}) {
  const router = useRouter();
  const [schaetzt, startSchaetzen] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);
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

  // Wie viele Aufgaben tragen überhaupt eine Zeit? Ohne diese Zahl weiss man
  // nicht, ob die Schnittlinie im Ablauf etwas taugt.
  const mitZeit = bloecke
    .flatMap((b) => b.auftraege)
    .flatMap((a): { dauerMinuten: number | null }[] =>
      a.aufgaben.length === 0 ? [a] : a.aufgaben.filter((x) => !x.parentId)
    )
    .filter((x) => x.dauerMinuten !== null).length;

  function schaetzen() {
    setMeldung(null);
    startSchaetzen(async () => {
      const e = await zeitenSchaetzen(modulId);
      setMeldung(
        e.ok
          ? `${e.geschaetzt} geschätzt${e.uebersprungen ? `, ${e.uebersprungen} von dir gesetzte unverändert` : ""}.`
          : (e.fehler ?? "Schätzung fehlgeschlagen.")
      );
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="type-helper-02 text-text-helper">
          {bloecke.length} Blöcke · {aufgabenGesamt} Aufgaben · {mitZeit} mit
          Zeitangabe
        </p>
        <Button
          variant="ghost"
          size="xs"
          onClick={schaetzen}
          disabled={schaetzt}
        >
          Zeiten schätzen
          {schaetzt && <Loading size={16} />}
        </Button>
        {meldung && (
          <span className="type-helper-02 text-text-secondary">{meldung}</span>
        )}
      </div>

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

                  {/* Aufgaben stehen als Zeilen, nicht mehr als Etikettenreihe:
                      jede trägt ihre Minutenzahl, und die braucht ein Feld. */}
                  {oben.length === 0 ? (
                    // Modul ohne nummerierte Aufgaben (z.B. 168): dort ist der
                    // Lern- und Arbeitsauftrag selbst die geplante Einheit.
                    <div className="mt-2 flex items-baseline justify-between gap-4">
                      <span className="type-body-02 text-text-secondary">
                        ganzer Lern- und Arbeitsauftrag
                      </span>
                      <DauerFeld
                        art="auftrag"
                        id={a.id}
                        minuten={a.dauerMinuten}
                        quelle={a.dauerQuelle}
                        label={a.code}
                      />
                    </div>
                  ) : (
                    <div className="mt-2">
                      {oben.map((auf) => {
                        const teil = a.aufgaben.filter((t) => t.parentId === auf.id);
                        return (
                          <div
                            key={auf.id}
                            className="flex items-baseline justify-between gap-4 py-1"
                          >
                            <span className="type-body-02 min-w-0 text-foreground">
                              {auf.bezeichnung}
                              {teil.length > 0 && (
                                <span className="ml-2 text-text-helper">
                                  +{teil.length} Teilaufgaben
                                </span>
                              )}
                            </span>
                            <DauerFeld
                              art="aufgabe"
                              id={auf.id}
                              minuten={auf.dauerMinuten}
                              quelle={auf.dauerQuelle}
                              label={auf.bezeichnung}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
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
