"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, Document, Close } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Label, HelperText } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { InlineLoading } from "@/components/ui/loading";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { importiereResultate } from "./actions";

export type ModulOption = { id: string; nummer: number; bezeichnung: string | null };

export function ImportForm({ module }: { module: ModulOption[] }) {
  const router = useRouter();
  const dateiRef = useRef<HTMLInputElement>(null);
  const [modulId, setModulId] = useState(module[0]?.id ?? "");
  const [datei, setDatei] = useState<File | null>(null);
  const [laeuft, startTransition] = useTransition();
  const [meldung, setMeldung] = useState<
    { art: "error" | "success"; text: string } | null
  >(null);

  const items = Object.fromEntries(
    module.map((m) => [m.id, `Modul ${m.nummer}${m.bezeichnung ? ` – ${m.bezeichnung}` : ""}`])
  );

  function starten() {
    if (!datei || !modulId) return;
    setMeldung(null);
    startTransition(async () => {
      const puffer = await datei.arrayBuffer();
      const base64 = btoa(
        Array.from(new Uint8Array(puffer), (b) => String.fromCharCode(b)).join("")
      );
      const res = await importiereResultate(modulId, datei.name, base64);
      if (res.ok) {
        setMeldung({
          art: "success",
          text: `${res.lernende} Lernende, ${res.aufgaben} Aufgaben, ${res.abgaben} Abgaben eingelesen.`,
        });
        setDatei(null);
        if (dateiRef.current) dateiRef.current.value = "";
        router.refresh();
      } else {
        setMeldung({ art: "error", text: res.fehler });
      }
    });
  }

  if (module.length === 0) {
    return (
      <Notification kind="info" titel="Noch keine Module">
        Resultate hängen an einem Modul. Importiere zuerst einen Stundenplan —
        daraus entstehen die Module.
      </Notification>
    );
  }

  return (
    <>
      {meldung && (
        <Notification
          kind={meldung.art}
          titel={meldung.art === "error" ? "Import nicht möglich" : "Eingelesen"}
          className="mb-4"
        >
          {meldung.text}
        </Notification>
      )}

      <div className="bg-layer p-4">
        <div className="mb-8 max-w-md">
          <Label htmlFor="modul">Modul</Label>
          <div className="mt-2">
            <Select value={modulId} onValueChange={(v) => setModulId(String(v))} items={items}>
              <SelectTrigger id="modul"><SelectValue /></SelectTrigger>
              <SelectContent>
                {module.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    Modul {m.nummer}{m.bezeichnung ? ` – ${m.bezeichnung}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <HelperText className="mt-2">
            Die Modulnummer im Export muss dazu passen, sonst wird abgelehnt.
          </HelperText>
        </div>

        <Label htmlFor="datei">Resultate-Export</Label>
        <HelperText className="mt-1 mb-4">
          Die .xlsx-Datei aus Smartlearn. Jeder Import ist eine Momentaufnahme —
          mehrere davon zeigen, was zwischen zwei Lektionen dazugekommen ist.
        </HelperText>

        <input
          ref={dateiRef}
          id="datei"
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => {
            setDatei(e.target.files?.[0] ?? null);
            setMeldung(null);
          }}
        />
        <div className="flex flex-wrap items-center gap-px">
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
          {datei && (
            <Button size="sm" onClick={starten} disabled={laeuft}>
              Einlesen
              <Upload size={16} />
            </Button>
          )}
        </div>

        {datei && (
          <div className="mt-4 flex items-center gap-3 border border-border-strong bg-background px-4 py-2">
            <Document size={16} className="shrink-0 text-text-secondary" />
            <span className="type-body-compact-02 min-w-0 flex-1 truncate">{datei.name}</span>
            {laeuft ? (
              <InlineLoading text="Wird gelesen…" />
            ) : (
              <button
                type="button"
                aria-label="Datei entfernen"
                onClick={() => { setDatei(null); if (dateiRef.current) dateiRef.current.value = ""; }}
                className="shrink-0 text-text-secondary hover:text-foreground"
              >
                <Close size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
