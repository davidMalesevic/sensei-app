import Link from "next/link";
import { LayoutList, Gauge } from "lucide-react";

export type Ansicht = "planung" | "cockpit";

/**
 * Umschalter zwischen der detaillierten Planungsansicht und dem Cockpit.
 * Bewusst über einen Query-Parameter, damit die Seite Server-Component bleibt.
 */
export function AnsichtToggle({
  sequenzId,
  aktiv,
}: {
  sequenzId: string;
  aktiv: Ansicht;
}) {
  const optionen: { wert: Ansicht; label: string; icon: typeof Gauge }[] = [
    { wert: "planung", label: "Planung", icon: LayoutList },
    { wert: "cockpit", label: "Cockpit", icon: Gauge },
  ];

  return (
    <div className="inline-flex rounded-lg border p-0.5">
      {optionen.map(({ wert, label, icon: Icon }) => {
        const istAktiv = wert === aktiv;
        return (
          <Link
            key={wert}
            href={
              wert === "planung"
                ? `/sequenzen/${sequenzId}`
                : `/sequenzen/${sequenzId}?ansicht=cockpit`
            }
            scroll={false}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              istAktiv
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
