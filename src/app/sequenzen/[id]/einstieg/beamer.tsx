"use client";

import { useEffect, useState } from "react";
import { Close, PresentationFile } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";

/**
 * Der Arbeitsauftrag gross an der Wand.
 *
 * Kein eigener Pfad, sondern eine Schicht über der Seite: Beamer anschliessen,
 * Knopf drücken, fertig — ein Seitenwechsel würde im Unterricht die Ansicht
 * verlieren, an der man gerade steht. Escape schliesst.
 */
export function Beamer({
  titel,
  arbeitsauftrag,
}: {
  titel: string;
  arbeitsauftrag: string;
}) {
  const [offen, setzeOffen] = useState(false);

  useEffect(() => {
    if (!offen) return;
    const zu = (e: KeyboardEvent) => {
      if (e.key === "Escape") setzeOffen(false);
    };
    window.addEventListener("keydown", zu);
    return () => window.removeEventListener("keydown", zu);
  }, [offen]);

  return (
    <>
      <Button variant="secondary" onClick={() => setzeOffen(true)}>
        An die Wand
        <PresentationFile size={16} />
      </Button>

      {offen && (
        <div
          className="fixed inset-0 z-100 overflow-auto bg-background p-12 print:hidden"
          role="dialog"
          aria-label="Arbeitsauftrag projizieren"
        >
          <Button
            variant="ghost-neutral"
            size="icon"
            aria-label="Schliessen"
            className="fixed top-4 right-4"
            onClick={() => setzeOffen(false)}
          >
            <Close size={20} />
          </Button>
          <div className="mx-auto max-w-5xl">
            <h1 className="type-heading-05 mb-8">{titel}</h1>
            {/* 28px: aus der letzten Reihe lesbar, ohne dass ein Auftrag von
                zehn Zeilen über den Rand läuft. */}
            <pre className="type-heading-04 whitespace-pre-wrap font-sans leading-relaxed">
              {arbeitsauftrag}
            </pre>
          </div>
        </div>
      )}
    </>
  );
}
