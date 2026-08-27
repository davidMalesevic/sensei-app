"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { setzeMaterialBlock } from "./actions";
import type { BaumBlock } from "./modulbaum-section";

const GANZES_MODUL = "modul";

/**
 * Etikett am Material: gilt es fürs ganze Modul oder für genau einen Block?
 * Damit deckt ein Mechanismus beide Fälle ab — eine Präsentation pro Modul
 * (Slidebereiche kommen dann am Block) und eine Präsentation pro Block.
 */
export function MaterialBlockEtikett({
  materialId,
  blockNummer,
  bloecke,
}: {
  materialId: string;
  blockNummer: number | null;
  bloecke: BaumBlock[];
}) {
  const router = useRouter();
  const [speichert, startTransition] = useTransition();

  if (bloecke.length === 0) return null;

  const items: Record<string, string> = {
    [GANZES_MODUL]: "ganzes Modul",
    ...Object.fromEntries(
      bloecke.map((b) => [b.schluessel, `Block ${b.schluessel}`])
    ),
  };

  return (
    <Select
      value={blockNummer === null ? GANZES_MODUL : String(blockNummer)}
      onValueChange={(v) => {
        const wert = String(v);
        startTransition(async () => {
          await setzeMaterialBlock(
            materialId,
            wert === GANZES_MODUL ? null : Number(wert)
          );
          router.refresh();
        });
      }}
      items={items}
      disabled={speichert}
    >
      <SelectTrigger
        size="sm"
        className="w-40 shrink-0"
        aria-label="Etikett: ganzes Modul oder ein Block"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GANZES_MODUL}>ganzes Modul</SelectItem>
        {bloecke.map((b) => (
          <SelectItem key={b.id} value={b.schluessel}>
            Block {b.schluessel} – {b.titel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
