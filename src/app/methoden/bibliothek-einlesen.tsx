"use client";

import { useActionState } from "react";
import { Upload } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { HelperText, Label } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { cn } from "@/lib/utils";
import { bibliothekEinlesen, type MethodenZustand } from "./actions";

/**
 * Nur für Admins. Ohne Datei gilt die mitgelieferte Bibliothek aus dem Repo —
 * so braucht keine Instanz einen Tunnel oder ein Script.
 */
export function BibliothekEinlesen({ className }: { className?: string }) {
  const [zustand, action, laeuft] = useActionState<MethodenZustand, FormData>(
    bibliothekEinlesen,
    {}
  );

  return (
    <form action={action} className={cn("max-w-lg", className)}>
      {zustand.fehler && (
        <Notification kind="error" titel="Nicht eingelesen" className="mb-6">
          {zustand.fehler}
        </Notification>
      )}
      {zustand.hinweis && (
        <Notification kind="success" titel="Erledigt" className="mb-6">
          {zustand.hinweis}
        </Notification>
      )}
      <div className="mb-6">
        <Label htmlFor="datei">Andere Datei (optional)</Label>
        <Input id="datei" name="datei" type="file" accept=".json,application/json" className="mt-2" />
        <HelperText className="mt-2">
          Leer lassen, um die mitgelieferte Bibliothek zu verwenden.
        </HelperText>
      </div>
      <label className="type-body-compact-02 mb-2 flex items-center gap-2">
        <Checkbox name="ueberschreiben" />
        Geteilte Methoden überschreiben
      </label>
      <HelperText className="mb-6">
        Sonst bleiben geteilte Methoden, die es schon gibt, unverändert — auch
        wenn sie hier bearbeitet wurden. Eigene Fassungen werden nie angefasst.
      </HelperText>
      <Button type="submit" variant="secondary" disabled={laeuft}>
        {laeuft ? "Wird eingelesen…" : "Bibliothek einlesen"}
        <Upload size={16} />
      </Button>
    </form>
  );
}
