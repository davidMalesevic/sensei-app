"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Herkunft } from "@/lib/methoden";
import {
  HerkunftTag,
  SchwerpunktTag,
  SozialformTags,
  dauerText,
} from "./anzeige";
import { MethodeSchalter } from "./methode-schalter";

export type MethodenZeile = {
  id: string;
  schluessel: string;
  name: string;
  kategorie: string;
  sozialform: string[];
  dauerMin: number;
  dauerMax: number;
  schwerpunkt: string;
  kurzbeschreibung: string;
  herkunft: Herkunft;
  ausgeschaltet: boolean;
  mitDaten: boolean;
};

const ALLE = "alle";

const STATUS = {
  [ALLE]: "Alle Methoden",
  an: "Nur eingeschaltete",
  aus: "Nur ausgeschaltete",
  angepasst: "Angepasst oder eigene",
};

/**
 * 62 Methoden sind wenig genug, um im Browser zu filtern — kein Umweg über
 * die URL, keine Wartezeit beim Tippen.
 */
export function MethodenListe({
  methoden,
  kategorien,
  sozialformen,
  schwerpunkte,
}: {
  methoden: MethodenZeile[];
  kategorien: { id: string; name: string }[];
  sozialformen: Record<string, string>;
  schwerpunkte: Record<string, string>;
}) {
  const [suche, setSuche] = useState("");
  const [kategorie, setKategorie] = useState(ALLE);
  const [sozialform, setSozialform] = useState(ALLE);
  const [schwerpunkt, setSchwerpunkt] = useState(ALLE);
  const [status, setStatus] = useState(ALLE);

  const gefiltert = useMemo(() => {
    const s = suche.trim().toLowerCase();
    return methoden.filter(
      (m) =>
        (!s ||
          m.name.toLowerCase().includes(s) ||
          m.kurzbeschreibung.toLowerCase().includes(s)) &&
        (kategorie === ALLE || m.kategorie === kategorie) &&
        (sozialform === ALLE || m.sozialform.includes(sozialform)) &&
        (schwerpunkt === ALLE || m.schwerpunkt === schwerpunkt) &&
        (status === ALLE ||
          (status === "an" && !m.ausgeschaltet) ||
          (status === "aus" && m.ausgeschaltet) ||
          (status === "angepasst" && m.herkunft !== "geteilt"))
    );
  }, [methoden, suche, kategorie, sozialform, schwerpunkt, status]);

  const eingeschaltet = methoden.filter((m) => !m.ausgeschaltet).length;

  const kategorieItems = {
    [ALLE]: "Alle Kategorien",
    ...Object.fromEntries(kategorien.map((k) => [k.id, k.name])),
  };
  const sozialformItems = {
    [ALLE]: "Alle Sozialformen",
    ...sozialformen,
  };
  const schwerpunktItems = {
    [ALLE]: "Alle Schwerpunkte",
    ...Object.fromEntries(Object.keys(schwerpunkte).map((k) => [k, k])),
  };

  // Nach Kategorie gruppiert, in der Reihenfolge der Bibliothek. Eigene
  // Methoden mit einer Kategorie, die es nicht mehr gibt, landen am Schluss.
  const gruppen = [
    ...kategorien.map((k) => ({
      id: k.id,
      name: k.name,
      zeilen: gefiltert.filter((m) => m.kategorie === k.id),
    })),
    {
      id: "_sonstige",
      name: "Ohne Kategorie",
      zeilen: gefiltert.filter(
        (m) => !kategorien.some((k) => k.id === m.kategorie)
      ),
    },
  ].filter((g) => g.zeilen.length > 0);

  return (
    <>
      <div className="mb-8 grid gap-px bg-border-subtle sm:grid-cols-2 xl:grid-cols-5">
        <div className="relative bg-background xl:col-span-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-secondary"
          />
          <Input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder="Methode suchen"
            aria-label="Methode suchen"
            className="pl-11"
          />
        </div>
        <Filter wert={kategorie} setze={setKategorie} items={kategorieItems} label="Kategorie" />
        <Filter wert={sozialform} setze={setSozialform} items={sozialformItems} label="Sozialform" />
        <Filter wert={schwerpunkt} setze={setSchwerpunkt} items={schwerpunktItems} label="Schwerpunkt" />
        <Filter wert={status} setze={setStatus} items={STATUS} label="Status" />
      </div>

      <p className="type-helper-02 mb-6 text-text-helper">
        {gefiltert.length} von {methoden.length} Methoden · {eingeschaltet}{" "}
        in der Planung eingeschaltet
      </p>

      {gruppen.length === 0 && (
        <div className="type-body-02 bg-layer p-8 text-text-secondary">
          Keine Methode passt zu diesen Filtern.
        </div>
      )}

      {gruppen.map((g) => (
        <section key={g.id} className="mb-10">
          <h2 className="type-heading-03 mb-4 border-b border-border-subtle pb-2">
            {g.name}{" "}
            <span className="type-body-02 text-text-helper">
              {g.zeilen.length}
            </span>
          </h2>
          <ul className="bg-layer">
            {g.zeilen.map((m) => (
              <li
                key={m.id}
                className={
                  "flex items-start gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0 hover:bg-layer-hover" +
                  (m.ausgeschaltet ? " text-text-secondary" : "")
                }
              >
                <div className="pt-1">
                  <MethodeSchalter
                    schluessel={m.schluessel}
                    name={m.name}
                    an={!m.ausgeschaltet}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/methoden/${m.id}`}
                      className="type-heading-compact-02 underline-offset-2 hover:text-link hover:underline"
                    >
                      {m.name}
                    </Link>
                    <HerkunftTag herkunft={m.herkunft} />
                    {m.mitDaten && (
                      <Badge variant="outline" size="sm" title="Liefert Daten für eine Grafik oder Karten">
                        mit Grafik
                      </Badge>
                    )}
                  </div>
                  <p className="type-body-compact-02 mt-1 line-clamp-2 text-text-secondary">
                    {m.kurzbeschreibung}
                  </p>
                </div>
                <div className="hidden shrink-0 items-center gap-3 md:flex">
                  <SozialformTags sozialform={m.sozialform} namen={sozialformen} />
                  <span className="type-body-compact-02 w-20 text-right text-text-secondary tabular-nums">
                    {dauerText(m)}
                  </span>
                  <span className="w-24">
                    <SchwerpunktTag
                      schwerpunkt={m.schwerpunkt}
                      label={schwerpunkte[m.schwerpunkt]}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function Filter({
  wert,
  setze,
  items,
  label,
}: {
  wert: string;
  setze: (v: string) => void;
  items: Record<string, string>;
  label: string;
}) {
  return (
    <div className="bg-background">
      <Select value={wert} onValueChange={(v) => setze(String(v))} items={items}>
        <SelectTrigger aria-label={label} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([k, v]) => (
            <SelectItem key={k} value={k}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
