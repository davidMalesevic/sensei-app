"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Idea,
  Education,
  ListChecked,
  ChevronDown,
  TrashCan,
} from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import type { SequenzKontext } from "@/lib/kontext";
import { togglePendenz, deletePendenz } from "@/app/klassen/actions";
import { PendenzForm } from "./pendenz-form";

/**
 * Eine Kachel der Kontextleiste. Carbon-Aufbau: kleines Label mit Icon,
 * darunter der Wert. Gibt es Details, wird die ganze Kopfzeile zum Schalter.
 */
function Kachel({
  icon: Icon,
  label,
  wert,
  badge,
  children,
}: {
  icon: typeof Idea;
  label: string;
  wert: string | null;
  badge?: string;
  children?: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const hatDetails = !!children;

  return (
    <div className="min-w-0 bg-layer p-4">
      <button
        type="button"
        onClick={() => hatDetails && setOffen((o) => !o)}
        disabled={!hatDetails}
        aria-expanded={hatDetails ? offen : undefined}
        className={cn(
          "-m-1 w-full p-1 text-left",
          hatDetails
            ? "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
            : "cursor-default"
        )}
      >
        <div className="type-label-02 flex min-w-0 items-center gap-2 text-text-helper">
          <Icon size={16} className="shrink-0" />
          <span className="truncate">{label}</span>
          {badge && (
            <Badge variant="cool-gray" size="sm" className="max-w-40 truncate">
              {badge}
            </Badge>
          )}
          {hatDetails && (
            <ChevronDown
              size={16}
              className={cn(
                "ml-auto shrink-0 text-foreground transition-transform duration-[110ms] ease-carbon-standard",
                offen && "rotate-180"
              )}
            />
          )}
        </div>
        <p
          className={cn(
            "type-body-02 mt-2",
            wert ? "text-foreground" : "text-text-placeholder",
            !offen && "line-clamp-2"
          )}
        >
          {wert ?? "—"}
        </p>
      </button>
      {offen && children && (
        <div className="mt-4 border-t border-border-subtle pt-4">{children}</div>
      )}
    </div>
  );
}

function PendenzenListe({
  klasseId,
  pendenzen,
}: {
  klasseId: string;
  pendenzen: { id: string; text: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      {pendenzen.map((p) => (
        <div
          key={p.id}
          className="group type-body-compact-02 flex items-center gap-3 border-b border-border-subtle py-2"
        >
          <Checkbox
            checked={false}
            disabled={isPending}
            onCheckedChange={() =>
              startTransition(async () => {
                await togglePendenz(p.id, true);
                router.refresh();
              })
            }
          />
          <span className="min-w-0 flex-1">{p.text}</span>
          <Button
            variant="destructive-ghost"
            size="icon-xs"
            aria-label="Pendenz löschen"
            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deletePendenz(p.id);
                router.refresh();
              })
            }
          >
            <TrashCan size={16} />
          </Button>
        </div>
      ))}

      <PendenzForm klasseId={klasseId} className="mt-3" />
    </div>
  );
}

/**
 * Kontextleiste über der Sequenz: Wochenziel aus dem Modulplan, anstehende
 * Beurteilungen und offene Pendenzen der Klasse.
 *
 * **Eine Kachel erscheint nur, wenn sie etwas zu sagen hat.** Vorher standen
 * alle vier bedingungslos da und schrieben bei fehlendem Inhalt ein «—» oder
 * «Keine offenen Pendenzen» hin — vier Kacheln, von denen zwei nichts
 * mitteilten. Die Kalenderwoche steht aus demselben Grund in der Überschrift
 * statt in einer eigenen Kachel: eine zweistellige Zahl braucht keine Fläche.
 *
 * Carbon setzt zusammengehörige Kacheln mit 1px Fuge auf eine dunklere
 * Fläche — dadurch lesen sie sich als ein Paneel, nicht als lose Karten.
 */
export function ContextHeader({
  kontext,
  klasseId,
}: {
  kontext: SequenzKontext;
  klasseId: string;
}) {
  const ziel = kontext.aktuellesZiel ?? kontext.naechstesZiel;
  const zielText = ziel
    ? kontext.aktuellesZiel
      ? ziel.ziel
      : `(noch kein Ziel für KW ${kontext.kw}) Nächstes: KW ${ziel.kw} – ${ziel.ziel}`
    : kontext.modulLabel
      ? "Kein Modulplan hinterlegt"
      : "Kein Modul zugeordnet";

  // Das Wochenziel bleibt immer stehen: fehlt es, ist das keine Leere,
  // sondern ein Befund («Kein Modulplan hinterlegt»).
  const kacheln = [
    <Kachel
      key="ziel"
      icon={Idea}
      label="Wochenziel"
      wert={zielText}
      badge={kontext.modulLabel ?? undefined}
    >
      <div className="space-y-2">
        {ziel?.lbHinweis && (
          <p className="type-heading-02 text-foreground">
            Leistungsbeurteilung: {ziel.lbHinweis}
          </p>
        )}
        {ziel?.beschreibung && (
          <p className="type-body-02 whitespace-pre-wrap text-text-secondary">
            {ziel.beschreibung}
          </p>
        )}
      </div>
    </Kachel>,
  ];

  if (kontext.pruefungen.length > 0) {
    kacheln.push(
      <Kachel
        key="beurteilungen"
        icon={Education}
        label="Beurteilungen"
        badge={String(kontext.pruefungen.length)}
        wert={kontext.pruefungen
          .map((p) => `${p.wann}: ${p.bezeichnung}`)
          .join(" · ")}
      >
        <ul className="space-y-2">
          {kontext.pruefungen.map((p, i) => (
            <li
              key={i}
              className="type-body-02 flex items-start gap-2 text-foreground"
            >
              <Badge variant="purple" size="sm" className="shrink-0">
                {p.wann}
              </Badge>
              <span className="min-w-0 flex-1">{p.bezeichnung}</span>
              <span className="type-helper-02 shrink-0 text-text-helper">
                {p.quelle === "kalender" ? "Kalender" : "Modulplan"}
              </span>
            </li>
          ))}
        </ul>
      </Kachel>
    );
  }

  if (kontext.pendenzen.length > 0) {
    kacheln.push(
      <Kachel
        key="pendenzen"
        icon={ListChecked}
        label="Pendenzen"
        badge={String(kontext.pendenzen.length)}
        wert={kontext.pendenzen.map((p) => p.text).join(" · ")}
      >
        <PendenzenListe klasseId={klasseId} pendenzen={kontext.pendenzen} />
      </Kachel>
    );
  }

  // Die Spalten richten sich nach der Zahl der Kacheln — sonst stünde eine
  // einzelne Kachel als Fünftel-Streifen da.
  const spalten =
    kacheln.length >= 3
      ? "md:grid-cols-2 xl:grid-cols-3"
      : kacheln.length === 2
        ? "md:grid-cols-2"
        : "";

  return (
    <section className="mb-12">
      <SectionHeader titel={`Kontext: KW ${kontext.kw}`} />

      <div className={cn("grid gap-px bg-border-subtle", spalten)}>
        {kacheln}
      </div>
    </section>
  );
}
