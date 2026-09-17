"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Add, Checkmark, TrashCan } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { HelperText, Label } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { MethodenParameter } from "@/db/schema";
import {
  parameterWerte,
  pruefeAnweisung,
  rendereVorlage,
} from "@/lib/methoden-vorlage";
import { methodeSpeichern, type MethodenZustand } from "./actions";

export type MethodeFormWerte = {
  id?: string;
  name: string;
  kategorie: string;
  sozialform: string[];
  dauerMin: number;
  dauerMax: number;
  dauerStandard: number;
  schwerpunkt: string;
  kurzbeschreibung: string;
  material: string[];
  parameter: MethodenParameter[];
  anweisung: string;
};

const LEER: MethodeFormWerte = {
  name: "",
  kategorie: "",
  sozialform: [],
  dauerMin: 5,
  dauerMax: 15,
  dauerStandard: 10,
  schwerpunkt: "aktivieren",
  kurzbeschreibung: "",
  material: [],
  parameter: [],
  anweisung: "",
};

const NEUER_PARAMETER: MethodenParameter = {
  name: "",
  typ: "integer",
  default: 3,
  min: 1,
  max: 10,
  beschreibung: "",
};

/**
 * Sozialform und Parameter reisen als JSON in verborgenen Feldern mit — eine
 * Liste variabler Länge lässt sich über FormData sonst nur mühsam einsammeln.
 *
 * `ziel` entscheidet, wohin gespeichert wird: «eigene» legt bei einer
 * geteilten Methode eine eigene Fassung an, «geteilt» ändert sie für alle
 * (nur Admins). Die Server Action prüft beides noch einmal selbst.
 */
