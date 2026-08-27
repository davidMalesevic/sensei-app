import { StundenplanImport } from "./import-form";
import { getStundenplanUebersicht } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getKWFromDateString } from "@/lib/kw";
import Link from "next/link";

// Die Seite zeigt den aktuellen Importstand — nicht den der Build-Zeit.
export const dynamic = "force-dynamic";

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function formatiereTag(datum: string): string {
  const d = new Date(datum + "T00:00:00");
  return `${WOCHENTAGE[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.`;
}

export default async function StundenplanPage() {
  const { eintraege, aliasse } = await getStundenplanUebersicht();

  const heute = new Date().toISOString().slice(0, 10);
  const kommende = eintraege.filter((e) => (e.startDatum ?? "") >= heute);

  const nachWoche = new Map<number, typeof eintraege>();
  for (const e of kommende) {
    const kw = getKWFromDateString(e.startDatum) ?? 0;
    if (!nachWoche.has(kw)) nachWoche.set(kw, []);
    nachWoche.get(kw)!.push(e);
  }
  const wochen = [...nachWoche.entries()].slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Stundenplan</h1>
        <p className="text-muted-foreground mt-1">
          Sequenzen entstehen aus dem WebUntis-Export — Klasse, Modul, Datum,
          Zeit und Raum werden nicht eingetippt.
        </p>
      </div>

      <StundenplanImport />

      {eintraege.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Importiert · {eintraege.length} Sequenzen, davon {kommende.length}{" "}
              noch anstehend
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {wochen.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine anstehenden Sequenzen.
              </p>
            ) : (
              wochen.map(([kw, liste]) => (
                <div key={kw} className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    KW {kw}
                  </div>
                  <div className="space-y-1">
                    {liste.map((e) => (
                      <Link
                        key={e.id}
                        href={`/sequenzen/${e.id}`}
                        className="flex items-center gap-3 text-sm rounded-md px-2 py-1.5 hover:bg-muted"
                      >
                        <span className="w-20 shrink-0 text-muted-foreground">
                          {formatiereTag(e.startDatum!)}
                        </span>
                        <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                          {e.startZeit}–{e.endZeit}
                        </span>
                        <Badge variant="outline" className="shrink-0">
                          {e.lektionen} Lekt.
                        </Badge>
                        <span className="w-24 shrink-0 font-medium">
                          {e.klasse.bezeichnung}
                        </span>
                        <span className="truncate">
                          {e.modul ? `Modul ${e.modul.nummer}` : "—"}
                        </span>
                        <span className="ml-auto shrink-0 text-muted-foreground">
                          {e.raum}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}

            {kommende.length > 0 && (
              <Button variant="outline" render={<Link href="/sequenzen" />}>
                Alle Sequenzen
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {aliasse.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Gespeicherte Zuordnungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {aliasse.map((a) => (
              <div key={a.kuerzel} className="flex items-center gap-3 text-sm">
                <code className="text-xs">{a.kuerzel}</code>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{a.bezeichnung}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
