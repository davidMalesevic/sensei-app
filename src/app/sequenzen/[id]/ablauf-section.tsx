"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Idea,
  Enterprise,
  PresentationFile,
  ListChecked,
  Chat,
  Flag,
  CircleDash,
  Draggable,
  TrashCan,
  Add,
  Checkmark,
  Launch,
  MachineLearningModel,
} from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineLoading } from "@/components/ui/loading";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
  dauerMinuten: number | null;
  dauerQuelle: string | null;
  /** Gesetzt, wenn dieser Fakt aus einer früheren Woche liegengeblieben ist. */
  rueckstandKw: number | null;
  refMaterial: {
    id: string;
    titel: string;
    dateiPfad: string | null;
    url: string | null;
  } | null;
};

const TYP_ICON: Record<string, typeof CircleDash> = {
  einstieg: Idea,
  praxisbezug: Enterprise,
  theorie: PresentationFile,
  aufgabe: ListChecked,
  besprechung: Chat,
  abschluss: Flag,
  frei: CircleDash,
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
  ariaLabel,
}: {
  wert: string;
  platzhalter: string;
  onSichern: (neu: string) => void;
  className?: string;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [lokal, setLokal] = useState(wert);
  const [zuletztGesehen, setZuletztGesehen] = useState(wert);

  // Ändert der Server den Wert (etwa nach «neu erzeugen»), übernehmen wir ihn.
  // Anpassung während des Renderns statt im Effect — sonst rendert React zweimal.
  if (wert !== zuletztGesehen) {
    setZuletztGesehen(wert);
    setLokal(wert);
  }

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
      aria-label={ariaLabel}
      placeholder={platzhalter}
      onChange={(e) => setLokal(e.target.value)}
      onBlur={() => {
        if (lokal !== wert) onSichern(lokal);
      }}
      className={cn(
        "-mx-2 w-full resize-none bg-transparent px-2 py-0.5 outline-none",
        "placeholder:text-text-placeholder",
        "transition-colors duration-[110ms] ease-carbon-standard",
        "hover:bg-layer-hover",
        "focus:bg-field focus:outline-2 focus:-outline-offset-2 focus:outline-[var(--ring)]",
        className
      )}
    />
  );
}

