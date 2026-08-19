"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Klasse = {
  id: string;
  bezeichnung: string;
};

export function KlasseFilter({ klassen }: { klassen: Klasse[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentKlasse = searchParams.get("klasse") ?? "alle";

  return (
    <Select
      value={currentKlasse}
      onValueChange={(val) => {
        if (val === "alle") {
          router.push("/bildungsplan");
        } else {
          router.push(`/bildungsplan?klasse=${val}`);
        }
      }}
      items={{
        alle: "Alle Klassen",
        ...Object.fromEntries(
          klassen.map((k) => [k.id, k.bezeichnung])
        ),
      }}
    >
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Alle Klassen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="alle">Alle Klassen</SelectItem>
        {klassen.map((k) => (
          <SelectItem key={k.id} value={k.id}>
            {k.bezeichnung}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
