"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type KlasseData = {
  id?: string;
  bezeichnung: string;
  beruf: string;
  lehrjahr: number;
};

const LEHRJAHRE = {
  "1": "1. Lehrjahr",
  "2": "2. Lehrjahr",
  "3": "3. Lehrjahr",
  "4": "4. Lehrjahr",
};

/**
 * Carbon-Formular: ein Feld pro Zeile, Label darüber, Hilfetext darunter,
 * Schaltflächen unten links. Formularfelder sind höchstens 32rem breit —
 * darüber hinaus wird das Lesen schwer.
 */
export function KlasseForm({
  klasse,
  action,
}: {
  klasse?: KlasseData;
  action: (formData: FormData) => Promise<void>;
}) {
  const isEdit = !!klasse?.id;

  return (
    <form action={action} className="max-w-lg">
      <div className="mb-8">
        <Label htmlFor="bezeichnung">Bezeichnung</Label>
        <Input
          id="bezeichnung"
          name="bezeichnung"
          placeholder="z.B. EDB24a"
          defaultValue={klasse?.bezeichnung}
          className="mt-2"
          required
        />
        <HelperText className="mt-2">
          So heisst die Klasse in Sensei — der Kalender nennt sie meist anders.
        </HelperText>
      </div>

      <div className="mb-8">
        <Label htmlFor="beruf">Beruf</Label>
        <Input
          id="beruf"
          name="beruf"
          placeholder="z.B. Entwickler/in digitales Business EFZ"
          defaultValue={klasse?.beruf ?? "Entwickler/in digitales Business EFZ"}
          className="mt-2"
          required
        />
      </div>

      <div className="mb-8">
        <Label htmlFor="lehrjahr">Lehrjahr</Label>
        <div className="mt-2">
          <Select
            name="lehrjahr"
            defaultValue={String(klasse?.lehrjahr ?? 1)}
            items={LEHRJAHRE}
          >
            <SelectTrigger id="lehrjahr">
              <SelectValue placeholder="Lehrjahr wählen" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LEHRJAHRE).map(([wert, label]) => (
                <SelectItem key={wert} value={wert}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-px">
        <Button type="button" variant="secondary" render={<Link href="/klassen" />}>
          Abbrechen
        </Button>
        <Button type="submit">{isEdit ? "Speichern" : "Anlegen"}</Button>
      </div>
    </form>
  );
}
