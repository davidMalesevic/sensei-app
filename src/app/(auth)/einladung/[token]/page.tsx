import Link from "next/link";

import { AnmeldungRahmen } from "../../anmeldung-rahmen";
import { getGeteilteBildungsplaene, pruefeEinladung } from "../../actions";
import { EinladungsFormular } from "./einladungs-formular";

export const dynamic = "force-dynamic";

export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [einladung, plaene] = await Promise.all([
    pruefeEinladung(token),
    getGeteilteBildungsplaene(),
  ]);

  if (!einladung) {
    return (
      <AnmeldungRahmen
        titel="Einladung ungültig"
        untertitel="Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte lass dir eine neue Einladung schicken."
        fussnote={
          <Link href="/anmelden" className="text-link underline underline-offset-2">
            Zur Anmeldung
          </Link>
        }
      >
        <></>
      </AnmeldungRahmen>
    );
  }

  return (
    <AnmeldungRahmen
      titel="Willkommen bei Sensei"
      untertitel="Dein Konto startet mit einem leeren Blatt: eigene Klassen, eigener Stundenplan-Import, eigene Module."
    >
      <EinladungsFormular
        token={token}
        email={einladung.email}
        plaene={plaene}
      />
    </AnmeldungRahmen>
  );
}
