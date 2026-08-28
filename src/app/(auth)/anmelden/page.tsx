import Link from "next/link";

import { AnmeldungRahmen } from "../anmeldung-rahmen";
import { AnmeldeFormular } from "./anmelde-formular";

export const dynamic = "force-dynamic";

export default async function AnmeldenPage({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string }>;
}) {
  const { weiter } = await searchParams;

  return (
    <AnmeldungRahmen
      titel="Anmelden"
      untertitel="Deine Klassen, Sequenzen und Module liegen hinter dieser Tür."
      fussnote={
        <>
          Noch kein Konto?{" "}
          <Link
            href="/registrieren"
            className="text-link underline underline-offset-2"
          >
            Mit Einladungscode registrieren
          </Link>
        </>
      }
    >
      <AnmeldeFormular weiter={weiter ?? "/"} />
    </AnmeldungRahmen>
  );
}
