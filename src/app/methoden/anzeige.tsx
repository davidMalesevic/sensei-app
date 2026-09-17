import { Badge } from "@/components/ui/badge";
import type { Herkunft } from "@/lib/methoden";

/** Kleine Anzeigebausteine, die Liste und Detailseite teilen. */

export function dauerText(m: { dauerMin: number; dauerMax: number }) {
  return m.dauerMin === m.dauerMax
    ? `${m.dauerMin} min`
    : `${m.dauerMin}–${m.dauerMax} min`;
}

const SCHWERPUNKT_FARBE = {
  aktivieren: "blue",
  erheben: "purple",
  beides: "teal",
} as const;

export function SchwerpunktTag({
  schwerpunkt,
  label,
}: {
  schwerpunkt: string;
  label?: string;
}) {
  const farbe =
    SCHWERPUNKT_FARBE[schwerpunkt as keyof typeof SCHWERPUNKT_FARBE] ??
    "cool-gray";
  return (
    <Badge variant={farbe} size="sm" title={label}>
      {schwerpunkt}
    </Badge>
  );
}

export function HerkunftTag({ herkunft }: { herkunft: Herkunft }) {
  if (herkunft === "fassung") {
    return (
      <Badge variant="magenta" size="sm" title="Du hast diese geteilte Methode angepasst">
        eigene Fassung
      </Badge>
    );
  }
  if (herkunft === "eigene") {
    return (
      <Badge variant="cyan" size="sm" title="Nur in deinem Konto">
        eigene
      </Badge>
    );
  }
  return null;
}

export function SozialformTags({
  sozialform,
  namen,
}: {
  sozialform: string[];
  namen: Record<string, string>;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {sozialform.map((s) => (
        <Badge key={s} variant="cool-gray" size="sm" title={namen[s]}>
          {s}
        </Badge>
      ))}
    </span>
  );
}
