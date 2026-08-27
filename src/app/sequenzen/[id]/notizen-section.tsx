"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Check, StickyNote } from "lucide-react";
import { saveCockpitNotiz } from "../actions";

/**
 * Freie Notizen zur Sequenz — was weder Ablauf noch Übertrag ist:
 * Links, Merkpunkte, Organisatorisches.
 */
export function NotizenSection({
  sequenzId,
  notiz,
}: {
  sequenzId: string;
  notiz: string | null;
}) {
  const [wert, setWert] = useState(notiz ?? "");
  const [gespeichert, setGespeichert] = useState(false);
  const speichern = saveCockpitNotiz.bind(null, sequenzId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4" />
          Notizen
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={async (formData) => {
            await speichern(formData);
            setGespeichert(true);
            setTimeout(() => setGespeichert(false), 2000);
          }}
          className="space-y-2"
        >
          <Textarea
            name="cockpitNotiz"
            value={wert}
            onChange={(e) => setWert(e.target.value)}
            rows={4}
            placeholder="Freie Notizen, Links, Merkpunkte für diese Sequenz…"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" variant="outline">
              {gespeichert ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Gespeichert
                </>
              ) : (
                "Notizen speichern"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
