"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MachineLearningModel,
  Printer,
  Renew,
  TrashCan,
} from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InlineLoading } from "@/components/ui/loading";
import { Notification } from "@/components/ui/notification";
import { Markdown } from "@/components/markdown";
import { grafikLabel } from "./einstieg/grafik";
import type { PaketInhalt } from "@/lib/einstieg";
import { arbeiteEinstiegAus, loeschePaket } from "../einstieg-actions";

export type PaketAnzeige = {
  methodeSchluessel: string;
  methodeName: string;
  dauerMinuten: number | null;
  erzeugtAm: Date;
  inhalt: PaketInhalt;
};

/**
 * Der ausgearbeitete Einstieg, direkt unter seinem Schritt im Ablauf.
 *
 * Aufgeklappt steht hier alles, was man zum Halten braucht; zum Austeilen und
 * Projizieren gibt es die eigene Ansicht. Erzeugen ist ein bewusster Klick —
 * die Antwort ist lang, und die meisten Lektionen brauchen sie nicht.
 */
export function EinstiegPaket({
  sequenzId,
  methodeName,
  methodeSchluessel,
  paket,
}: {
  sequenzId: string;
  /** Die Methode am Einstiegsschritt, falls der Generator eine gewählt hat. */
  methodeName: string | null;
  methodeSchluessel: string | null;
  paket: PaketAnzeige | null;
}) {
  const router = useRouter();
  const [laeuft, starte] = useTransition();
  const [fehler, setzeFehler] = useState<string | null>(null);
  const [offen, setzeOffen] = useState(false);

  const veraltet =
    paket !== null &&
    methodeSchluessel !== null &&
    paket.methodeSchluessel !== methodeSchluessel;

  const ausarbeiten = () =>
    starte(async () => {
      setzeFehler(null);
      const r = await arbeiteEinstiegAus(sequenzId);
      if (!r.ok) setzeFehler(r.fehler ?? "Unbekannter Fehler.");
      else {
        setzeOffen(true);
        router.refresh();
      }
    });

  if (!paket) {
    return (
      <div className="border-t border-border-subtle bg-layer-accent px-4 py-3">
        {fehler && (
          <Notification kind="error" titel="Nicht ausgearbeitet" className="mb-3">
            {fehler}
          </Notification>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={ausarbeiten}
            disabled={laeuft || !methodeSchluessel}
            title={
              methodeSchluessel
                ? undefined
                : "Erst den Ablauf neu erzeugen — dann steht hier eine Methode."
            }
          >
            {laeuft ? "Wird ausgearbeitet…" : "Einstieg ausarbeiten"}
            <MachineLearningModel size={16} />
          </Button>
          <span className="type-helper-02 text-text-helper">
            {methodeName
              ? `Erzeugt Ablauf, Arbeitsauftrag und Material zu «${methodeName}». Dauert etwa eine Minute.`
              : "Keine Methode am Einstieg — «Neu erzeugen» wählt eine aus der Bibliothek."}
          </span>
          {laeuft && <InlineLoading text="" />}
        </div>
      </div>
    );
  }

  const i = paket.inhalt;
  // Gitter, Karten und Diagramme stehen in der Ansicht zum Austeilen — hier
  // genügt der Hinweis, dass es sie gibt.
  const grafik = grafikLabel(paket.methodeSchluessel, i.daten_json);
  const fuerLernende = i.materialien.filter((m) => m.fuer !== "lehrperson");
  const fuerLehrperson = i.materialien.filter((m) => m.fuer === "lehrperson");

  return (
    <div className="border-t border-border-subtle bg-layer-accent px-4 py-3">
      {fehler && (
        <Notification kind="error" titel="Nicht ausgearbeitet" className="mb-3">
          {fehler}
        </Notification>
      )}
      {veraltet && (
        <Notification kind="warning" titel="Andere Methode" className="mb-3">
          Das Paket gehört zu «{paket.methodeName}», geplant ist jetzt «
          {methodeName}». Noch einmal ausarbeiten, um es anzugleichen.
        </Notification>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => setzeOffen((o) => !o)}
          className="type-heading-compact-02 text-left underline-offset-2 hover:underline"
          aria-expanded={offen}
        >
          {offen ? "▾" : "▸"} {i.titel}
        </button>
        <Badge variant="teal" size="sm">
          {paket.methodeName}
        </Badge>
        <span className="type-helper-02 text-text-helper">
          {i.dauer_minuten || paket.dauerMinuten} min · {i.sozialform} ·{" "}
          {i.materialien.length} Materialien
          {grafik && ` · ${grafik}`}
        </span>
        <span className="ml-auto flex items-center gap-px">
          <Button
            variant="ghost-neutral"
            size="icon-sm"
            aria-label="Zum Austeilen und Projizieren"
            title="Zum Austeilen und Projizieren"
            render={<Link href={`/sequenzen/${sequenzId}/einstieg`} />}
          >
            <Printer size={16} />
          </Button>
          <Button
            variant="ghost-neutral"
            size="icon-sm"
            aria-label="Neu ausarbeiten"
            title="Neu ausarbeiten"
            onClick={ausarbeiten}
            disabled={laeuft}
          >
            <Renew size={16} />
          </Button>
          <Button
            variant="destructive-ghost"
            size="icon-sm"
            aria-label="Ausarbeitung verwerfen"
            title="Ausarbeitung verwerfen"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                await loeschePaket(sequenzId);
                router.refresh();
              })
            }
          >
            <TrashCan size={16} />
          </Button>
        </span>
      </div>

      {offen && (
        <div className="mt-4 grid gap-6 border-t border-border-subtle pt-4">
          <Feld titel="So läuft das hier">{i.kurzerklaerung}</Feld>
          <Feld titel="Ziel">{i.ziel}</Feld>

          {i.vorbereitung.length > 0 && (
            <Feld titel="Vorbereitung">
              <ul className="list-disc space-y-1 pl-5">
                {i.vorbereitung.map((v, n) => (
                  <li key={n}>{v}</li>
                ))}
              </ul>
            </Feld>
          )}

          <Feld titel="Ablauf">
            <ol className="grid gap-px bg-border-subtle">
              {i.ablauf.map((s) => (
                <li key={s.schritt} className="bg-layer p-3">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="type-heading-compact-02">
                      {s.schritt}. {s.titel}
                    </span>
                    <Badge variant="cool-gray" size="sm">
                      {s.sozialform}
                    </Badge>
                    <span className="type-helper-02 text-text-helper tabular-nums">
                      {s.dauer_minuten} min
                    </span>
                  </div>
                  <p className="type-body-compact-02 mt-1">
                    <span className="text-text-helper">Lehrperson: </span>
                    {s.lehrperson}
                  </p>
                  <p className="type-body-compact-02">
                    <span className="text-text-helper">Lernende: </span>
                    {s.lernende}
                  </p>
                </li>
              ))}
            </ol>
          </Feld>

          <Feld titel="Arbeitsauftrag an die Klasse">
            <Markdown text={i.arbeitsauftrag} className="bg-layer p-3" />
          </Feld>

          {fuerLernende.length > 0 && (
            <Feld titel={`Material für die Lernenden (${fuerLernende.length})`}>
              <MaterialListe materialien={fuerLernende} />
            </Feld>
          )}
          {fuerLehrperson.length > 0 && (
            <Feld titel={`Nur für dich (${fuerLehrperson.length})`}>
              <MaterialListe materialien={fuerLehrperson} />
            </Feld>
          )}

          <Feld titel="Was zu erwarten ist">{i.erwartungshorizont}</Feld>
          <Feld titel="Differenzierung">{i.differenzierung}</Feld>
          <Feld titel="Anschluss">{i.anschluss}</Feld>

          {grafik && (
            <p className="type-helper-02 text-text-helper">
              Dazu gehört: {grafik} — zu sehen in der Ansicht zum Austeilen.
            </p>
          )}

          <p className="type-helper-02 text-text-helper">
            Von der KI erzeugt am{" "}
            {new Date(paket.erzeugtAm).toLocaleString("de-CH", {
              timeZone: "Europe/Zurich",
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            — durchlesen, bevor du damit vor die Klasse trittst.
          </p>
        </div>
      )}
    </div>
  );
}

function Feld({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="type-label-02 mb-1 text-text-helper">{titel}</h4>
      <div className="type-body-02">{children}</div>
    </section>
  );
}

function MaterialListe({ materialien }: { materialien: PaketInhalt["materialien"] }) {
  return (
    <ul className="grid gap-px bg-border-subtle">
      {materialien.map((m) => (
        <li key={m.id} className="bg-layer p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="type-heading-compact-02">{m.titel}</span>
            <Badge variant="ghost" size="sm">
              {m.typ}
            </Badge>
          </div>
          {m.verwendung && (
            <p className="type-helper-02 mt-1 text-text-helper">{m.verwendung}</p>
          )}
          <Markdown text={m.inhalt} className="mt-2 bg-background p-3" />
        </li>
      ))}
    </ul>
  );
}
