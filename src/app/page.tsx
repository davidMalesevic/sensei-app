import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Layers,
  BookOpen,
  GraduationCap,
  ArrowRight,
  AlertCircle,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { and, asc, gte, isNotNull } from "drizzle-orm";
import { sequenz } from "@/db/schema";
import { getOffeneUebertraege } from "./sequenzen/uebertrag-actions";
import { getKWFromDateString } from "@/lib/kw";
import { findeAktuelle, schweizerHeute, schweizerJetzt } from "@/lib/zeit";

export const dynamic = "force-dynamic";

const quickLinks = [
  {
    title: "Stundenplan",
    description: "Sequenzen aus dem Kalender, Entwürfe anstossen",
    href: "/stundenplan",
    icon: CalendarDays,
  },
  {
    title: "Sequenzen",
    description: "Alle Unterrichtssequenzen",
    href: "/sequenzen",
    icon: Layers,
  },
  {
    title: "Bildungsplan",
    description: "Module, Modulpläne und Aufgabenbäume",
    href: "/bildungsplan",
    icon: BookOpen,
  },
  {
    title: "Klassen",
    description: "Klassen und Pendenzen",
    href: "/klassen",
    icon: GraduationCap,
  },
];

const STATUS_LABEL: Record<string, string> = {
  leer: "kein Ablauf",
  entwurf: "Entwurf",
  bestaetigt: "bestätigt",
  gehalten: "gehalten",
};

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function tag(datum: string): string {
  const d = new Date(datum + "T00:00:00");
  return `${WOCHENTAGE[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

/** Die nächsten Unterrichtstage — die Sequenz ist die Einheit, nicht der Block. */
async function getNaechsteSequenzen() {
  const heute = schweizerHeute();

  return db.query.sequenz.findMany({
    where: and(isNotNull(sequenz.kalenderKurs), gte(sequenz.startDatum, heute)),
    orderBy: [asc(sequenz.startDatum), asc(sequenz.startZeit)],
    limit: 8,
    columns: {
      id: true,
      titel: true,
      startDatum: true,
      startZeit: true,
      endZeit: true,
      lektionen: true,
      raum: true,
      status: true,
    },
    with: {
      klasse: { columns: { bezeichnung: true } },
      modul: { columns: { nummer: true } },
    },
  });
}

export default async function Dashboard() {
  const [naechste, offen] = await Promise.all([
    getNaechsteSequenzen(),
    getOffeneUebertraege(),
  ]);

  const jetzt = schweizerJetzt();
  const { laufend, naechste: kommend } = findeAktuelle(naechste, jetzt);
  const hervorgehoben = laufend ?? kommend;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sensei</h1>
        <p className="text-muted-foreground mt-1">
          Unterrichtsplanung für Berufsfachschulen
        </p>
      </div>

      {offen.length > 0 && (
        <Card className="border-red-300 dark:border-red-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-4 w-4 text-red-500" />
              {offen.length} Lektionen ohne Übertrag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">
              Ohne den Stand fehlt der Folgewoche der Ausgangspunkt.
            </p>
            <Button variant="outline" size="sm" render={<Link href="/stundenplan" />}>
              Ansehen
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {hervorgehoben && (
        <Link href={`/sequenzen/${hervorgehoben.id}`} className="block">
          <Card className="border-primary/50 hover:border-primary transition-colors">
            <CardContent className="py-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {laufend ? "Läuft gerade" : "Als nächstes"}
                <span className="normal-case tracking-normal">
                  · {jetzt.zeit} Uhr
                </span>
              </div>
              <div className="flex flex-wrap items-baseline gap-3 mt-2">
                <span className="text-2xl font-bold tracking-tight">
                  {hervorgehoben.klasse.bezeichnung}
                </span>
                <span className="text-lg text-muted-foreground">
                  {hervorgehoben.modul
                    ? `Modul ${hervorgehoben.modul.nummer}`
                    : "ohne Modul"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>
                  {hervorgehoben.startDatum ? tag(hervorgehoben.startDatum) : ""}{" "}
                  {hervorgehoben.startZeit}–{hervorgehoben.endZeit}
                </span>
                {hervorgehoben.raum && <span>· {hervorgehoben.raum}</span>}
                <Badge variant="outline" className="text-[10px] font-normal">
                  {STATUS_LABEL[hervorgehoben.status] ?? hervorgehoben.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nächste Sequenzen</CardTitle>
        </CardHeader>
        <CardContent>
          {naechste.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine anstehenden Sequenzen.{" "}
              <Link href="/stundenplan" className="underline">
                Stundenplan importieren
              </Link>
            </p>
          ) : (
            <div className="space-y-1">
              {naechste.map((s) => (
                <Link
                  key={s.id}
                  href={`/sequenzen/${s.id}`}
                  className={`flex flex-wrap items-center gap-3 text-sm rounded-md px-2 py-1.5 hover:bg-muted ${
                    s.id === hervorgehoben?.id ? "bg-primary/5 ring-1 ring-primary/30" : ""
                  }`}
                >
                  <span className="w-20 shrink-0 text-muted-foreground">
                    {s.startDatum ? tag(s.startDatum) : "—"}
                  </span>
                  <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                    {s.startZeit}–{s.endZeit}
                  </span>
                  <span className="w-24 shrink-0 font-medium">
                    {s.klasse.bezeichnung}
                  </span>
                  <span className="text-muted-foreground">
                    {s.modul ? `Modul ${s.modul.nummer}` : "—"}
                  </span>
                  <Badge
                    variant="outline"
                    className="ml-auto shrink-0 text-[10px] font-normal"
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0">
                    KW {getKWFromDateString(s.startDatum) ?? "—"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map((l) => (
          <Link key={l.href} href={l.href}>
            <Card className="h-full hover:bg-muted/50 transition-colors">
              <CardContent className="pt-6">
                <l.icon className="h-5 w-5 text-muted-foreground mb-2" />
                <p className="font-medium text-sm">{l.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {l.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
