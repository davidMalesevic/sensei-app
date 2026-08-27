"use client";

import { DeleteButton } from "@/components/delete-button";
import { deleteKlasse } from "./actions";

export function KlasseDeleteButton({
  id,
  bezeichnung,
}: {
  id: string;
  bezeichnung?: string;
}) {
  return (
    <DeleteButton
      onDelete={() => deleteKlasse(id)}
      titel="Klasse löschen"
      beschreibung={
        bezeichnung
          ? `«${bezeichnung}» wird mit allen Pendenzen entfernt. Das lässt sich nicht rückgängig machen.`
          : "Die Klasse wird mit allen Pendenzen entfernt. Das lässt sich nicht rückgängig machen."
      }
    />
  );
}
