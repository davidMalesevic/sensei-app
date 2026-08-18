"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

type SemesterData = {
  id?: string;
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
};

export function SemesterForm({
  semester,
  action,
}: {
  semester?: SemesterData;
  action: (formData: FormData) => Promise<void>;
}) {
  const isEdit = !!semester?.id;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>
          {isEdit ? "Semester bearbeiten" : "Neues Semester anlegen"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bezeichnung">Bezeichnung</Label>
            <Input
              id="bezeichnung"
              name="bezeichnung"
              placeholder="z.B. HS 2026/27"
              defaultValue={semester?.bezeichnung}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDatum">Startdatum</Label>
              <Input
                id="startDatum"
                name="startDatum"
                type="date"
                defaultValue={semester?.startDatum}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDatum">Enddatum</Label>
              <Input
                id="endDatum"
                name="endDatum"
                type="date"
                defaultValue={semester?.endDatum}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit">
              {isEdit ? "Speichern" : "Anlegen"}
            </Button>
            <Button type="button" variant="outline" render={<Link href="/semester" />}>
              Abbrechen
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
