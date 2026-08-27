"use client";

import { useState, useTransition, useRef } from "react";
import { Upload, Checkmark, Document, Close } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Notification } from "@/components/ui/notification";
import { InlineLoading } from "@/components/ui/loading";
import { SectionHeader, DataItem } from "@/components/ui/page-header";
import { Label, HelperText } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  analysiereStundenplan,
  importiereStundenplan,
  type AnalyseErgebnis,
  type ImportErgebnis,
} from "./actions";

const OHNE = "ohne";

export function StundenplanImport() {
  const dateiRef = useRef<HTMLInputElement>(null);
  const [inhalt, setInhalt] = useState<string | null>(null);
  const [dateiname, setDateiname] = useState<string | null>(null);
  const [analyse, setAnalyse] = useState<AnalyseErgebnis | null>(null);
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [ergebnis, setErgebnis] = useState<ImportErgebnis | null>(null);
  const [laeuft, startTransition] = useTransition();

  async function handleDatei(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (!datei) return;

    const text = await datei.text();
    setInhalt(text);
    setDateiname(datei.name);
    setErgebnis(null);

    startTransition(async () => {
      const res = await analysiereStundenplan(text);
      setAnalyse(res);
      if (res.ok) {
        setZuordnung(
          Object.fromEntries(
            res.klassen.map((k) => [k.kuerzel, k.vorschlagKlasseId ?? OHNE])
          )
        );
      }
    });
  }

  function zuruecksetzen() {
    setInhalt(null);
    setDateiname(null);
    setAnalyse(null);
    if (dateiRef.current) dateiRef.current.value = "";
  }

  function handleImport() {
    if (!inhalt) return;
    startTransition(async () => {
      const res = await importiereStundenplan(
        inhalt,
        Object.entries(zuordnung)
          .filter(([, klasseId]) => klasseId !== OHNE)
          .map(([kuerzel, klasseId]) => ({ kuerzel, klasseId }))
      );
      setErgebnis(res);
      if (res.ok) zuruecksetzen();
    });
  }

  const offen =
    analyse?.ok === true
      ? analyse.klassen.filter((k) => (zuordnung[k.kuerzel] ?? OHNE) === OHNE)
      : [];
  const zugeordnet =
    analyse?.ok === true ? analyse.klassen.length - offen.length : 0;

  return (
    <section className="mb-12">
      <SectionHeader
        titel="Stundenplan importieren"
        beschreibung="WebUntis-Export als .ics. Daraus entstehen die Sequenzen samt Klasse, Modul, Datum, Zeit, Lektionenzahl und Raum — ein erneuter Import derselben Datei ändert nichts."
      />

      {/* Carbon File Uploader: Label, Hilfetext, Knopf, dann die Dateizeile. */}
      <div className="bg-layer p-4">
        <Label htmlFor="ics-datei">Kalenderexport</Label>
        <HelperText className="mt-1 mb-4">
          Nur .ics-Dateien. Die Analyse läuft, sobald die Datei gewählt ist.
        </HelperText>

        <input
          ref={dateiRef}
          type="file"
          accept=".ics,text/calendar"
          onChange={handleDatei}
          className="sr-only"
          id="ics-datei"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={laeuft}
          onClick={() => dateiRef.current?.click()}
        >
          Datei wählen
          <Upload size={16} />
        </Button>

        {dateiname && (
          <div className="mt-4 flex items-center gap-3 border border-border-strong bg-background px-4 py-2">
            <Document size={16} className="shrink-0 text-text-secondary" />
            <span className="type-body-compact-02 min-w-0 flex-1 truncate">
              {dateiname}
            </span>
            {laeuft ? (
              <InlineLoading />
            ) : (
              <button
                type="button"
                onClick={zuruecksetzen}
                aria-label="Datei entfernen"
                className="shrink-0 text-text-secondary transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <Close size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {analyse?.ok === false && (
        <Notification kind="error" titel="Import nicht möglich" className="mt-4">
          {analyse.fehler}
        </Notification>
      )}

      {ergebnis?.ok === false && (
        <Notification kind="error" titel="Import fehlgeschlagen" className="mt-4">
          {ergebnis.fehler}
        </Notification>
      )}

      {ergebnis?.ok === true && (
        <Notification kind="success" titel="Import abgeschlossen" className="mt-4">
          {ergebnis.neu} Sequenzen neu angelegt, {ergebnis.aktualisiert}{" "}
          aktualisiert, {ergebnis.unveraendert} unverändert
          {ergebnis.uebersprungen > 0 &&
            ` · ${ergebnis.uebersprungen} Termine übersprungen (Kürzel keiner Klasse zugeordnet)`}
          {ergebnis.verwaist > 0 &&
            ` · ${ergebnis.verwaist} bestehende Sequenzen fehlen im Export und wurden nicht gelöscht — dort könnte Planung drinstecken`}
        </Notification>
      )}

      {analyse?.ok === true && (
        <>
          <div className="mt-8 grid gap-px bg-border-subtle sm:grid-cols-3">
            <div className="bg-layer p-4">
              <div className="type-label-02 text-text-helper">Sequenzen</div>
              <div className="type-heading-04 mt-1 text-foreground">
                {analyse.anzahlTermine}
              </div>
            </div>
            <div className="bg-layer p-4">
              <div className="type-label-02 text-text-helper">Klassenkürzel</div>
              <div className="type-heading-04 mt-1 text-foreground">
                {analyse.klassen.length}
              </div>
            </div>
            <div className="bg-layer p-4">
              <div className="type-label-02 text-text-helper">Module</div>
              <div className="type-heading-04 mt-1 text-foreground">
                {analyse.module.length}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-12 gap-y-4 bg-layer p-4">
            <DataItem label="Zeitraum">
              {analyse.vonDatum} bis {analyse.bisDatum}
            </DataItem>
            {analyse.ohneModul > 0 && (
              <DataItem label="Ohne erkennbare Modulnummer">
                {analyse.ohneModul} Termine
              </DataItem>
            )}
          </div>

          <div className="mt-8">
            <SectionHeader
              titel="Klassen zuordnen"
              beschreibung="Der Kalender nennt Klassen anders als du. Die Zuordnung wird gespeichert und beim nächsten Import wiederverwendet."
            />

            <Table>
              <TableHeader>
                <TableRow className="hover:bg-layer-accent">
                  <TableHead>Kürzel im Kalender</TableHead>
                  <TableHead className="w-24">Termine</TableHead>
                  <TableHead className="w-72">Klasse in Sensei</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyse.klassen.map((k) => {
                  const wert = zuordnung[k.kuerzel] ?? OHNE;
                  return (
                    <TableRow key={k.kuerzel} className="hover:bg-layer">
                      <TableCell className="py-2">
                        <span className="font-mono text-sm">{k.kuerzel}</span>
                        {k.bekannt && (
                          <Badge variant="blue" size="sm" className="ml-2">
                            bekannt
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-text-secondary">
                        {k.anzahl}
                      </TableCell>
                      <TableCell className="py-2">
                        <Select
                          value={wert}
                          onValueChange={(v) =>
                            setZuordnung((z) => ({
                              ...z,
                              [k.kuerzel]: String(v),
                            }))
                          }
                          items={{
                            [OHNE]: "— nicht importieren —",
                            ...Object.fromEntries(
                              analyse.klassenListe.map((kl) => [
                                kl.id,
                                kl.bezeichnung,
                              ])
                            ),
                          }}
                        >
                          <SelectTrigger size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={OHNE}>
                              — nicht importieren —
                            </SelectItem>
                            {analyse.klassenListe.map((kl) => (
                              <SelectItem key={kl.id} value={kl.id}>
                                {kl.bezeichnung}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {analyse.module.some((m) => !m.vorhanden) && (
              <p className="type-body-02 mt-4 text-text-secondary">
                Neu angelegt werden die Module{" "}
                {analyse.module
                  .filter((m) => !m.vorhanden)
                  .map((m) => m.nummer)
                  .join(", ")}
                .
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <span className="type-body-02 text-text-secondary">
                {zugeordnet} von {analyse.klassen.length} Kürzeln zugeordnet
                {offen.length > 0 &&
                  ` · ${offen.reduce((n, k) => n + k.anzahl, 0)} Termine werden übersprungen`}
              </span>
              <div className="flex items-center gap-4">
                {laeuft && <InlineLoading text="Wird importiert…" />}
                <Button onClick={handleImport} disabled={laeuft || zugeordnet === 0}>
                  Sequenzen anlegen
                  <Checkmark size={16} />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
