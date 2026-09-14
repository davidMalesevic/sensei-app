"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Add } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createPendenz } from "@/app/klassen/actions";

/**
 * Eine Pendenz erfassen. Steht an zwei Stellen: in der Kontext-Kachel, solange
 * es Pendenzen gibt, und im Übertrag nach der Lektion — dort, wo man weiss,
 * was für nächste Woche vorzumerken ist. Vorher war die Kachel der einzige
 * Eingang; blendet man sie im Leerzustand aus, gäbe es gar keinen mehr.
 */
export function PendenzForm({
  klasseId,
  inputId,
  placeholder = "Neue Pendenz…",
  className,
}: {
  klasseId: string;
  inputId?: string;
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");

  return (
    <form
      action={async (formData) => {
        await createPendenz(formData);
        setText("");
        // `createPendenz` revalidiert /klassen und /sequenzen, nicht aber
        // diese Detailseite — ohne Refresh bliebe die neue Pendenz unsichtbar.
        router.refresh();
      }}
      className={cn("flex", className)}
    >
      <input type="hidden" name="klasseId" value={klasseId} />
      <Input
        id={inputId}
        name="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10"
        required
      />
      <Button
        type="submit"
        size="icon-sm"
        aria-label="Pendenz hinzufügen"
        className="shrink-0"
      >
        <Add size={16} />
      </Button>
    </form>
  );
}
