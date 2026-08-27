import Link from "next/link";
import { ArrowRight } from "@carbon/icons-react";

import { StundenplanImport } from "./import-form";
import { getStundenplanUebersicht } from "./actions";
import { getOffeneUebertraege } from "@/app/sequenzen/uebertrag-actions";
import { EntwuerfeButton } from "./entwuerfe-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notification } from "@/components/ui/notification";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { getKWFromDateString } from "@/lib/kw";
import { findeAktuelle, schweizerHeute, schweizerJetzt } from "@/lib/zeit";
import { statusTag } from "@/lib/status";

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
  const [{ eintraege, aliasse }, offen] = await Promise.all([
    getStundenplanUebersicht(),
    getOffeneUebertraege(),
  ]);

  const jetzt = schweizerJetzt();
  const heute = schweizerHeute();
  const kommende = eintraege.filter((e) => (e.startDatum ?? "") >= heute);

  // Die laufende Lektion hervorheben — sonst sucht man sie in der Liste.
  const { laufend, naechste } = findeAktuelle(kommende, jetzt);
  const hervorgehoben = laufend ?? naechste;

  const nachWoche = new Map<number, typeof eintraege>();
  for (const e of kommende) {
    const kw = getKWFromDateString(e.startDatum) ?? 0;
    if (!nachWoche.has(kw)) nachWoche.set(kw, []);
    nachWoche.get(kw)!.push(e);
  }
  const wochen = [...nachWoche.entries()].slice(0, 4);

  return (
    <>
      <PageHeader
        titel="Stundenplan"
        beschreibung="Sequenzen entstehen aus dem WebUntis-Export — Klasse, Modul, Datum, Zeit und Raum werden nicht eingetippt."
      />

      {offen.length > 0 && (
        <div className="mb-12">
          <Notification
            kind="error"
            titel={`${offen.length} Lektionen ohne Übertrag`}
          >
            Ohne den Stand fehlt der Folgewoche der Ausgangspunkt.
          </Notification>
          <div className="bg-layer">
            {offen.slice(0, 8).map((o) => (
              <Link
                key={o.id}
                href={`/sequenzen/${o.id}`}
                className="type-body-compact-02 flex items-center gap-4 border-b border-border-subtle px-4 py-3 transition-colors duration-[110ms] ease-carbon-standard last:border-b-0 hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                <span className="w-24 shrink-0 text-text-secondary">
                  {formatiereTag(o.startDatum!)}
                </span>
                <span className="w-28 shrink-0 font-semibold">{o.klasse}</span>
                <span className="text-text-secondary">
                  {o.modulNummer ? `Modul ${o.modulNummer}` : "—"}
                </span>
                <ArrowRight size={16} className="ml-auto shrink-0 text-primary" />
              </Link>
            ))}
            {offen.length > 8 && (
              <p className="type-helper-02 px-4 py-2 text-text-helper">
                … und {offen.length - 8} weitere
              </p>
            )}
          </div>
        </div>
      )}

      <StundenplanImport />

      {eintraege.length > 0 && (
        <section className="mb-12">
          <SectionHeader
            titel="Anstehende Wochen"
            beschreibung={`${eintraege.length} Sequenzen importiert, davon ${kommende.length} noch anstehend.`}
            aktionen={
              kommende.length > 0 ? (
                <Button variant="ghost" size="sm" render={<Link href="/sequenzen" />}>
                  Alle Sequenzen
                  <ArrowRight size={16} />
                </Button>
              ) : undefined
            }
          />

          <div className="mb-8">
            <EntwuerfeButton />
          </div>

          {wochen.length === 0 ? (
            <p className="type-body-02 bg-layer p-6 text-text-secondary">
              Keine anstehenden Sequenzen.
            </p>
          ) : (
            <div className="space-y-8">
              {wochen.map(([kw, liste]) => (
                <div key={kw}>
                  <div className="type-heading-compact-02 mb-2 border-b border-border-strong pb-2 text-foreground">
                    KW {kw}
                  </div>
                  <div className="bg-layer">
                    {liste.map((e) => {
                      const aktiv = e.id === hervorgehoben?.id;
                      return (
                        <Link
                          key={e.id}
                          href={`/sequenzen/${e.id}`}
                          className={`type-body-compact-02 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-subtle px-4 py-3 transition-colors duration-[110ms] ease-carbon-standard last:border-b-0 hover:bg-layer-hover focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)] ${
                            aktiv
                              ? "border-l-[3px] border-l-border-interactive bg-layer-selected pl-[13px]"
                              : ""
                          }`}
                        >
                          <span className="w-24 shrink-0 text-text-secondary">
                            {formatiereTag(e.startDatum!)}
                          </span>
                          <span className="w-28 shrink-0 tabular-nums text-text-secondary">
                            {e.startZeit}–{e.endZeit}
                          </span>
                          <span className="w-28 shrink-0 font-semibold">
                            {e.klasse.bezeichnung}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-text-secondary">
                            {e.modul ? `Modul ${e.modul.nummer}` : "—"}
                          </span>
                          {aktiv && (
                            <Badge variant="blue" size="sm">
                              {laufend ? "jetzt" : "als nächstes"}
                            </Badge>
                          )}
                          <Badge variant="ghost" size="sm">
                            {e.lektionen} Lekt.
                          </Badge>
                          <Badge variant={statusTag(e.status).variant} size="sm">
                            {statusTag(e.status).label}
                          </Badge>
                          <span className="w-16 shrink-0 text-right text-text-secondary">
                            {e.raum}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {aliasse.length > 0 && (
        <section>
          <SectionHeader
            titel="Gespeicherte Zuordnungen"
            beschreibung="Kürzel aus dem Kalender und die Klasse, die sie in Sensei meinen."
          />
          <div className="bg-layer">
            {aliasse.map((a) => (
              <div
                key={a.kuerzel}
                className="type-body-compact-02 flex items-center gap-4 border-b border-border-subtle px-4 py-2 last:border-b-0"
              >
                <code className="font-mono text-sm text-text-secondary">
                  {a.kuerzel}
                </code>
                <ArrowRight size={16} className="shrink-0 text-text-helper" />
                <span className="font-semibold">{a.bezeichnung}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
