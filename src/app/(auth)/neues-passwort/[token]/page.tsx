import Link from "next/link";

import { AnmeldungRahmen } from "../../anmeldung-rahmen";
import { pruefeResetToken } from "../../actions";
import { PasswortFormular } from "./passwort-formular";

export const dynamic = "force-dynamic";

export default async function NeuesPasswortPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const eintrag = await pruefeResetToken(token);

  if (!eintrag) {
    return (
      <AnmeldungRahmen
        titel="Link ungültig"
        untertitel="Dieser Link ist abgelaufen oder wurde bereits verwendet. Bitte lass dir einen neuen schicken."
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
      titel="Neues Passwort"
      untertitel={`Für ${eintrag.benutzer.email}. Alle offenen Sitzungen dieses Kontos werden dabei beendet.`}
    >
      <PasswortFormular token={token} />
    </AnmeldungRahmen>
  );
}
