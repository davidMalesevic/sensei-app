import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ListOrdered,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  Briefcase,
  Presentation,
  ClipboardList,
  MessagesSquare,
  Flag,
  Circle,
} from "lucide-react";
import { erzeugeEntwurf, bestaetigeAblauf } from "../entwurf-actions";
import { materialHref } from "@/lib/material-link";

export type AblaufZeile = {
  id: string;
  sortierung: number;
  typ: string;
  quelle: string;
  titel: string;
  text: string | null;
  refCode: string | null;
  refAufgabe: string | null;
  refSeiteVon: number | null;
  refSeiteBis: number | null;
  refMaterial: {
    id: string;
    titel: string;
    dateiPfad: string | null;
    url: string | null;
  } | null;
};

const TYP_ICON: Record<string, typeof Circle> = {
  einstieg: Lightbulb,
  praxisbezug: Briefcase,
  theorie: Presentation,
  aufgabe: ClipboardList,
  besprechung: MessagesSquare,
  abschluss: Flag,
  frei: Circle,
};

const TYP_LABEL: Record<string, string> = {
  einstieg: "Einstieg",
  praxisbezug: "Praxisbezug",
  theorie: "Theorie",
  aufgabe: "Aufgabe",
  besprechung: "Besprechung",
  abschluss: "Abschluss",
  frei: "Frei",
};

/**
 * Der Ablauf — das eigentliche Arbeitsergebnis. Fakten aus dem Material sind
 * von KI-Vorschlägen unterscheidbar markiert; erweist sich die Markierung als
 * Lärm, fliegt sie wieder raus.
 */
export function AblaufSection({
  sequenzId,
  status,
  entwurfAm,
  zeilen,
}: {
  sequenzId: string;
  status: string;
  entwurfAm: Date | null;
  zeilen: AblaufZeile[];
}) {
  const erzeugen = async () => {
    "use server";
    await erzeugeEntwurf(sequenzId, { force: true });
  };
  const bestaetigen = bestaetigeAblauf.bind(null, sequenzId);

  const bestaetigt = status === "bestaetigt";

  return (
    <Card className={bestaetigt ? undefined : "border-primary/40"}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <ListOrdered className="h-4 w-4" />
          Ablauf
          {zeilen.length > 0 &&
            (bestaetigt ? (
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-3 w-3" />
                bestätigt
              </Badge>
            ) : (
              <Badge variant="secondary">Entwurf, ungeprüft</Badge>
            ))}
          {entwurfAm && (
            <span className="text-xs font-normal text-muted-foreground">
              erzeugt {entwurfAm.toLocaleDateString("de-CH")}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {zeilen.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Noch kein Ablauf. Der Nachtlauf erzeugt ihn für anstehende
              Sequenzen — hier kannst du ihn sofort anstossen.
            </p>
            <form action={erzeugen}>
              <Button type="submit">
                <Sparkles className="h-4 w-4" />
                Entwurf erzeugen
              </Button>
            </form>
          </>
        ) : (
          <>
            <ol className="space-y-2">
              {zeilen.map((z, i) => {
                const Icon = TYP_ICON[z.typ] ?? Circle;
                const fakt = z.quelle === "fakt";
                const href = z.refMaterial
                  ? materialHref(
                      z.refMaterial,
                      z.refSeiteVon !== null ? `Slide ${z.refSeiteVon}` : null
                    )
                  : null;

                return (
                  <li
                    key={z.id}
                    className="flex gap-3 rounded-md border px-3 py-2"
                  >
                    <span className="text-xs text-muted-foreground tabular-nums pt-0.5 w-4 shrink-0">
                      {i + 1}
                    </span>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{z.titel}</span>
                        <Badge
                          variant={fakt ? "outline" : "secondary"}
                          className="text-[10px] font-normal"
                        >
                          {fakt ? "aus dem Material" : "KI-Vorschlag"}
                        </Badge>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {TYP_LABEL[z.typ] ?? z.typ}
                        </span>
                      </div>
                      {z.text && (
                        <p className="text-sm text-muted-foreground">{z.text}</p>
                      )}
                      {(z.refCode || href) && (
                        <div className="flex flex-wrap items-center gap-2">
                          {z.refCode && (
                            <code className="text-[11px] text-muted-foreground">
                              {z.refCode}
                            </code>
                          )}
                          {href && (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            >
                              {z.refMaterial?.titel}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="flex flex-wrap items-center gap-2">
              {!bestaetigt && (
                <form action={bestaetigen}>
                  <Button type="submit">
                    <CheckCircle2 className="h-4 w-4" />
                    Passt
                  </Button>
                </form>
              )}
              <form action={erzeugen}>
                <Button type="submit" variant="outline">
                  <Sparkles className="h-4 w-4" />
                  Neu erzeugen
                </Button>
              </form>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
