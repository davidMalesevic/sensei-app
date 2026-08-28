import Link from "next/link";

import { AnmeldungRahmen } from "../anmeldung-rahmen";
import { getGeteilteBildungsplaene } from "../actions";
import { RegistrierFormular } from "./registrier-formular";

export const dynamic = "force-dynamic";

export default async function RegistrierenPage() {
  const plaene = await getGeteilteBildungsplaene();

  return (
    <AnmeldungRahmen
      titel="Konto anlegen"
      untertitel="Jedes Konto startet mit einem leeren Blatt: eigene Klassen, eigener Stundenplan-Import, eigene Module."
      fussnote={
        <>
          Schon ein Konto?{" "}
          <Link href="/anmelden" className="text-link underline underline-offset-2">
            Anmelden
          </Link>
        </>
      }
    >
      <RegistrierFormular plaene={plaene} />
    </AnmeldungRahmen>
  );
}
