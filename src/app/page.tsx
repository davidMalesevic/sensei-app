import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Layers,
  BookOpen,
  GraduationCap,
  Clock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { gte, asc, sql } from "drizzle-orm";
import { lektionsblock } from "@/db/schema";

const quickLinks = [
  {
    title: "Semester",
    description: "Semester und Kalender verwalten",
    href: "/semester",
    icon: Calendar,
  },
  {
    title: "Klassen",
    description: "Klassen anlegen und verwalten",
    href: "/klassen",
    icon: GraduationCap,
  },
  {
    title: "Sequenzen",
    description: "Unterrichtssequenzen planen",
    href: "/sequenzen",
    icon: Layers,
  },
  {
    title: "Bildungsplan",
    description: "Handlungskompetenzen einsehen",
    href: "/bildungsplan",
    icon: BookOpen,
  },
];

async function getUpcomingBlocks() {
  const today = new Date().toISOString().split("T")[0];

  return db.query.lektionsblock.findMany({
    where: gte(lektionsblock.datum, today),
    orderBy: [asc(lektionsblock.datum), asc(lektionsblock.sortierung)],
    limit: 10,
    with: {
      sequenz: {
        columns: { id: true, titel: true },
        with: {
          klasse: { columns: { bezeichnung: true } },
          modul: { columns: { nummer: true } },
        },
      },
      phasen: {
        orderBy: (p, { asc }) => [asc(p.sortierung)],
        columns: { bezeichnung: true, dauerMinuten: true },
      },
    },
  });
}

async function getStats() {
  const [sequenzenCount, klassenCount, semesterCount] = await Promise.all([
    db.query.sequenz.findMany({ columns: { id: true } }),
    db.query.klasse.findMany({ columns: { id: true } }),
    db.query.semester.findMany({ columns: { id: true } }),
  ]);
  return {
    sequenzen: sequenzenCount.length,
    klassen: klassenCount.length,
    semester: semesterCount.length,
  };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function daysLabel(days: number): string {
  if (days === 0) return "Heute";
  if (days === 1) return "Morgen";
  return `In ${days} Tagen`;
}

export default async function DashboardPage() {
  const [upcoming, stats] = await Promise.all([
    getUpcomingBlocks(),
    getStats(),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Sensei</h1>
        <p className="text-muted-foreground mt-2 text-[15px] max-w-lg">
          Planungstool für strukturierte Unterrichtssequenzen an der
          Berufsfachschule.
        </p>
      </div>

      <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-4 border border-border">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className="group">
            <div className="bg-card p-6 h-full transition-colors group-hover:bg-accent/50">
              <link.icon className="h-5 w-5 text-primary mb-4" />
              <h2 className="text-sm font-semibold tracking-tight">
                {link.title}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {link.description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Bevorstehende Lektionsblöcke
            </h2>
            <Link
              href="/sequenzen"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              Alle Sequenzen
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="border border-border divide-y divide-border">
            {upcoming.map((block) => {
              const days = block.datum ? daysUntil(block.datum) : null;
              const totalMin = block.phasen.reduce(
                (sum, p) => sum + (p.dauerMinuten ?? 0),
                0
              );
              return (
                <Link
                  key={block.id}
                  href={`/sequenzen/${block.sequenz.id}`}
                  className="flex items-center gap-4 p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="w-20 shrink-0">
                    <div className="text-sm font-semibold">
                      {block.datum ? formatDate(block.datum) : "–"}
                    </div>
                    {days !== null && (
                      <div
                        className={`text-xs ${days === 0 ? "text-primary font-medium" : "text-muted-foreground"}`}
                      >
                        {daysLabel(days)}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {block.thema ?? block.sequenz.titel}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {block.sequenz.titel} · {block.sequenz.klasse.bezeichnung}
                      {block.sequenz.modul && ` · M${block.sequenz.modul.nummer}`}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline">{block.blockTyp}-Block</Badge>
                    {totalMin > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {totalMin} Min.
                      </span>
                    )}
                    {block.phasen.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {block.phasen.length} Phasen
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-px bg-border md:grid-cols-3 border border-border">
        <div className="bg-card p-6">
          <div className="text-xs text-muted-foreground uppercase tracking-[0.15em]">
            Sequenzen
          </div>
          <div className="text-3xl font-bold mt-1">{stats.sequenzen}</div>
        </div>
        <div className="bg-card p-6">
          <div className="text-xs text-muted-foreground uppercase tracking-[0.15em]">
            Klassen
          </div>
          <div className="text-3xl font-bold mt-1">{stats.klassen}</div>
        </div>
        <div className="bg-card p-6">
          <div className="text-xs text-muted-foreground uppercase tracking-[0.15em]">
            Semester
          </div>
          <div className="text-3xl font-bold mt-1">{stats.semester}</div>
        </div>
      </div>
    </div>
  );
}
