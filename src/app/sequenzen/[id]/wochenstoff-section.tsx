import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, ExternalLink } from "lucide-react";
import type { Wochenstoff } from "@/lib/modulbaum";

/**
 * Was in dieser Woche ansteht — aus dem Modulplan und dem Smartlearn-Baum
 * gerechnet, nicht von der KI erfunden. Original-Bezeichnungen bleiben stehen,
 * damit die Lehrperson «macht Aufgabe 4.2» sagen kann.
 */
export function WochenstoffSection({ stoff }: { stoff: Wochenstoff }) {
  if (stoff.ohneModulplan) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenCheck className="h-4 w-4" />
            Stoff dieser Woche
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Für KW {stoff.kw} gibt es keinen Modulplan-Eintrag. Ohne ihn ist
            nicht bestimmbar, welcher Block ansteht.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenCheck className="h-4 w-4" />
          Stoff dieser Woche
          <Badge variant="outline" className="ml-1">
            KW {stoff.kw}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {stoff.ziel && <p className="text-sm">{stoff.ziel}</p>}

        {stoff.lbHinweis && (
          <div className="text-sm rounded-md bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 px-3 py-2">
            Leistungsbeurteilung: {stoff.lbHinweis}
          </div>
        )}

        {stoff.bloecke.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Kein Aufgabenbaum hinterlegt — er entsteht beim Import des
            Smartlearn-Exports im Modul.
          </p>
        ) : (
          stoff.bloecke.map((b) => (
            <div key={b.nummer} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  Block {String(b.nummer).padStart(2, "0")}
                </Badge>
                <span className="text-sm font-medium">{b.titel}</span>
                {b.slides?.href && (
                  <a
                    href={b.slides.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    {b.slides.titel}
                    {b.slides.von !== null && (
                      <>
                        {" "}
                        Slide {b.slides.von}
                        {b.slides.bis !== null && `–${b.slides.bis}`}
                      </>
                    )}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {b.auftraege.map((a) => (
                <div key={a.code} className="pl-1 space-y-1">
                  <code className="text-xs text-muted-foreground">{a.code}</code>
                  <ul className="space-y-1">
                    {a.aufgaben.map((auf) => (
                      <li key={auf.bezeichnung} className="text-sm">
                        <span className="font-medium">{auf.bezeichnung}</span>
                        {auf.teilaufgaben.length > 0 && (
                          <span className="text-muted-foreground">
                            {" · "}
                            {auf.teilaufgaben
                              .map((t) => t.bezeichnung)
                              .join(", ")}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
