"use client";

import { useEffect, useId, useState } from "react";

/**
 * Das Übersichtsdiagramm des Advance Organizers.
 *
 * Mermaid wird **erst hier nachgeladen** (dynamischer Import): die Bibliothek
 * ist gross, und die meisten Einstiege brauchen sie nie. Schlägt das Zeichnen
 * fehl — die KI schreibt durchaus mal ungültiges Mermaid —, steht der Code
 * da, statt dass die Seite leer bleibt.
 */
export function Diagramm({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [fehler, setFehler] = useState(false);
  // `useId()` statt Zufall: React vergibt die Kennung stabil, und Mermaid
  // braucht nur eine, die im Dokument einmalig ist.
  const id = `mermaid-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const dunkel = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: dunkel ? "dark" : "neutral",
          securityLevel: "strict",
        });
        const { svg } = await mermaid.render(id, code);
        if (!abgebrochen) setSvg(svg);
      } catch {
        if (!abgebrochen) setFehler(true);
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, [code, id]);

  if (fehler) {
    return (
      <div>
        <p className="type-helper-02 mb-2 text-text-helper">
          Das Diagramm liess sich nicht zeichnen — hier der Code, aus dem es
          entstehen sollte:
        </p>
        <pre className="type-body-compact-01 overflow-x-auto bg-layer p-3 font-mono">
          {code}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <p className="type-helper-02 text-text-helper">Diagramm wird gezeichnet…</p>
    );
  }

  // Das SVG stammt aus Mermaid, nicht aus der KI: Mermaid rendert den Code zu
  // einer Grafik und lässt bei `securityLevel: "strict"` kein Markup durch.
  return (
    <div
      className="[&_svg]:h-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
