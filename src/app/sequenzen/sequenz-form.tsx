"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { PromptButton } from "./prompt-dialog";

type SemesterOption = { id: string; bezeichnung: string };
type KlasseOption = { id: string; bezeichnung: string; lehrjahr: number };
type ModulOption = { id: string; nummer: number; bezeichnung: string | null; lehrjahr: number | null };
type HK = {
  id: string;
  kuerzel: string;
  bezeichnung: string;
  moduleBerufsfachschule: number[] | null;
};
type HKB = {
  id: string;
  kuerzel: string;
  bezeichnung: string;
  handlungskompetenzen: HK[];
};
type BildungsplanData = {
  id: string;
  bezeichnung: string;
  handlungskompetenzbereiche: HKB[];
};

type SequenzData = {
  id?: string;
  titel: string;
  beschreibung: string | null;
  praxisbezug: string | null;
  semesterId: string;
  klasseId: string;
  modulId: string | null;
  selectedHKIds: string[];
};

export function SequenzForm({
  sequenzData,
  action,
  semesterList,
  klassenList,
  moduleList,
  bildungsplaene,
}: {
  sequenzData?: SequenzData;
  action: (formData: FormData) => Promise<void>;
  semesterList: SemesterOption[];
  klassenList: KlasseOption[];
  moduleList: ModulOption[];
  bildungsplaene: BildungsplanData[];
}) {
  const isEdit = !!sequenzData?.id;
  const [selectedKlasseId, setSelectedKlasseId] = useState<string>(
    sequenzData?.klasseId ?? ""
  );
  const [selectedModulId, setSelectedModulId] = useState<string>(
    sequenzData?.modulId ?? ""
  );

  const selectedKlasse = klassenList.find((k) => k.id === selectedKlasseId);
  const filteredModules = selectedKlasse
    ? moduleList.filter(
        (m) => m.lehrjahr === null || m.lehrjahr === selectedKlasse.lehrjahr
      )
    : moduleList;

  const selectedModul = filteredModules.find((m) => m.id === selectedModulId);
  const selectedModulNummer = selectedModul?.nummer;

  const filteredBildungsplaene = bildungsplaene
    .map((bp) => ({
      ...bp,
      handlungskompetenzbereiche: bp.handlungskompetenzbereiche
        .map((hkb) => ({
          ...hkb,
          handlungskompetenzen: selectedModulNummer
            ? hkb.handlungskompetenzen.filter((hk) =>
                (hk.moduleBerufsfachschule ?? []).includes(selectedModulNummer)
              )
            : hkb.handlungskompetenzen,
        }))
        .filter((hkb) => hkb.handlungskompetenzen.length > 0),
    }))
    .filter((bp) => bp.handlungskompetenzbereiche.length > 0);

  const defaultOpenHKBs = filteredBildungsplaene
    .flatMap((bp) => bp.handlungskompetenzbereiche)
    .map((hkb) => hkb.id);

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isEdit ? "Sequenz bearbeiten" : "Neue Sequenz anlegen"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              name="titel"
              placeholder="z.B. Einführung Projektmanagement"
              defaultValue={sequenzData?.titel}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="semesterId">Semester</Label>
              <Select
                name="semesterId"
                defaultValue={sequenzData?.semesterId}
                required
                items={Object.fromEntries(
                  semesterList.map((s) => [s.id, s.bezeichnung])
                )}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Semester wählen" />
                </SelectTrigger>
                <SelectContent>
                  {semesterList.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.bezeichnung}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="klasseId">Klasse</Label>
              <Select
                name="klasseId"
                value={selectedKlasseId || undefined}
                onValueChange={(val) => {
                  setSelectedKlasseId(val ?? "");
                  setSelectedModulId("");
                }}
                required
                items={Object.fromEntries(
                  klassenList.map((k) => [k.id, k.bezeichnung])
                )}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Klasse wählen" />
                </SelectTrigger>
                <SelectContent>
                  {klassenList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.bezeichnung}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="modulId">Modul</Label>
            <Select
              name="modulId"
              value={selectedModulId || "kein_modul"}
              onValueChange={(val) =>
                setSelectedModulId(val === "kein_modul" || !val ? "" : val)
              }
              items={{
                kein_modul: "– Kein Modul –",
                ...Object.fromEntries(
                  filteredModules.map((m) => [
                    m.id,
                    `Modul ${m.nummer}${m.bezeichnung ? ` – ${m.bezeichnung}` : ""}`,
                  ])
                ),
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Modul wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kein_modul">– Kein Modul –</SelectItem>
                {filteredModules.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    Modul {m.nummer}
                    {m.bezeichnung ? ` – ${m.bezeichnung}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {selectedKlasseId
                ? "Module gefiltert nach Lehrjahr der gewählten Klasse."
                : "Wähle zuerst eine Klasse, um die Module zu filtern."}
            </p>
          </div>

          {selectedKlasseId && selectedModulId && (
            <div className="rounded-lg border border-dashed p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">KI-Unterrichtsplanung</p>
                <p className="text-xs text-muted-foreground">
                  Generiere einen Prompt mit Klassen-, Modul- und Kontextdaten für die KI-gestützte Planung.
                </p>
              </div>
              <PromptButton
                klasseId={selectedKlasseId}
                modulId={selectedModulId}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="beschreibung">Beschreibung</Label>
            <Textarea
              id="beschreibung"
              name="beschreibung"
              placeholder="Kurze Beschreibung der Sequenz..."
              defaultValue={sequenzData?.beschreibung ?? ""}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="praxisbezug">Praxisbezug</Label>
            <Textarea
              id="praxisbezug"
              name="praxisbezug"
              placeholder="Bezug zum Lehrbetrieb, reale Aufgabenstellungen, Branchenbezug..."
              defaultValue={sequenzData?.praxisbezug ?? ""}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>
              Handlungskompetenzen
              {selectedModulNummer && (
                <span className="text-muted-foreground font-normal ml-1">
                  (gefiltert nach Modul {selectedModulNummer})
                </span>
              )}
            </Label>
            {filteredBildungsplaene.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {selectedModulNummer
                  ? "Keine Handlungskompetenzen für dieses Modul gefunden."
                  : "Wähle ein Modul, um die relevanten Handlungskompetenzen anzuzeigen."}
              </p>
            ) : (
              filteredBildungsplaene.map((bp) => (
                <Accordion key={bp.id} defaultValue={defaultOpenHKBs}>
                  {bp.handlungskompetenzbereiche.map((hkb) => (
                    <AccordionItem key={hkb.id} value={hkb.id}>
                      <AccordionTrigger className="text-sm">
                        <span>
                          <strong>{hkb.kuerzel}</strong> – {hkb.bezeichnung}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2 pl-2">
                          {hkb.handlungskompetenzen.map((hk) => (
                            <label
                              key={hk.id}
                              className="flex items-start gap-2 cursor-pointer"
                            >
                              <Checkbox
                                name="handlungskompetenzen"
                                value={hk.id}
                                defaultChecked={sequenzData?.selectedHKIds.includes(
                                  hk.id
                                )}
                                className="mt-0.5"
                              />
                              <span className="text-sm">
                                <strong>{hk.kuerzel}</strong> –{" "}
                                {hk.bezeichnung}
                              </span>
                            </label>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ))
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit">{isEdit ? "Speichern" : "Anlegen"}</Button>
            <Button
              type="button"
              variant="outline"
              render={<Link href="/sequenzen" />}
            >
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
