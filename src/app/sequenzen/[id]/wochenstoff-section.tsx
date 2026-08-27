import { Launch } from "@carbon/icons-react";

import { Badge } from "@/components/ui/badge";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import type { Wochenstoff } from "@/lib/modulbaum";

/**
 * Was in dieser Woche ansteht — aus dem Modulplan und dem Smartlearn-Baum
 * gerechnet, nicht von der KI erfunden. Original-Bezeichnungen bleiben stehen,
 * damit die Lehrperson «macht Aufgabe 4.2» sagen kann.
 */
export function WochenstoffSection({ stoff }: { stoff: Wochenstoff }) {
  if (stoff.ohneModulplan) {
    return (
      <section className="mb-12">
        <SectionHeader titel="Stoff dieser Woche" />
        <Notification kind="info" titel={`Kein Modulplan-Eintrag für KW ${stoff.kw}`}>
          Ohne ihn ist nicht bestimmbar, welcher Block ansteht.
        </Notification>
      </section>
    );
  }

  return (
    <section className="mb-12">
      <SectionHeader
        titel="Stoff dieser Woche"
        beschreibung={stoff.ziel ?? undefined}
        aktionen={<Badge variant="cool-gray">KW {stoff.kw}</Badge>}
      />

      {stoff.lbHinweis && (
        <Notification kind="warning" titel="Leistungsbeurteilung" className="mb-4">
          {stoff.lbHinweis}
        </Notification>
      )}

      {stoff.bloecke.length === 0 ? (
        <p className="type-body-02 bg-layer p-6 text-text-secondary">
          Kein Aufgabenbaum hinterlegt — er entsteht beim Import des
          Smartlearn-Exports im Modul.
        </p>
      ) : (
        <div className="space-y-px">
          {stoff.bloecke.map((b) => (
            <div key={b.schluessel} className="bg-layer">
              {/* Blockkopf: eigene Fläche, damit die Hierarchie sichtbar bleibt */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-strong bg-layer-accent px-4 py-3">
                <Badge variant="high-contrast" size="sm">
                  Block {b.schluessel}
                </Badge>
                <span className="type-heading-compact-02 min-w-0 flex-1 text-foreground">
                  {b.titel}
                </span>
                {b.slides?.href && (
                  <a
                    href={b.slides.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-body-compact-02 inline-flex items-center gap-2 text-link underline-offset-2 hover:underline"
                  >
                    {b.slides.titel}
                    {b.slides.von !== null && (
                      <>
                        {" "}
                        Slide {b.slides.von}
                        {b.slides.bis !== null && `–${b.slides.bis}`}
                      </>
                    )}
                    <Launch size={16} />
                  </a>
                )}
              </div>

              {b.auftraege.map((a) => (
                <div
                  key={a.code}
                  className="border-b border-border-subtle px-4 py-3 last:border-b-0"
                >
                  <code className="type-helper-02 font-mono text-text-helper">
                    {a.code}
                  </code>
                  <ul className="mt-2 space-y-2">
                    {a.aufgaben.map((auf) => (
                      <li key={auf.bezeichnung} className="type-body-02">
                        <span className="type-heading-compact-02 text-foreground">
                          {auf.bezeichnung}
                        </span>
                        {auf.teilaufgaben.length > 0 && (
                          <span className="text-text-secondary">
                            {" · "}
                            {auf.teilaufgaben.map((t) => t.bezeichnung).join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
