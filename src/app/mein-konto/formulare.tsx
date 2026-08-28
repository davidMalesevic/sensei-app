"use client";

import { useActionState, useState } from "react";
import { Checkmark } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { SectionHeader } from "@/components/ui/page-header";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  aenderePasswort, speichereProfil, speichereVorbereitung, type KontoZustand,
} from "./actions";

function Meldung({ zustand }: { zustand: KontoZustand }) {
  if (zustand.fehler) {
    return (
      <Notification kind="error" titel="Nicht gespeichert" className="mb-6">
        {zustand.fehler}
      </Notification>
    );
  }
  if (zustand.hinweis) {
    return (
      <Notification kind="success" titel="Erledigt" className="mb-6">
        {zustand.hinweis}
      </Notification>
    );
  }
  return null;
}

export function ProfilFormular({ name, email }: { name: string; email: string }) {
  const [zustand, action, laeuft] = useActionState<KontoZustand, FormData>(
    speichereProfil, {}
  );

  return (
    <section className="mb-12 max-w-lg">
      <SectionHeader titel="Profil" />
      <Meldung zustand={zustand} />
      <form action={action}>
        <div className="mb-8">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={name} required className="mt-2" />
        </div>
        <div className="mb-8">
          <Label htmlFor="email">E-Mail</Label>
          <Input
            id="email" name="email" type="email" defaultValue={email} required className="mt-2"
          />
          <HelperText className="mt-2">
            Damit meldest du dich an. Nach einer Änderung gilt sofort die neue Adresse.
          </HelperText>
        </div>
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Wird gespeichert…" : "Speichern"}
          <Checkmark size={16} />
        </Button>
      </form>
    </section>
  );
}

export function PasswortFormular() {
  const [zustand, action, laeuft] = useActionState<KontoZustand, FormData>(
    aenderePasswort, {}
  );

  return (
    <section className="mb-12 max-w-lg">
      <SectionHeader titel="Passwort ändern" />
      <Meldung zustand={zustand} />
      <form action={action}>
        <div className="mb-8">
          <Label htmlFor="alt">Bisheriges Passwort</Label>
          <Input
            id="alt" name="alt" type="password" autoComplete="current-password"
            required className="mt-2"
          />
        </div>
        <div className="mb-8">
          <Label htmlFor="neu">Neues Passwort</Label>
          <Input
            id="neu" name="neu" type="password" autoComplete="new-password"
            required className="mt-2"
          />
          <HelperText className="mt-2">Mindestens 10 Zeichen.</HelperText>
        </div>
        <div className="mb-8">
          <Label htmlFor="wiederholung">Noch einmal</Label>
          <Input
            id="wiederholung" name="wiederholung" type="password"
            autoComplete="new-password" required className="mt-2"
          />
        </div>
        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Wird geändert…" : "Passwort ändern"}
          <Checkmark size={16} />
        </Button>
        <HelperText className="mt-4">
          Andere Geräte werden dabei abgemeldet, dieses bleibt angemeldet.
        </HelperText>
      </form>
    </section>
  );
}

/**
 * Der Wochentag, an dem der Lauf **stattfindet** — nicht die Nacht davor.
 *
 * Die Zahlen entsprechen `Date.getDay()` (0 = Sonntag); genau damit vergleicht
 * die Cron-Route. Eine Beschriftung wie «Dienstagnacht auf Mittwoch» wäre um
 * einen Tag verschoben und würde ausserdem unsinnig, sobald jemand 14 Uhr
 * einstellt. Wer die Nacht auf Mittwoch meint, wählt Mittwoch und 03:00.
 */
const TAGE: Record<string, string> = {
  taeglich: "Jeden Tag",
  "1": "Montag",
  "2": "Dienstag",
  "3": "Mittwoch",
  "4": "Donnerstag",
  "5": "Freitag",
  "6": "Samstag",
  "0": "Sonntag",
};

const STUNDEN = Object.fromEntries(
  Array.from({ length: 24 }, (_, i) => [String(i), `${String(i).padStart(2, "0")}:00 Uhr`])
);

export function VorbereitungFormular({
  aktiv, tag, stunde, tageVoraus,
}: {
  aktiv: boolean; tag: number | null; stunde: number; tageVoraus: number;
}) {
  const [zustand, action, laeuft] = useActionState<KontoZustand, FormData>(
    speichereVorbereitung, {}
  );
  const [an, setAn] = useState(aktiv);
  const [tagWert, setTagWert] = useState(tag === null ? "taeglich" : String(tag));
  const [stundeWert, setStundeWert] = useState(String(stunde));

  return (
    <section className="mb-12 max-w-lg">
      <SectionHeader
        titel="Vorbereitungsdurchgang"
        beschreibung="Wann Sensei deine Abläufe im Voraus erzeugt. Die Zeit ist Schweizer Zeit."
      />
      <Meldung zustand={zustand} />

      <form action={action}>
        <label className="type-body-compact-02 mb-8 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="aktiv"
            value="an"
            checked={an}
            onChange={(e) => setAn(e.target.checked)}
            className="carbon-checkbox"
          />
          Durchgang automatisch laufen lassen
        </label>

        <div className="mb-8">
          <Label htmlFor="tag">Wann</Label>
          <div className="mt-2">
            <Select
              name="tag" value={tagWert}
              onValueChange={(v) => setTagWert(String(v))}
              items={TAGE} disabled={!an}
            >
              <SelectTrigger id="tag"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TAGE).map(([wert, label]) => (
                  <SelectItem key={wert} value={wert}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <HelperText className="mt-2">
            Der Tag, an dem der Lauf startet. Für «Nacht auf Mittwoch» also
            Mittwoch und 03:00 Uhr wählen.
          </HelperText>
        </div>

        <div className="mb-8">
          <Label htmlFor="stunde">Uhrzeit</Label>
          <div className="mt-2">
            <Select
              name="stunde" value={stundeWert}
              onValueChange={(v) => setStundeWert(String(v))}
              items={STUNDEN} disabled={!an}
            >
              <SelectTrigger id="stunde"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STUNDEN).map(([wert, label]) => (
                  <SelectItem key={wert} value={wert}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mb-8 max-w-40">
          <Label htmlFor="tageVoraus">Vorlauf in Tagen</Label>
          <Input
            id="tageVoraus" name="tageVoraus" type="number" min="1" max="60"
            defaultValue={tageVoraus} disabled={!an} className="mt-2"
          />
          <HelperText className="mt-2">
            Wie weit im Voraus geplant wird. 10 Tage decken Donnerstag, Freitag
            und den folgenden Dienstag ab.
          </HelperText>
        </div>

        <Button type="submit" disabled={laeuft}>
          {laeuft ? "Wird gespeichert…" : "Speichern"}
          <Checkmark size={16} />
        </Button>
      </form>
    </section>
  );
}
