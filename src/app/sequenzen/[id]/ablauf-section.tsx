"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ListOrdered,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Briefcase,
  Presentation,
  ClipboardList,
  MessagesSquare,
  Flag,
  Circle,
  GripVertical,
  Trash2,
  Plus,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  erzeugeEntwurf,
  bestaetigeAblauf,
  aktualisiereAblaufZeile,
  loescheAblaufZeile,
  sortiereAblauf,
  fuegeAblaufZeileHinzu,
} from "../entwurf-actions";
import { materialHref } from "@/lib/material-link";

export type AblaufZeile = {
  id: string;
  sortierung: number;
  typ: string;
  quelle: string;
  titel: string;
  text: string | null;
  refCode: string | null;
  refAufgabe: string | null;
  refSeiteVon: number | null;
  refSeiteBis: number | null;
  refMaterial: {
    id: string;
    titel: string;
    dateiPfad: string | null;
    url: string | null;
  } | null;
};

const TYP_ICON: Record<string, typeof Circle> = {
  einstieg: Lightbulb,
  praxisbezug: Briefcase,
  theorie: Presentation,
  aufgabe: ClipboardList,
  besprechung: MessagesSquare,
  abschluss: Flag,
  frei: Circle,
};

const TYP_LABEL: Record<string, string> = {
  einstieg: "Einstieg",
  praxisbezug: "Praxisbezug",
  theorie: "Theorie",
  aufgabe: "Aufgabe",
  besprechung: "Besprechung",
  abschluss: "Abschluss",
  frei: "Frei",
};

