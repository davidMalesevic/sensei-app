"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type KlasseData = {
  id?: string;
  bezeichnung: string;
  beruf: string;
  lehrjahr: number;
};

export function KlasseForm({
  klasse,
  action,
}: {
  klasse?: KlasseData;
  action: (formData: FormData) => Promise<void>;
}) {
  const isEdit = !!klasse?.id;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>
          {isEdit ? "Klasse bearbeiten" : "Neue Klasse anlegen"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input
              id="bezeichnung"
              name="bezeichnung"
              placeholder="z.B. EDB24a"
              defaultValue={klasse?.bezeichnung}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beruf">Beruf</Label>
            <Input
              id="beruf"
              name="beruf"
              placeholder="z.B. Entwickler/in digitales Business EFZ"
              defaultValue={klasse?.beruf ?? "Entwickler/in digitales Business EFZ"}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lehrjahr">Lehrjahr</Label>
            <Select
              name="lehrjahr"
              defaultValue={String(klasse?.lehrjahr ?? 1)}
              items={{ "1": "1. Lehrjahr", "2": "2. Lehrjahr", "3": "3. Lehrjahr", "4": "4. Lehrjahr" }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Lehrjahr wählen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1. Lehrjahr</SelectItem>
                <SelectItem value="2">2. Lehrjahr</SelectItem>
                <SelectItem value="3">3. Lehrjahr</SelectItem>
                <SelectItem value="4">4. Lehrjahr</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit">
              {isEdit ? "Speichern" : "Anlegen"}
            </Button>
            <Button type="button" variant="outline" render={<Link href="/klassen" />}>
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
