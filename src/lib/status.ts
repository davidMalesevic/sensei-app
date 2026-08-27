/**
 * Der Stand einer Sequenz als Carbon-Tag.
 * Farben ordnen zu, sie werten nicht: Blau = in Arbeit, Grün = durchgesehen,
 * Grau = vorbei, Umriss = es gibt noch nichts.
 */
export const STATUS_TAG: Record<
  string,
  { label: string; variant: "outline" | "blue" | "green" | "gray" }
> = {
  leer: { label: "kein Ablauf", variant: "outline" },
  entwurf: { label: "Entwurf", variant: "blue" },
  bestaetigt: { label: "bestätigt", variant: "green" },
  gehalten: { label: "gehalten", variant: "gray" },
};

export function statusTag(status: string) {
  return STATUS_TAG[status] ?? { label: status, variant: "outline" as const };
}
