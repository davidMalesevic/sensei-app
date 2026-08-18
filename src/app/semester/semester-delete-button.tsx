"use client";

import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteSemester } from "./actions";

export function SemesterDeleteButton({ id }: { id: string }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        if (confirm("Semester wirklich löschen?")) {
          await deleteSemester(id);
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
