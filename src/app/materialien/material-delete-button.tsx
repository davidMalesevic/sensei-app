"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteMaterial } from "./actions";

export function MaterialDeleteButton({ id }: { id: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        if (confirm("Material löschen?")) {
          await deleteMaterial(id);
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
