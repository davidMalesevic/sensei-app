"use client";

import { useState } from "react";
import { Checkmark } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader } from "@/components/ui/page-header";
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
    <section className="mb-12">
      <SectionHeader titel="Notizen" />

      <form
        action={async (formData) => {
          await speichern(formData);
          setGespeichert(true);
          setTimeout(() => setGespeichert(false), 2000);
        }}
      >
        <Textarea
          name="cockpitNotiz"
          aria-label="Notizen zu dieser Sequenz"
          value={wert}
          onChange={(e) => setWert(e.target.value)}
          rows={4}
          placeholder="Freie Notizen, Links, Merkpunkte für diese Sequenz…"
        />
        <div className="mt-4">
          <Button type="submit" variant="outline">
            {gespeichert ? "Gespeichert" : "Notizen speichern"}
            {gespeichert && <Checkmark size={16} />}
          </Button>
        </div>
      </form>
    </section>
  );
}