export function MethodeForm({
  werte = LEER,
  kategorien,
  sozialformen,
  schwerpunkte,
  /** Die Vorlage ist geteilt und ich darf sie für alle ändern. */
  darfGeteilt = false,
  /** Gespeichert wird als eigene Fassung dieser geteilten Methode. */
  alsFassungVon,
  abbrechenHref,
}: {
  werte?: MethodeFormWerte;
  kategorien: { id: string; name: string }[];
  sozialformen: Record<string, string>;
  schwerpunkte: Record<string, string>;
  darfGeteilt?: boolean;
  alsFassungVon?: string;
  abbrechenHref: string;
}) {
  const [zustand, action, laeuft] = useActionState<MethodenZustand, FormData>(
    methodeSpeichern,
    {}
  );

  const [sozialform, setSozialform] = useState<string[]>(werte.sozialform);
  const [parameter, setParameter] = useState<MethodenParameter[]>(
    werte.parameter
  );
  const [anweisung, setAnweisung] = useState(werte.anweisung);
  const [ziel, setZiel] = useState(darfGeteilt ? "geteilt" : "eigene");

  const anweisungsFehler = pruefeAnweisung(anweisung, parameter);
  let vorschau = "";
  if (!anweisungsFehler) {
    try {
      vorschau = rendereVorlage(anweisung, parameterWerte(parameter));
    } catch {
      vorschau = "";
    }
  }

  const setzeParameter = (i: number, teil: Partial<MethodenParameter>) =>
    setParameter((alt) =>
      alt.map((p, j) => (i === j ? { ...p, ...teil } : p))
    );

  return (
    <form action={action} className="max-w-3xl">
      {werte.id && <input type="hidden" name="id" value={werte.id} />}
      <input type="hidden" name="sozialform" value={JSON.stringify(sozialform)} />
      <input type="hidden" name="parameter" value={JSON.stringify(parameter)} />
      <input type="hidden" name="ziel" value={ziel} />

      {zustand.fehler && (
        <Notification kind="error" titel="Nicht gespeichert" className="mb-8">
          {zustand.fehler}
        </Notification>
      )}

      {alsFassungVon && (
        <Notification kind="info" titel="Eigene Fassung" className="mb-8">
          {darfGeteilt
            ? `«${alsFassungVon}» ist eine geteilte Methode. Unten wählst du, ob du sie für alle änderst oder eine eigene Fassung anlegst.`
            : `«${alsFassungVon}» ist eine geteilte Methode. Beim Speichern entsteht deine eigene Fassung; die geteilte bleibt, wie sie ist.`}
        </Notification>
      )}

      <div className="mb-8">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={werte.name}
          placeholder="z.B. Kartenabfrage"
          className="mt-2"
          required
        />
      </div>

      <div className="mb-8 grid gap-8 sm:grid-cols-2">
        <div>
          <Label htmlFor="kategorie">Kategorie</Label>
          <div className="mt-2">
            <Select
              name="kategorie"
              defaultValue={werte.kategorie || undefined}
              items={Object.fromEntries(kategorien.map((k) => [k.id, k.name]))}
            >
              <SelectTrigger id="kategorie">
                <SelectValue placeholder="Kategorie wählen" />
              </SelectTrigger>
              <SelectContent>
                {kategorien.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label htmlFor="schwerpunkt">Schwerpunkt</Label>
          <div className="mt-2">
            <Select
              name="schwerpunkt"
              defaultValue={werte.schwerpunkt}
              items={Object.fromEntries(
                Object.entries(schwerpunkte).map(([k]) => [k, k])
              )}
            >
              <SelectTrigger id="schwerpunkt">
                <SelectValue placeholder="Schwerpunkt wählen" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(schwerpunkte).map(([k, text]) => (
                  <SelectItem key={k} value={k}>
                    {k} — {text}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <fieldset className="mb-8">
        <legend className="type-label-02 mb-2 text-text-secondary">
          Sozialform
        </legend>
        <div className="flex flex-wrap gap-6">
          {Object.entries(sozialformen).map(([k, text]) => (
            <label key={k} className="type-body-compact-02 flex items-center gap-2">
              <Checkbox
                checked={sozialform.includes(k)}
                onCheckedChange={(an) =>
                  setSozialform((alt) =>
                    an ? [...alt, k] : alt.filter((x) => x !== k)
                  )
                }
              />
              {k} · {text}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mb-8 grid gap-8 sm:grid-cols-3">
        <div>
          <Label htmlFor="dauerMin">Dauer minimal</Label>
          <Input
            id="dauerMin"
            name="dauerMin"
            type="number"
            min={1}
            defaultValue={werte.dauerMin}
            className="mt-2"
            required
          />
        </div>
        <div>
          <Label htmlFor="dauerStandard">Standard</Label>
          <Input
            id="dauerStandard"
            name="dauerStandard"
            type="number"
            min={1}
            defaultValue={werte.dauerStandard}
            className="mt-2"
            required
          />
          <HelperText className="mt-2">Gilt, wenn nichts gewählt wird.</HelperText>
        </div>
        <div>
          <Label htmlFor="dauerMax">Dauer maximal</Label>
          <Input
            id="dauerMax"
            name="dauerMax"
            type="number"
            min={1}
            defaultValue={werte.dauerMax}
            className="mt-2"
            required
          />
        </div>
      </div>

      <div className="mb-8">
        <Label htmlFor="kurzbeschreibung">Kurzbeschreibung</Label>
        <Textarea
          id="kurzbeschreibung"
          name="kurzbeschreibung"
          defaultValue={werte.kurzbeschreibung}
          className="mt-2"
          rows={3}
          required
        />
        <HelperText className="mt-2">
          Ein bis zwei Sätze. Steht in der Liste und geht als Beschreibung der
          Methode in den Prompt.
        </HelperText>
      </div>

      <div className="mb-12">
        <Label htmlFor="material">Material, eines pro Zeile</Label>
        <Textarea
          id="material"
          name="material"
          defaultValue={werte.material.join("\n")}
          className="mt-2"
          rows={4}
          placeholder={"Leitfrage mit Regeln\nArbeitsblatt\nLösung"}
        />
      </div>

      <section className="mb-12">
        <SectionHeader
          titel="Parameter"
          beschreibung="Einstellbare Mengen, die in der Anweisung als {{name}} vorkommen."
          aktionen={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setParameter((alt) => [...alt, { ...NEUER_PARAMETER }])}
            >
              Parameter
              <Add size={16} />
            </Button>
          }
        />
        {parameter.length === 0 ? (
          <p className="type-body-02 text-text-secondary">
            Keine — die Anweisung nennt dann feste Mengen.
          </p>
        ) : (
          <ul className="grid gap-px bg-border-subtle">
            {parameter.map((p, i) => (
              <li key={i} className="bg-layer p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-48 flex-1">
                    <Label htmlFor={`p-name-${i}`}>Name</Label>
                    <Input
                      id={`p-name-${i}`}
                      value={p.name}
                      onChange={(e) => setzeParameter(i, { name: e.target.value })}
                      placeholder="anzahl_fragen"
                      className="mt-2 font-mono"
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor={`p-min-${i}`}>min</Label>
                    <Input
                      id={`p-min-${i}`}
                      type="number"
                      value={p.min}
                      onChange={(e) => setzeParameter(i, { min: Number(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor={`p-default-${i}`}>Vorgabe</Label>
                    <Input
                      id={`p-default-${i}`}
                      type="number"
                      value={p.default}
                      onChange={(e) => setzeParameter(i, { default: Number(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                  <div className="w-24">
                    <Label htmlFor={`p-max-${i}`}>max</Label>
                    <Input
                      id={`p-max-${i}`}
                      type="number"
                      value={p.max}
                      onChange={(e) => setzeParameter(i, { max: Number(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    size="icon-sm"
                    aria-label={`Parameter ${p.name || i + 1} entfernen`}
                    title="Entfernen"
                    onClick={() =>
                      setParameter((alt) => alt.filter((_, j) => j !== i))
                    }
                  >
                    <TrashCan size={16} />
                  </Button>
                </div>
                <div className="mt-4">
                  <Label htmlFor={`p-text-${i}`}>Bedeutung</Label>
                  <Input
                    id={`p-text-${i}`}
                    value={p.beschreibung}
                    onChange={(e) => setzeParameter(i, { beschreibung: e.target.value })}
                    placeholder="Wofür diese Zahl steht"
                    className="mt-2"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-12">
        <SectionHeader
          titel="Anweisung an die KI"
          beschreibung="Der methodenspezifische Auftrag. System-Prompt und Ausgabeformat kommen aus der Bibliothek und gelten für alle Methoden."
        />
        <Textarea
          id="anweisung"
          name="anweisung"
          value={anweisung}
          onChange={(e) => setAnweisung(e.target.value)}
          rows={10}
          required
          aria-invalid={!!anweisungsFehler}
          className="font-mono"
        />
        <HelperText className="mt-2">
          Platzhalter in doppelten geschweiften Klammern, z.B.{" "}
          <code className="font-mono">{"{{anzahl_fragen}}"}</code>.
        </HelperText>

        {anweisungsFehler ? (
          <Notification kind="warning" titel="Anweisung" className="mt-4">
            {anweisungsFehler}
          </Notification>
        ) : (
          vorschau !== anweisung && (
            <div className="mt-4">
              <Label>Vorschau mit den Vorgaben</Label>
              <p className="type-body-02 mt-2 whitespace-pre-wrap bg-layer p-4">
                {vorschau}
              </p>
            </div>
          )
        )}
      </section>

      {darfGeteilt && (
        <fieldset className="mb-12">
          <legend className="type-label-02 mb-2 text-text-secondary">
            Speichern als
          </legend>
          <div className="grid gap-px bg-border-subtle">
            {[
              {
                wert: "geteilt",
                titel: "Für alle",
                text: "Ändert die geteilte Methode. Konten mit einer eigenen Fassung merken nichts davon.",
              },
              {
                wert: "eigene",
                titel: "Eigene Fassung",
                text: "Gilt nur in deinem Konto; die geteilte bleibt unverändert.",
              },
            ].map((o) => (
              <label
                key={o.wert}
                className="flex cursor-pointer items-start gap-3 bg-layer p-4 hover:bg-layer-hover"
              >
                <input
                  type="radio"
                  name="ziel-anzeige"
                  value={o.wert}
                  checked={ziel === o.wert}
                  onChange={() => setZiel(o.wert)}
                  className="mt-1 accent-[var(--border-interactive)]"
                />
                <span>
                  <span className="type-heading-compact-02 block">{o.titel}</span>
                  <span className="type-body-compact-02 text-text-secondary">
                    {o.text}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex gap-px">
        <Button type="button" variant="secondary" render={<Link href={abbrechenHref} />}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={laeuft || !!anweisungsFehler}>
          {laeuft ? "Wird gespeichert…" : "Speichern"}
          <Checkmark size={16} />
        </Button>
      </div>
    </form>
  );
}
