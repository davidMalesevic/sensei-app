"use client";

import { DeleteButton } from "@/components/delete-button";
import { deleteSequenz } from "../actions";

export function SequenzDeleteButton({
  id,
  bezeichnung,
}: {
  id: string;
  bezeichnung?: string;
}) {
  return (
    <DeleteButton
      onDelete={() => deleteSequenz(id)}
      titel="Sequenz löschen"
      beschreibung={
        bezeichnung
          ? `«${bezeichnung}» wird mit Ablauf, Übertrag und Notizen entfernt. Ein erneuter Stundenplan-Import legt die Sequenz zwar wieder an, aber ohne die Planung.`
          : "Die Sequenz wird mit Ablauf, Übertrag und Notizen entfernt. Ein erneuter Stundenplan-Import legt sie zwar wieder an, aber ohne die Planung."
      }
    />
  );
}
