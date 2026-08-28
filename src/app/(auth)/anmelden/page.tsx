import { redirect } from "next/navigation";

import { aktuelleSession } from "@/lib/dal";
import { AnmeldungRahmen } from "../anmeldung-rahmen";
import { AnmeldeFormular } from "./anmelde-formular";

export const dynamic = "force-dynamic";

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  // Hier — nicht im Proxy — wird geprüft, ob wirklich eine gültige Sitzung
  // besteht. Ein abgelaufenes Cookie führt so zum Formular statt in eine
  // Weiterleitungsschleife.
  if (await aktuelleSession()) redirect("/");

  const { weiter } = await searchParams;

  return (
    <AnmeldungRahmen
      titel="Anmelden"
      untertitel="Deine Klassen, Sequenzen und Module liegen hinter dieser Tür."
      fussnote={
        <>
          Noch kein Konto? Sensei ist nur auf Einladung zugänglich — frag die
          Person, die es betreibt, nach einem Einladungslink.
        </>
      }
    >
      <AnmeldeFormular weiter={weiter ?? "/"} />
    </AnmeldungRahmen>
  );
}
