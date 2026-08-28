"use client";

import { useActionState, useState } from "react";
import { ArrowRight } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { cn } from "@/lib/utils";
import { registrieren, type AuthZustand } from "../actions";

export type PlanOption = { id: string; bezeichnung: string; version: string };

const EIGENER = "eigener";

export function RegistrierFormular({ plaene }: { plaene: PlanOption[] }) {
  const [zustand, action, laeuft] = useActionState<AuthZustand, FormData>(
    registrieren,
    {}
  );
  const [plan, setPlan] = useState(plaene[0]?.id ?? EIGENER);

  return (
    <form action={action}>
      {zustand.fehler && (
        <Notification kind="error" titel="Registrierung fehlgeschlagen" className="mb-8">
          {zustand.fehler}
        </Notification>
      )}

      <div className="mb-8">
        <Label htmlFor="code">Einladungscode</Label>
        <Input id="code" name="code" required autoFocus className="mt-2" />
        <HelperText className="mt-2">
          Ohne Code kein Konto — den Code bekommst du von der Person, die Sensei
          betreibt.
        </HelperText>
      </div>

      <div className="mb-8">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required className="mt-2" />
      </div>

      <div className="mb-8">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-2"
        />
      </div>

      <div className="mb-8">
        <Label htmlFor="passwort">Passwort</Label>
        <Input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2"
        />
        <HelperText className="mt-2">Mindestens 10 Zeichen.</HelperText>
      </div>

      {/* Carbon Radio Button Group: welcher Bildungsplan gilt für dieses Konto? */}
      <fieldset className="mb-10">
        <legend className="type-label-02 mb-1 text-text-secondary">
          Bildungsplan
        </legend>
        <HelperText className="mb-4">
          Klassen, Sequenzen und Module fangen leer an. Beim Bildungsplan kannst
          du einen bestehenden mitbenutzen.
        </HelperText>

        <input type="hidden" name="bildungsplan" value={plan} />

        <div className="bg-layer">
          {plaene.map((p) => (
            <PlanWahl
              key={p.id}
              gewaehlt={plan === p.id}
              onWaehlen={() => setPlan(p.id)}
              titel={p.bezeichnung}
              hinweis={`Version ${p.version} · geteilt, wird nicht verändert`}
            />
          ))}
          <PlanWahl
            gewaehlt={plan === EIGENER}
            onWaehlen={() => setPlan(EIGENER)}
            titel="Eigenen Bildungsplan anlegen"
            hinweis="Leer — du trägst Handlungskompetenzen selbst ein"
          />
        </div>
      </fieldset>

      <Button type="submit" size="lg" disabled={laeuft} className="w-full">
        {laeuft ? "Wird angelegt…" : "Konto anlegen"}
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}

function PlanWahl({
  gewaehlt,
  onWaehlen,
  titel,
  hinweis,
}: {
  gewaehlt: boolean;
  onWaehlen: () => void;
  titel: string;
  hinweis: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0",
        "transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover",
        gewaehlt && "bg-layer-selected"
      )}
    >
      <input
        type="radio"
        name="plan-wahl"
        checked={gewaehlt}
        onChange={onWaehlen}
        className="carbon-radio mt-0.5"
      />
      <span className="min-w-0">
        <span className="type-heading-compact-02 block text-foreground">
          {titel}
        </span>
        <span className="type-helper-02 block text-text-helper">{hinweis}</span>
      </span>
    </label>
  );
}
