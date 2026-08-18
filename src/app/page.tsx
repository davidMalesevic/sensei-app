import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Layers, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";

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

export default function DashboardPage() {
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
    </div>
  );
}
