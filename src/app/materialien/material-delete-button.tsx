"use client";

import { DeleteButton } from "@/components/delete-button";
import { deleteMaterial } from "./actions";

export function MaterialDeleteButton({
  id,
  titel,
}: {
  id: string;
  titel?: string;
}) {
  return (
    <DeleteButton
      onDelete={() => deleteMaterial(id)}
      titel="Material löschen"
      beschreibung={
        titel
          ? `«${titel}» wird entfernt, samt der daraus gelesenen Aufgaben.`
          : "Das Material wird entfernt, samt der daraus gelesenen Aufgaben."
      }
    />
  );
}
