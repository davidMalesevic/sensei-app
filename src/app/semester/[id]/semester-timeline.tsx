"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type KalenderEintrag = {
  id: string;
  bezeichnung: string;
  typ: "feiertag" | "ferien" | "pruefung" | "sonstiges";
  startDatum: string;
  endDatum: string;
};

type Sequenz = {
  id: string;
  titel: string;
  klasse: { bezeichnung: string };
  lektionsbloecke: {
    id: string;
    datum: string | null;
    blockTyp: "2er" | "4er";
    thema: string | null;
  }[];
};

type Week = {
  start: Date;
  end: Date;
  weekNum: number;
  eintraege: KalenderEintrag[];
  bloecke: { sequenz: Sequenz; block: Sequenz["lektionsbloecke"][number] }[];
};

const typColors: Record<string, string> = {
  feiertag: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  ferien: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  pruefung: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  sonstiges: "bg-gray-100 text-gray-800 dark:bg-gray-950 dark:text-gray-300",
};

const typLabels: Record<string, string> = {
  feiertag: "Feiertag",
  ferien: "Ferien",
  pruefung: "Prüfung",
  sonstiges: "Sonstiges",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getISOWeek(d: Date): number {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}

function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function rangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function formatWeekRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${start.toLocaleDateString("de-CH", opts)} – ${end.toLocaleDateString("de-CH", opts)}`;
}

export function SemesterTimeline({
  startDatum,
  endDatum,
  kalenderEintraege,
  sequenzen,
}: {
  startDatum: string;
  endDatum: string;
  kalenderEintraege: KalenderEintrag[];
  sequenzen: Sequenz[];
}) {
  const semStart = new Date(startDatum);
  const semEnd = new Date(endDatum);

  const weeks: Week[] = [];
  let current = getMonday(semStart);

  while (current <= semEnd) {
    const weekStart = new Date(current);
    const weekEnd = new Date(current);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const eintraege = kalenderEintraege.filter((ke) =>
      rangesOverlap(ke.startDatum, ke.endDatum, weekStartStr, weekEndStr)
    );

    const bloecke: Week["bloecke"] = [];
    for (const seq of sequenzen) {
      for (const block of seq.lektionsbloecke) {
        if (
          block.datum &&
          dateInRange(block.datum, weekStartStr, weekEndStr)
        ) {
          bloecke.push({ sequenz: seq, block });
        }
      }
    }

    weeks.push({
      start: weekStart,
      end: weekEnd,
      weekNum: getISOWeek(weekStart),
      eintraege,
      bloecke,
    });

    current.setDate(current.getDate() + 7);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Semesterübersicht</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {weeks.map((week, i) => {
            const hasContent =
              week.eintraege.length > 0 || week.bloecke.length > 0;
            return (
              <div
                key={i}
                className={`flex items-start gap-3 py-2 px-2 rounded text-sm ${
                  hasContent ? "bg-muted/30" : ""
                }`}
              >
                <div className="w-12 shrink-0 text-muted-foreground font-mono text-xs pt-0.5">
                  KW {week.weekNum}
                </div>
                <div className="w-36 shrink-0 text-xs text-muted-foreground pt-0.5">
                  {formatWeekRange(week.start, week.end)}
                </div>
                <div className="flex-1 flex flex-wrap gap-1">
                  {week.eintraege.map((ke) => (
                    <span
                      key={ke.id}
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${typColors[ke.typ]}`}
                    >
                      {ke.bezeichnung}
                    </span>
                  ))}
                  {week.bloecke.map(({ sequenz: seq, block }) => (
                    <Badge key={block.id} variant="secondary" className="text-xs">
                      <Link
                        href={`/sequenzen/${seq.id}`}
                        className="hover:underline"
                      >
                        {block.thema ?? seq.titel} ({block.blockTyp}) –{" "}
                        {seq.klasse.bezeichnung}
                      </Link>
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
