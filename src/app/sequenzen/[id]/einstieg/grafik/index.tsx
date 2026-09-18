import Link from "next/link";
import { Download } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { DATEN_LABEL, leseDaten } from "@/lib/einstieg-daten";
import { Begriffsnetz } from "./begriffsnetz";
import { Diagramm } from "./diagramm";
import { Jeopardy } from "./jeopardy";
import { MemoryKarten, TabuKarten } from "./karten";
import { Kreuzwortraetsel } from "./kreuzwortraetsel";
import {
  Aussagen,
  DiagnostischeFragen,
  Quizfragen,
  Raetselkette,
  Vortest,
} from "./listen";
import { Mindmap } from "./mindmap";

/**
 * Aus `daten_json` wird hier das, was im Unterricht gebraucht wird.
 *
 * Der Methodenschlüssel bestimmt die Form, nicht die Antwort — was nicht zur
 * erwarteten Form passt, fällt in `leseDaten()` weg und wird gar nicht erst
 * halb dargestellt.
 */
export function Grafik({
  schluessel,
  datenJson,
  sequenzId,
}: {
  schluessel: string;
  datenJson: string;
  /** Für den Kahoot-Download; fehlt er, entfällt der Knopf. */
  sequenzId?: string;
}) {
  const daten = leseDaten(schluessel, datenJson);
  if (!daten) return null;

  return (
    <section className="mb-8 break-before-page">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b border-border-subtle pb-1">
        <h2 className="type-heading-03">{DATEN_LABEL[daten.art]}</h2>
        {daten.art === "quiz" && sequenzId && (
          <Button
            variant="outline"
            size="sm"
            className="print:hidden"
            render={
              <Link href={`/api/einstieg/${sequenzId}/kahoot`} prefetch={false} />
            }
          >
            Für Kahoot herunterladen
            <Download size={16} />
          </Button>
        )}
      </div>

      {daten.art === "mindmap" && <Mindmap daten={daten.daten} />}
      {daten.art === "begriffsnetz" && (
        <>
          <Begriffsnetz daten={daten.daten} />
          {daten.daten.fehlverbindungen.length > 0 && (
            <div className="mt-4">
              <h3 className="type-heading-compact-02">
                Häufige Fehlverbindungen — nur für dich
              </h3>
              <ul className="type-body-compact-02 mt-1 grid gap-1">
                {daten.daten.fehlverbindungen.map((f, i) => (
                  <li key={i}>
                    <span className="font-semibold">
                      {f.von} → {f.nach}
                    </span>{" "}
                    ({f.beschriftung}): {f.erklaerung}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {daten.art === "kreuzwortraetsel" && (
        <>
          <Kreuzwortraetsel daten={daten.daten} />
          <div className="break-before-page mt-8">
            <h3 className="type-heading-compact-02 mb-2">Lösung — nur für dich</h3>
            <Kreuzwortraetsel daten={daten.daten} loesung />
          </div>
        </>
      )}
      {daten.art === "memory" && <MemoryKarten daten={daten.daten} />}
      {daten.art === "tabu" && <TabuKarten daten={daten.daten} />}
      {daten.art === "jeopardy" && <Jeopardy daten={daten.daten} />}
      {daten.art === "advance_organizer" && <Diagramm code={daten.daten.mermaid} />}
      {daten.art === "aussagen" && <Aussagen daten={daten.daten} />}
      {daten.art === "quiz" && <Quizfragen daten={daten.daten} />}
      {daten.art === "diagnostische_mc" && <DiagnostischeFragen daten={daten.daten} />}
      {daten.art === "vortest" && <Vortest daten={daten.daten} />}
      {daten.art === "escape_room" && <Raetselkette daten={daten.daten} />}
    </section>
  );
}

/** Nur die Beschriftung — für den Hinweis im Ablauf. */
export function grafikLabel(schluessel: string, datenJson: string): string | null {
  const daten = leseDaten(schluessel, datenJson);
  return daten ? DATEN_LABEL[daten.art] : null;
}
