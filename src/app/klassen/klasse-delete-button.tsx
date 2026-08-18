"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteKlasse } from "./actions";

export function KlasseDeleteButton({ id }: { id: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        if (confirm("Klasse wirklich löschen?")) {
          await deleteKlasse(id);
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
