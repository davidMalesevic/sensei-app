"use client";

import { useState, useTransition, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
} from "lucide-react";
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
      if (res.ok) {
        setAnalyse(null);
        setInhalt(null);
        setDateiname(null);
        if (dateiRef.current) dateiRef.current.value = "";
      }
    });
  }

  const offen =
    analyse?.ok === true
      ? analyse.klassen.filter((k) => (zuordnung[k.kuerzel] ?? OHNE) === OHNE)
      : [];
  const zugeordnet =
    analyse?.ok === true ? analyse.klassen.length - offen.length : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Stundenplan importieren
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            WebUntis-Export als <code>.ics</code>. Daraus entstehen die Sequenzen
            samt Klasse, Modul, Datum, Zeit, Lektionenzahl und Raum — ein
            erneuter Import derselben Datei ändert nichts.
          </p>

          <div className="flex items-center gap-3">
            <input
              ref={dateiRef}
              type="file"
              accept=".ics,text/calendar"
              onChange={handleDatei}
              className="hidden"
              id="ics-datei"
            />
            <Button
              type="button"
              variant="outline"
              disabled={laeuft}
              onClick={() => dateiRef.current?.click()}
            >
              {laeuft ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Datei wählen
            </Button>
            {dateiname && (
              <span className="text-sm text-muted-foreground">{dateiname}</span>
            )}
          </div>

          {analyse?.ok === false && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm">{analyse.fehler}</p>
            </div>
          )}

          {ergebnis?.ok === false && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-200">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-sm">{ergebnis.fehler}</p>
            </div>
          )}

          {ergebnis?.ok === true && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p>
                  {ergebnis.neu} Sequenzen neu angelegt, {ergebnis.aktualisiert}{" "}
                  aktualisiert, {ergebnis.unveraendert} unverändert.
                </p>
                {ergebnis.uebersprungen > 0 && (
                  <p>
                    {ergebnis.uebersprungen} Termine übersprungen — Kürzel keiner
                    Klasse zugeordnet.
                  </p>
                )}
                {ergebnis.verwaist > 0 && (
                  <p>
                    {ergebnis.verwaist} bestehende Sequenzen kommen im Export
                    nicht mehr vor. Sie wurden nicht gelöscht — dort könnte
                    Planung drinstecken.
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {analyse?.ok === true && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Gefunden</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3 text-sm">
                <div>
                  <div className="text-2xl font-semibold">
                    {analyse.anzahlTermine}
                  </div>
                  <div className="text-muted-foreground">Sequenzen</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">
                    {analyse.klassen.length}
                  </div>
                  <div className="text-muted-foreground">Klassenkürzel</div>
                </div>
                <div>
                  <div className="text-2xl font-semibold">
                    {analyse.module.length}
                  </div>
                  <div className="text-muted-foreground">Module</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Zeitraum {analyse.vonDatum} bis {analyse.bisDatum}
                {analyse.ohneModul > 0 &&
                  ` · ${analyse.ohneModul} Termine ohne erkennbare Modulnummer`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Klassen zuordnen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Der Kalender nennt Klassen anders als du. Die Zuordnung wird
                gespeichert und beim nächsten Import wiederverwendet.
              </p>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kürzel im Kalender</TableHead>
                    <TableHead className="w-24">Termine</TableHead>
                    <TableHead>Klasse in Sensei</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyse.klassen.map((k) => {
                    const wert = zuordnung[k.kuerzel] ?? OHNE;
                    return (
                      <TableRow key={k.kuerzel}>
                        <TableCell className="font-mono text-xs">
                          {k.kuerzel}
                          {k.bekannt && (
                            <Badge variant="outline" className="ml-2">
                              bekannt
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {k.anzahl}
                        </TableCell>
                        <TableCell>
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
                            <SelectTrigger className="w-56">
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
                <p className="text-sm text-muted-foreground">
                  Neu angelegt werden die Module{" "}
                  {analyse.module
                    .filter((m) => !m.vorhanden)
                    .map((m) => m.nummer)
                    .join(", ")}
                  .
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-sm text-muted-foreground">
                  {zugeordnet} von {analyse.klassen.length} Kürzeln zugeordnet
                  {offen.length > 0 &&
                    ` · ${offen.reduce((n, k) => n + k.anzahl, 0)} Termine werden übersprungen`}
                </span>
                <Button onClick={handleImport} disabled={laeuft || zugeordnet === 0}>
                  {laeuft ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Sequenzen anlegen
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