/** Wächst mit dem Inhalt, damit die Zeile nicht abgeschnitten wirkt. */
function AutoTextarea({
  wert,
  platzhalter,
  onSichern,
  className,
}: {
  wert: string;
  platzhalter: string;
  onSichern: (neu: string) => void;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [lokal, setLokal] = useState(wert);

  useEffect(() => setLokal(wert), [wert]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [lokal]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={lokal}
      placeholder={platzhalter}
      onChange={(e) => setLokal(e.target.value)}
      onBlur={() => {
        if (lokal !== wert) onSichern(lokal);
      }}
      className={`w-full resize-none bg-transparent outline-none rounded px-1 -mx-1 focus:bg-muted/60 ${className ?? ""}`}
    />
  );
}

/**
 * Der Ablauf — bearbeitbar per Direktmanipulation: umordnen per Drag & Drop,
 * Texte an Ort und Stelle ändern, Schritte löschen und ergänzen.
 *
 * Fakten aus dem Material bleiben als solche markiert; ihre Referenz auf
 * LA-Code und Material bleibt auch nach dem Umschreiben erhalten.
 */
export function AblaufSection({
  sequenzId,
  status,
  entwurfAm,
  zeilen,
}: {
  sequenzId: string;
  status: string;
  entwurfAm: Date | null;
  zeilen: AblaufZeile[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(zeilen);
  const [gezogen, setGezogen] = useState<number | null>(null);
  const [ueber, setUeber] = useState<number | null>(null);
  const zeilenRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [neuerTyp, setNeuerTyp] = useState("frei");
  const [rueckfrage, setRueckfrage] = useState(false);
  const [laeuft, startTransition] = useTransition();

  useEffect(() => setItems(zeilen), [zeilen]);

  const bestaetigt = status === "bestaetigt";

  function neuErzeugen() {
    setRueckfrage(false);
    startTransition(async () => {
      await erzeugeEntwurf(sequenzId, { force: true });
      router.refresh();
    });
  }

  /**
   * Neu erzeugen wirft die ganze Bearbeitung weg — Umordnen, umgeschriebene
   * Texte, eigene Schritte. Nur fragen, wenn es auch etwas zu verlieren gibt.
   */
  function neuErzeugenAnfragen() {
    if (items.length === 0) neuErzeugen();
    else setRueckfrage(true);
  }

  function bestaetigen() {
    startTransition(async () => {
      await bestaetigeAblauf(sequenzId);
      router.refresh();
    });
  }

  function sichern(id: string, feld: "titel" | "text", neu: string) {
    setItems((alt) =>
      alt.map((z) => (z.id === id ? { ...z, [feld]: neu } : z))
    );
    startTransition(async () => {
      await aktualisiereAblaufZeile(id, { [feld]: neu });
    });
  }

  function loeschen(id: string) {
    setItems((alt) => alt.filter((z) => z.id !== id));
    startTransition(async () => {
      await loescheAblaufZeile(id);
      router.refresh();
    });
  }

  function hinzufuegen() {
    startTransition(async () => {
      await fuegeAblaufZeileHinzu(
        sequenzId,
        neuerTyp as Parameters<typeof fuegeAblaufZeileHinzu>[1],
        "Neuer Schritt"
      );
      router.refresh();
    });
  }

  /**
   * Umordnen über Pointer-Events statt HTML5-Drag-and-Drop: das funktioniert
   * auch auf Trackpad und Touch und lässt sich testen.
   */
  function zielIndexAus(y: number): number {
    const kanten = zeilenRefs.current
      .filter((el): el is HTMLLIElement => el !== null)
      .map((el) => el.getBoundingClientRect());

    for (let i = 0; i < kanten.length; i++) {
      if (y < kanten[i].top + kanten[i].height / 2) return i;
    }
    return kanten.length - 1;
  }

  function ziehenStarten(index: number, e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setGezogen(index);
    setUeber(index);
  }

  function ziehenBewegen(e: React.PointerEvent) {
    if (gezogen === null) return;
    setUeber(zielIndexAus(e.clientY));
  }

  function ziehenBeenden() {
    const von = gezogen;
    const nach = ueber;
    setGezogen(null);
    setUeber(null);
    if (von === null || nach === null || von === nach) return;

    const neu = [...items];
    const [bewegt] = neu.splice(von, 1);
    neu.splice(nach, 0, bewegt);
    setItems(neu);

    startTransition(async () => {
      await sortiereAblauf(sequenzId, neu.map((z) => z.id));
    });
  }

  return (
    <Card className={bestaetigt ? undefined : "border-primary/40"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ListOrdered className="h-4 w-4" />
          Ablauf
          {items.length > 0 &&
            (bestaetigt ? (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                bestätigt
              </Badge>
            ) : (
              <Badge variant="secondary">Entwurf, ungeprüft</Badge>
            ))}
          {entwurfAm && (
            <span className="text-xs font-normal text-muted-foreground">
              erzeugt {new Date(entwurfAm).toLocaleDateString("de-CH")}
            </span>
          )}
          {laeuft && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Noch kein Ablauf. Der Nachtlauf erzeugt ihn für anstehende
              Sequenzen — hier kannst du ihn sofort anstossen.
            </p>
            <Button onClick={neuErzeugen} disabled={laeuft}>
              <Sparkles className="h-4 w-4" />
              Entwurf erzeugen
            </Button>
          </>
        ) : (
          <>
            <ol
              className="space-y-1.5"
              onPointerMove={ziehenBewegen}
              onPointerUp={ziehenBeenden}
              onPointerCancel={ziehenBeenden}
            >
              {items.map((z, i) => {
                const Icon = TYP_ICON[z.typ] ?? Circle;
                const fakt = z.quelle === "fakt";
                const href = z.refMaterial
                  ? materialHref(
                      z.refMaterial,
                      z.refSeiteVon !== null ? `Slide ${z.refSeiteVon}` : null
                    )
                  : null;

                return (
                  <li
                    key={z.id}
                    ref={(el) => {
                      zeilenRefs.current[i] = el;
                    }}
                    className={`group flex gap-2 rounded-md border px-2 py-2 transition-colors ${
                      ueber === i && gezogen !== i
                        ? "border-primary bg-primary/5"
                        : ""
                    } ${gezogen === i ? "opacity-40" : ""}`}
                  >
                    <span
                      onPointerDown={(e) => ziehenStarten(i, e)}
                      className="flex items-start pt-1 text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
                      title="Zum Umordnen ziehen"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums pt-1.5 w-4 shrink-0">
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-1.5" />

                    <div className="min-w-0 flex-1 space-y-1">
                      <AutoTextarea
                        wert={z.titel}
                        platzhalter="Titel des Schritts"
                        className="text-sm font-medium"
                        onSichern={(neu) => sichern(z.id, "titel", neu)}
                      />
                      <AutoTextarea
                        wert={z.text ?? ""}
                        platzhalter="Notiz (optional)"
                        className="text-sm text-muted-foreground"
                        onSichern={(neu) => sichern(z.id, "text", neu)}
                      />

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant={fakt ? "outline" : "secondary"}
                          className="text-[10px] font-normal"
                        >
                          {fakt ? "aus dem Material" : "KI-Vorschlag"}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {TYP_LABEL[z.typ] ?? z.typ}
                        </span>
                        {z.refCode && (
                          <code className="text-[11px] text-muted-foreground">
                            {z.refCode}
                          </code>
                        )}
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                          >
                            {z.refMaterial?.titel}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Schritt löschen"
                      onClick={() => loeschen(z.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ol>

            {rueckfrage ? (
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm">
                    Die {items.length} Schritte werden ersetzt. Umgeordnetes,
                    umgeschriebene Texte und eigene Schritte gehen verloren.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setRueckfrage(false)}
                    disabled={laeuft}
                  >
                    Abbrechen
                  </Button>
                  <Button onClick={neuErzeugen} disabled={laeuft}>
                    <Sparkles className="h-4 w-4" />
                    Trotzdem neu erzeugen
                  </Button>
                </div>
              </div>
            ) : (
            <div className="flex flex-wrap items-center gap-2 border-t pt-3">
              <Select
                value={neuerTyp}
                onValueChange={(v) => setNeuerTyp(String(v))}
                items={TYP_LABEL}
              >
                <SelectTrigger className="h-9 w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYP_LABEL).map(([wert, label]) => (
                    <SelectItem key={wert} value={wert}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={hinzufuegen} disabled={laeuft}>
                <Plus className="h-4 w-4" />
                Schritt hinzufügen
              </Button>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {!bestaetigt && (
                  <Button onClick={bestaetigen} disabled={laeuft}>
                    <CheckCircle2 className="h-4 w-4" />
                    Passt
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={neuErzeugenAnfragen}
                  disabled={laeuft}
                  title="Verwirft die Bearbeitung und erzeugt den Ablauf neu"
                >
                  <Sparkles className="h-4 w-4" />
                  Neu erzeugen
                </Button>
              </div>
            </div>
            )}
          </>
        )}
      </CardContent>

    </Card>
  );
}
