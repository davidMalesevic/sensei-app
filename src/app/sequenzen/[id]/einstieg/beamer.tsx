"use client";

import { useEffect, useState } from "react";
import { Close, PresentationFile } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";

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
            {/* Aus der letzten Reihe lesbar. Die Grössen stehen an den
                Kindern, nicht am Rahmen: der Darsteller setzt an jedem Absatz
                seine eigene Schriftklasse, eine am Rahmen käme nie an. */}
            <Markdown
              text={arbeitsauftrag}
              className="gap-6 leading-relaxed [&_h3]:text-[2.5rem] [&_h4]:text-[2rem] [&_li]:text-[1.75rem] [&_p]:text-[1.75rem] [&_td]:text-[1.5rem] [&_th]:text-[1.5rem]"
            />
          </div>
        </div>
      )}
    </>
  );
}
