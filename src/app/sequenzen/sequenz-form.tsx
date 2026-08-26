"use client";

import { useState, useTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Sparkles, Loader2, Upload, FileText, X } from "lucide-react";
import Link from "next/link";

type SemesterOption = {
  id: string;
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
};
type KlasseOption = { id: string; bezeichnung: string; lehrjahr: number };
type ModulOption = {
  id: string;
  nummer: number;
  bezeichnung: string | null;
  lehrjahr: number | null;
};
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

type PhasenmodellOption = {
  id: string;
  name: string;
  phasenTemplates: {
    kuerzel: string;
    bezeichnung: string;
    methodenVorschlaege: string[] | null;
  }[];
};

type BlockConfig = {
  blockTyp: "2er" | "4er";
  phasenmodellId: string;
  thema: string;
};

type SequenzData = {
  id?: string;
  titel: string;
  beschreibung: string | null;
  praxisbezug: string | null;
  semesterId: string;
  klasseId: string;
  modulId: string | null;
  startDatum: string | null;
  selectedHKIds: string[];
};

type ModulMaterial = {
  id: string;
  titel: string;
  typ: string;
  dateiPfad: string | null;
};

export function SequenzForm({
  sequenzData,
  action,
  semesterList,
  klassenList,
  moduleList,
  bildungsplaene,
  phasenmodelle,
}: {
  sequenzData?: SequenzData;
  action: (formData: FormData) => Promise<void>;
  semesterList: SemesterOption[];
  klassenList: KlasseOption[];
  moduleList: ModulOption[];
  bildungsplaene: BildungsplanData[];
  phasenmodelle?: PhasenmodellOption[];
}) {
  const isEdit = !!sequenzData?.id;
  const [selectedKlasseId, setSelectedKlasseId] = useState<string>(
    sequenzData?.klasseId ?? ""
  );
  const [selectedModulId, setSelectedModulId] = useState<string>(
    sequenzData?.modulId ?? ""
  );
  const [blocks, setBlocks] = useState<BlockConfig[]>([]);
  const [mode, setMode] = useState<"manual" | "ki">("manual");
  const [datum, setDatum] = useState<string>(sequenzData?.startDatum ?? "");
  const [semesterId, setSemesterId] = useState<string>(
    sequenzData?.semesterId ?? ""
  );
  const [semesterAutoDetected, setSemesterAutoDetected] = useState(false);

  // KI mode fields
  const [modulMaterialien, setModulMaterialien] = useState<ModulMaterial[]>([]);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [vorwissen, setVorwissen] = useState("");
  const [aufgaben, setAufgaben] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showErweitert, setShowErweitert] = useState(isEdit);

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

  // Collect all methodenVorschlaege from selected phasenmodelle in blocks
  const allMethodenVorschlaege = Array.from(
    new Set(
      blocks.flatMap((b) => {
        if (b.phasenmodellId === "frei") return [];
        const pm = phasenmodelle?.find((p) => p.id === b.phasenmodellId);
        return (
          pm?.phasenTemplates.flatMap(
            (pt) => (pt.methodenVorschlaege as string[]) ?? []
          ) ?? []
        );
      })
    )
  );

  function handleDatumChange(newDatum: string) {
    setDatum(newDatum);
    if (!newDatum) return;

    const match = semesterList.find(
      (s) => newDatum >= s.startDatum && newDatum <= s.endDatum
    );
    if (match) {
      setSemesterId(match.id);
      setSemesterAutoDetected(true);
    }
  }

  async function handleModulChange(newModulId: string) {
    const id = newModulId === "kein_modul" || !newModulId ? "" : newModulId;
    setSelectedModulId(id);
    setSelectedMaterialIds([]);
    setModulMaterialien([]);

    if (id) {
      try {
        const res = await fetch(`/api/materialien/modul/${id}`);
        if (res.ok) {
          const data = await res.json();
          setModulMaterialien(data);
        }
      } catch {
        // ignore fetch errors
      }
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedModulId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("modulId", selectedModulId);
      formData.append("titel", file.name);
      formData.append("typ", "dokument");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const newMat: ModulMaterial = {
          id: data.id,
          titel: file.name,
          typ: "dokument",
          dateiPfad: data.dateiPfad,
        };
        setModulMaterialien((prev) => [...prev, newMat]);
        setSelectedMaterialIds((prev) => [...prev, data.id]);
      }
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  function toggleMaterialSelection(id: string) {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function addBlock() {
    setBlocks((prev) => [
      ...prev,
      { blockTyp: "2er", phasenmodellId: "frei", thema: "" },
    ]);
  }

  function removeBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateBlock(index: number, field: keyof BlockConfig, value: string) {
    setBlocks((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b))
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isEdit ? "Sequenz bearbeiten" : "Neue Sequenz anlegen"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-6">
          {/* Hidden inputs for mode and KI data */}
          <input type="hidden" name="mode" value={mode} />
          {mode === "ki" && (
            <>
              <input
                type="hidden"
                name="materialIds"
                value={JSON.stringify(selectedMaterialIds)}
              />
              <input type="hidden" name="vorwissen" value={vorwissen} />
              <input type="hidden" name="aufgaben" value={aufgaben} />
            </>
          )}

          {/* Klasse */}
          <div className="space-y-2">
            <Label htmlFor="klasseId">Klasse</Label>
            <Select
              name="klasseId"
              value={selectedKlasseId || undefined}
              onValueChange={(val) => {
                setSelectedKlasseId(val ?? "");
                setSelectedModulId("");
                setModulMaterialien([]);
                setSelectedMaterialIds([]);
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

          {/* Modul */}
          <div className="space-y-2">
            <Label htmlFor="modulId">Modul</Label>
            <Select
              name="modulId"
              value={selectedModulId || "kein_modul"}
              onValueChange={(val) => handleModulChange(val ?? "kein_modul")}
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

          {/* Datum + Semester */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="datum">Datum</Label>
              <Input
                id="datum"
                name="datum"
                type="date"
                value={datum}
                onChange={(e) => handleDatumChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="semesterId">
                Semester
                {semesterAutoDetected && (
                  <span className="text-xs text-muted-foreground ml-1">
                    (automatisch)
                  </span>
                )}
              </Label>
              <Select
                name="semesterId"
                value={semesterId || undefined}
                onValueChange={(val) => {
                  setSemesterId(val ?? "");
                  setSemesterAutoDetected(false);
                }}
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
          </div>

          {/* Titel */}
          <div className="space-y-2">
            <Label htmlFor="titel">Titel</Label>
            <Input
              id="titel"
              name="titel"
              placeholder={
                mode === "ki" && selectedModul && datum
                  ? `Modul ${selectedModul.nummer} – ${new Date(datum).toLocaleDateString("de-CH")}`
                  : "z.B. Einführung Projektmanagement"
              }
              defaultValue={sequenzData?.titel}
              required
            />
          </div>

          {/* Block configuration (both modes) */}
          {!isEdit && phasenmodelle && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Lektionsblöcke</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBlock}
                >
                  <Plus className="h-3 w-3" />
                  Block hinzufügen
                </Button>
              </div>

              {blocks.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Definiere Lektionsblöcke mit Phasenmodell für die Planung.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {blocks.map((block, i) => (
                    <div
                      key={i}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          Block {i + 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => removeBlock(i)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Select
                          value={block.blockTyp}
                          onValueChange={(val) =>
                            updateBlock(i, "blockTyp", val ?? "2er")
                          }
                          items={{
                            "2er": "2er (90 Min.)",
                            "4er": "4er (180 Min.)",
                          }}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2er">
                              2er (90 Min.)
                            </SelectItem>
                            <SelectItem value="4er">
                              4er (180 Min.)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={block.phasenmodellId}
                          onValueChange={(val) =>
                            updateBlock(i, "phasenmodellId", val ?? "frei")
                          }
                          items={{
                            frei: "Frei",
                            ...Object.fromEntries(
                              phasenmodelle.map((pm) => [pm.id, pm.name])
                            ),
                          }}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="frei">Frei</SelectItem>
                            {phasenmodelle.map((pm) => (
                              <SelectItem key={pm.id} value={pm.id}>
                                {pm.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Thema (optional)"
                          className="text-xs"
                          value={block.thema}
                          onChange={(e) =>
                            updateBlock(i, "thema", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <input
                type="hidden"
                name="bloecke"
                value={JSON.stringify(blocks)}
              />
            </div>
          )}

          {/* Mode Toggle — only for new sequenzen */}
          {!isEdit && (
            <div className="space-y-3">
              <Label>Planungsmodus</Label>
              <div className="flex rounded-lg border p-1 gap-1">
                <button
                  type="button"
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    mode === "manual"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setMode("manual")}
                >
                  Manuell
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                    mode === "ki"
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setMode("ki")}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  KI-gestützt
                </button>
              </div>
            </div>
          )}

          {/* KI Fields — only visible in KI mode for new sequenzen */}
          {!isEdit && mode === "ki" && (
            <div className="space-y-4 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                KI-Planungsdetails
              </p>

              {/* Material selection */}
              <div className="space-y-2">
                <Label>Unterrichtsmaterial</Label>
                {selectedModulId ? (
                  <>
                    {modulMaterialien.length > 0 ? (
                      <div className="space-y-1">
                        {modulMaterialien.map((mat) => (
                          <label
                            key={mat.id}
                            className="flex items-center gap-2 cursor-pointer text-sm"
                          >
                            <Checkbox
                              checked={selectedMaterialIds.includes(mat.id)}
                              onCheckedChange={() =>
                                toggleMaterialSelection(mat.id)
                              }
                            />
                            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="truncate">{mat.titel}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Noch kein Material für dieses Modul vorhanden.
                      </p>
                    )}
                    <div className="pt-1">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                          {isUploading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Upload className="h-3 w-3" />
                          )}
                          {isUploading
                            ? "Wird hochgeladen..."
                            : "Datei hochladen"}
                        </span>
                      </label>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Wähle zuerst ein Modul, um Materialien auszuwählen.
                  </p>
                )}
              </div>

              {/* Vorwissen */}
              <div className="space-y-2">
                <Label htmlFor="vorwissen">Vorwissen aktivieren</Label>
                <Textarea
                  id="vorwissen"
                  placeholder="Wie soll das Vorwissen aktiviert werden?"
                  value={vorwissen}
                  onChange={(e) => setVorwissen(e.target.value)}
                  rows={2}
                />
                {allMethodenVorschlaege.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {allMethodenVorschlaege.map((methode) => (
                      <button
                        key={methode}
                        type="button"
                        className="text-xs px-2 py-1 rounded-full border hover:bg-muted transition-colors"
                        onClick={() =>
                          setVorwissen((prev) =>
                            prev ? `${prev}, ${methode}` : methode
                          )
                        }
                      >
                        {methode}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Aufgaben */}
              <div className="space-y-2">
                <Label htmlFor="aufgaben">Aufgaben</Label>
                <Textarea
                  id="aufgaben"
                  placeholder="Welche Aufgaben sollen die Lernenden bearbeiten?"
                  value={aufgaben}
                  onChange={(e) => setAufgaben(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Erweiterte Optionen (collapsible) */}
          <div>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowErweitert(!showErweitert)}
            >
              {showErweitert
                ? "▾ Erweiterte Optionen"
                : "▸ Erweiterte Optionen"}
            </button>

            {showErweitert && (
              <div className="space-y-4 mt-3">
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
                                <strong>{hkb.kuerzel}</strong> –{" "}
                                {hkb.bezeichnung}
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
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "ki" ? "KI generiert..." : "Wird erstellt..."}
                </>
              ) : isEdit ? (
                "Speichern"
              ) : mode === "ki" ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Anlegen & KI-Planung erstellen
                </>
              ) : (
                "Anlegen"
              )}
            </Button>
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
