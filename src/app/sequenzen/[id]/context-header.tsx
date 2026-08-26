"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CalendarRange,
  Target,
  ArrowLeftRight,
  ListTodo,
  ChevronDown,
  Plus,
  Trash2,
  GraduationCap,
} from "lucide-react";
import type { SequenzKontext } from "@/lib/kontext";
import {
  createPendenz,
  togglePendenz,
  deletePendenz,
} from "@/app/klassen/actions";

const KW_QUELLE_HINWEIS: Record<SequenzKontext["kwQuelle"], string> = {
  sequenz: "aus Sequenz-Startdatum",
  block: "aus erstem Lektionsblock",
  heute: "aktuelle Woche (kein Datum gesetzt)",
};

function Abschnitt({
  icon: Icon,
  label,
  wert,
  badge,
  children,
}: {
  icon: typeof Target;
  label: string;
  wert: string | null;
  badge?: string;
  children?: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const hatDetails = !!children;

  return (
    <div className="flex-1 min-w-[200px]">
      <button
        type="button"
        onClick={() => hatDetails && setOffen((o) => !o)}
        disabled={!hatDetails}
        className={`w-full text-left ${hatDetails ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <Icon className="h-3.5 w-3.5" />
          {label}
          {badge && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {badge}
            </Badge>
          )}
          {hatDetails && (
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${offen ? "rotate-180" : ""}`}
            />
          )}
        </div>
        <p
          className={`text-sm mt-0.5 ${wert ? "" : "text-muted-foreground italic"} ${offen ? "" : "line-clamp-2"}`}
        >
          {wert ?? "—"}
        </p>
      </button>
      {offen && children && <div className="mt-2">{children}</div>}
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
  const [neu, setNeu] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      {pendenzen.map((p) => (
        <div key={p.id} className="flex items-center gap-2 group text-sm">
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
          <span className="flex-1 min-w-0">{p.text}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await deletePendenz(p.id);
                router.refresh();
              })
            }
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}

      <form
        action={async (formData) => {
          await createPendenz(formData);
          setNeu("");
          router.refresh();
        }}
        className="flex gap-1.5"
      >
        <input type="hidden" name="klasseId" value={klasseId} />
        <Input
          name="text"
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          placeholder="Neue Pendenz…"
          className="h-8 text-sm"
          required
        />
        <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

/**
 * Kompakte Kontextleiste über der Sequenz: Wochenziel aus dem Modulplan,
 * Übergabenotiz der Vorsequenz und offene Pendenzen der Klasse.
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

  return (
    <div className="rounded-lg border bg-muted/40 p-4">
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <div className="shrink-0">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <CalendarRange className="h-3.5 w-3.5" />
            Woche
          </div>
          <p className="text-2xl font-bold leading-tight">KW {kontext.kw}</p>
          <p className="text-[11px] text-muted-foreground">
            {KW_QUELLE_HINWEIS[kontext.kwQuelle]}
          </p>
        </div>

        <Abschnitt
          icon={Target}
          label="Wochenziel"
          wert={zielText}
          badge={kontext.modulLabel ?? undefined}
        >
          <div className="space-y-1">
            {ziel?.lbHinweis && (
              <p className="text-sm font-medium">
                Leistungsbeurteilung: {ziel.lbHinweis}
              </p>
            )}
            {ziel?.beschreibung && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {ziel.beschreibung}
              </p>
            )}
          </div>
        </Abschnitt>

        <Abschnitt
          icon={GraduationCap}
          label="Beurteilungen"
          badge={
            kontext.pruefungen.length > 0
              ? String(kontext.pruefungen.length)
              : undefined
          }
          wert={
            kontext.pruefungen.length > 0
              ? kontext.pruefungen
                  .map((p) => `${p.wann}: ${p.bezeichnung}`)
                  .join(" · ")
              : "Keine anstehenden Beurteilungen"
          }
        >
          {kontext.pruefungen.length > 0 && (
            <ul className="space-y-1">
              {kontext.pruefungen.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {p.wann}
                  </Badge>
                  <span className="flex-1 min-w-0">{p.bezeichnung}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {p.quelle === "kalender" ? "Kalender" : "Modulplan"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Abschnitt>

        <Abschnitt
          icon={ArrowLeftRight}
          label="Übergabe"
          wert={
            kontext.vorherigeNotiz
              ? `«${kontext.vorherigeNotiz.titel}»: ${kontext.vorherigeNotiz.notiz}`
              : null
          }
        >
          {kontext.vorherigeNotiz && (
            <p className="text-sm whitespace-pre-wrap">
              {kontext.vorherigeNotiz.notiz}
            </p>
          )}
        </Abschnitt>

        <Abschnitt
          icon={ListTodo}
          label="Pendenzen"
          badge={
            kontext.pendenzen.length > 0
              ? String(kontext.pendenzen.length)
              : undefined
          }
          wert={
            kontext.pendenzen.length > 0
              ? kontext.pendenzen.map((p) => p.text).join(" · ")
              : "Keine offenen Pendenzen"
          }
        >
          <PendenzenListe klasseId={klasseId} pendenzen={kontext.pendenzen} />
        </Abschnitt>
      </div>
    </div>
  );
}
