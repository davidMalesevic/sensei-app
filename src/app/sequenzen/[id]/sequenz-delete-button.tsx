"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteSequenz } from "../actions";

export function SequenzDeleteButton({ id }: { id: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        if (confirm("Sequenz wirklich löschen? Alle Lektionsblöcke und Phasen werden ebenfalls gelöscht.")) {
          await deleteSequenz(id);
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