/**
 * Der Ablauf — bearbeitbar per Direktmanipulation: umordnen per Ziehen,
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
  lektionen,
}: {
  sequenzId: string;
  status: string;
  entwurfAm: Date | null;
  zeilen: AblaufZeile[];
  /** Für das Zeitbudget: eine Lektion sind 45 Minuten. */
  lektionen: number | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(zeilen);
  const [gezogen, setGezogen] = useState<number | null>(null);
  const [ueber, setUeber] = useState<number | null>(null);
  const zeilenRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [neuerTyp, setNeuerTyp] = useState("frei");
  const [rueckfrage, setRueckfrage] = useState(false);
  const [laeuft, startTransition] = useTransition();
  const [zuletztGeladen, setZuletztGeladen] = useState(zeilen);

  // Nach einem router.refresh() kommen neue Zeilen vom Server.
  if (zeilen !== zuletztGeladen) {
    setZuletztGeladen(zeilen);
    setItems(zeilen);
  }

  const bestaetigt = status === "bestaetigt";

  /**
   * Das Zeitbudget. Jeder Schritt trägt Minuten — Fakten geerbt aus dem
   * Modulbaum, KI-Vorschläge von der KI —, also ist die Summe das Budget und
   * die Schnittlinie fällt dort, wo die Lektion voll ist.
   *
   * Gerechnet wird beim Rendern, nicht gespeichert: nach dem ersten Umordnen
   * wäre eine gespeicherte Schnittlinie falsch.
   */
  const budget = lektionen !== null ? lektionen * 45 : null;
  let laufend = 0;
  const kumuliert = items.map((z) => {
    laufend += z.dauerMinuten ?? 0;
    return laufend;
  });
  const geplant = laufend;
  const ohneAngabe = items.filter((z) => z.dauerMinuten === null).length;
  // Die erste Zeile, die über das Budget hinausragt. Nur aussagekräftig, wenn
  // jede Zeile eine Dauer trägt — sonst behauptete die Linie eine Genauigkeit,
  // die die Daten nicht hergeben.
  const schnittBei =
    budget !== null && ohneAngabe === 0
      ? kumuliert.findIndex((k) => k > budget)
      : -1;

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

  /**
   * Die Minutenzahl dieser einen Zeile. Leeres Feld heisst «keine Angabe» —
   * das ist eine gültige Aussage, keine Null: eine Aufgabe ohne gepflegte
   * Dauer soll das Budget nicht scheinbar füllen.
   */
  function dauerSichern(id: string, roh: string) {
    const wert = roh.trim() === "" ? null : Number(roh);
    const minuten = wert !== null && Number.isFinite(wert) ? wert : null;
    setItems((alt) =>
      alt.map((z) =>
        z.id === id
          ? { ...z, dauerMinuten: minuten, dauerQuelle: minuten === null ? null : "person" }
          : z
      )
    );
    startTransition(async () => {
      await aktualisiereAblaufZeile(id, { dauerMinuten: minuten });
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
    <section className="mb-12">
      <SectionHeader
        titel="Ablauf"
        beschreibung={
          entwurfAm
            ? `Erzeugt am ${new Date(entwurfAm).toLocaleDateString("de-CH")}`
            : undefined
        }
        aktionen={
          <div className="flex items-center gap-4">
            {laeuft && <InlineLoading />}
            {items.length > 0 &&
              (bestaetigt ? (
                <Badge variant="green">
                  <Checkmark size={16} />
                  bestätigt
                </Badge>
              ) : (
                <Badge variant="blue">Entwurf, ungeprüft</Badge>
              ))}
          </div>
        }
      />

      {items.length === 0 ? (
        <div className="bg-layer p-6">
          <p className="type-body-02 mb-6 max-w-2xl text-text-secondary">
            Noch kein Ablauf. Der Nachtlauf erzeugt ihn für anstehende
            Sequenzen — hier kannst du ihn sofort anstossen.
          </p>
          <Button onClick={neuErzeugen} disabled={laeuft}>
            Entwurf erzeugen
            <MachineLearningModel size={16} />
          </Button>
        </div>
      ) : (
        <>
          {budget !== null && items.length > 0 && (
            <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-l-[3px] border-l-border-subtle bg-layer px-4 py-3">
              <span className="type-body-compact-02 text-text-secondary">
                Geplant{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {geplant} min
                </span>{" "}
                · verfügbar{" "}
                <span className="font-mono tabular-nums text-foreground">
                  {budget} min
                </span>
              </span>
              {ohneAngabe > 0 ? (
                // Lieber schweigen als eine Summe behaupten, die nicht stimmt.
                <span className="type-helper-02 text-text-helper">
                  + {ohneAngabe} {ohneAngabe === 1 ? "Schritt" : "Schritte"} ohne
                  Zeitangabe — Summe unvollständig
                </span>
              ) : geplant > budget ? (
                <Badge variant="blue" size="sm">
                  {geplant - budget} min über
                </Badge>
              ) : (
                <span className="type-helper-02 text-text-helper">
                  {budget - geplant} min Reserve
                </span>
              )}
            </div>
          )}

          <ol
            className="bg-layer"
            onPointerMove={ziehenBewegen}
            onPointerUp={ziehenBeenden}
            onPointerCancel={ziehenBeenden}
          >
            {items.map((z, i) => {
              const Icon = TYP_ICON[z.typ] ?? CircleDash;
              // Ab hier reicht die Lektion nicht mehr. Kein Fehler, sondern
              // eine Auskunft: was darunter steht, wird voraussichtlich
              // Rückstand — die Lehrperson entscheidet, wo sie abbricht.
              const schnitt = i === schnittBei;
              const fakt = z.quelle === "fakt";
              const href = z.refMaterial
                ? materialHref(
                    z.refMaterial,
                    z.refSeiteVon !== null ? `Slide ${z.refSeiteVon}` : null
                  )
                : null;

              return (
                <Fragment key={z.id}>
                {schnitt && (
                  <li
                    aria-hidden
                    className="flex items-center gap-3 px-4 py-2 select-none"
                  >
                    <span className="h-px flex-1 bg-border-interactive" />
                    <span className="type-helper-02 whitespace-nowrap text-text-helper">
                      ab hier reicht die Zeit voraussichtlich nicht
                    </span>
                    <span className="h-px flex-1 bg-border-interactive" />
                  </li>
                )}
                <li
                  ref={(el) => {
                    zeilenRefs.current[i] = el;
                  }}
                  className={cn(
                    "group flex gap-3 border-b border-border-subtle px-4 py-3 transition-colors duration-[110ms] ease-carbon-standard last:border-b-0",
                    // Fakten tragen links einen blauen Balken — sie stammen
                    // aus dem Material und sind nicht verhandelbar.
                    fakt && "border-l-[3px] border-l-border-interactive pl-[13px]",
                    ueber === i && gezogen !== i && "bg-layer-hover shadow-[inset_0_2px_0_0_var(--border-interactive)]",
                    gezogen === i && "opacity-40"
                  )}
                >
                  <span
                    onPointerDown={(e) => ziehenStarten(i, e)}
                    role="button"
                    tabIndex={-1}
                    aria-label="Zum Umordnen ziehen"
                    title="Zum Umordnen ziehen"
                    className="mt-0.5 flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center text-text-helper transition-colors hover:text-foreground active:cursor-grabbing"
                  >
                    <Draggable size={16} />
                  </span>

                  <span className="type-body-compact-02 mt-1 w-6 shrink-0 text-right font-mono tabular-nums text-text-helper">
                    {i + 1}
                  </span>

                  <Icon size={16} className="mt-1.5 shrink-0 text-text-secondary" />

                  <div className="min-w-0 flex-1">
                    {/* Der LA-Code steht über dem Titel — dieselbe Ordnung wie
                        in «Stoff dieser Woche» und im Übertrag: erst woher die
                        Aufgabe stammt, dann welche es ist. Unten in der
                        Etikettenzeile war er weit weg von der Nummer, auf die
                        er sich bezieht. */}
                    {z.refCode && (
                      <code className="type-helper-02 mb-1 block font-mono text-text-helper">
                        {z.refCode}
                      </code>
                    )}
                    <AutoTextarea
                      wert={z.titel}
                      ariaLabel={`Titel von Schritt ${i + 1}`}
                      platzhalter="Titel des Schritts"
                      className="type-heading-compact-02 text-foreground"
                      onSichern={(neu) => sichern(z.id, "titel", neu)}
                    />
                    <AutoTextarea
                      wert={z.text ?? ""}
                      ariaLabel={`Notiz zu Schritt ${i + 1}`}
                      platzhalter="Notiz (optional)"
                      className="type-body-02 mt-1 text-text-secondary"
                      onSichern={(neu) => sichern(z.id, "text", neu)}
                    />

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant={fakt ? "blue" : "purple"} size="sm">
                        {fakt ? "aus dem Material" : "KI-Vorschlag"}
                      </Badge>
                      <Badge variant="ghost" size="sm">
                        {TYP_LABEL[z.typ] ?? z.typ}
                      </Badge>
                      {/* Liegengebliebenes muss man erkennen: es steht zwar
                          vorn, sieht sonst aber aus wie neuer Stoff. */}
                      {z.rueckstandKw !== null && (
                        <Badge variant="blue" size="sm">
                          Rückstand KW {z.rueckstandKw}
                        </Badge>
                      )}
                      {/* Minuten: die einzige Zahl im Ablauf, die geschätzt
                          ist. `~` sagt, dass sie von der KI stammt, `✎` dass
                          jemand sie gesetzt hat — sonst stünde eine Schätzung
                          neben LA-Code und Slidenummer und sähe aus wie die. */}
                      <span className="inline-flex items-baseline gap-1">
                        <input
                          type="text"
                          inputMode="numeric"
                          // Der Server begrenzt die Zahl (1–300). Ohne den
                          // Schlüssel bliebe ein unkontrolliertes Feld auf dem
                          // Getippten stehen und zeigte etwas anderes an, als
                          // gespeichert ist.
                          key={z.dauerMinuten ?? "leer"}
                          defaultValue={z.dauerMinuten ?? ""}
                          onBlur={(e) => dauerSichern(z.id, e.target.value)}
                          aria-label={`Dauer von Schritt ${i + 1} in Minuten`}
                          placeholder="—"
                          className="type-helper-02 w-10 border-0 border-b border-border-strong bg-field px-1 py-0.5 text-right font-mono tabular-nums text-foreground focus:outline-2 focus:-outline-offset-2 focus:outline-border-interactive"
                        />
                        <span className="type-helper-02 text-text-helper">
                          min
                          {z.dauerQuelle === "ki" && " ~"}
                          {z.dauerQuelle === "person" && " ✎"}
                        </span>
                      </span>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="type-helper-02 inline-flex items-center gap-1 text-link underline-offset-2 hover:underline"
                        >
                          {z.refMaterial?.titel}
                          <Launch size={16} />
                        </a>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="destructive-ghost"
                    size="icon-sm"
                    className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Schritt ${i + 1} löschen`}
                    title="Schritt löschen"
                    onClick={() => loeschen(z.id)}
                  >
                    <TrashCan size={16} />
                  </Button>
                </li>
                </Fragment>
              );
            })}
          </ol>

          {rueckfrage ? (
            <div className="mt-4">
              <Notification kind="warning" titel="Die Bearbeitung geht verloren">
                Die {items.length} Schritte werden ersetzt. Umgeordnetes,
                umgeschriebene Texte und eigene Schritte sind danach weg.
              </Notification>
              <div className="mt-px flex flex-wrap gap-px">
                <Button
                  variant="secondary"
                  onClick={() => setRueckfrage(false)}
                  disabled={laeuft}
                >
                  Abbrechen
                </Button>
                <Button variant="destructive" onClick={neuErzeugen} disabled={laeuft}>
                  Trotzdem neu erzeugen
                  <MachineLearningModel size={16} />
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-stretch">
                <Select
                  value={neuerTyp}
                  onValueChange={(v) => setNeuerTyp(String(v))}
                  items={TYP_LABEL}
                >
                  <SelectTrigger className="w-40" aria-label="Art des Schritts">
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
                <Button
                  variant="outline"
                  onClick={hinzufuegen}
                  disabled={laeuft}
                  className="shrink-0"
                >
                  Schritt hinzufügen
                  <Add size={16} />
                </Button>
              </div>

              <div className="ml-auto flex flex-wrap gap-px">
                <Button
                  variant="secondary"
                  onClick={neuErzeugenAnfragen}
                  disabled={laeuft}
                  title="Verwirft die Bearbeitung und erzeugt den Ablauf neu"
                >
                  Neu erzeugen
                  <MachineLearningModel size={16} />
                </Button>
                {!bestaetigt && (
                  <Button onClick={bestaetigen} disabled={laeuft}>
                    Passt
                    <Checkmark size={16} />
                  </Button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
