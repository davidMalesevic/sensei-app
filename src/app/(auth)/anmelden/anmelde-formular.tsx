"use client";

import { useActionState } from "react";
import { ArrowRight } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { anmelden, type AuthZustand } from "../actions";

export function AnmeldeFormular({ weiter }: { weiter: string }) {
  const [zustand, action, laeuft] = useActionState<AuthZustand, FormData>(
    anmelden,
    {}
  );

  return (
    <form action={action}>
      <input type="hidden" name="weiter" value={weiter} />

      {zustand.fehler && (
        <Notification kind="error" titel="Anmeldung fehlgeschlagen" className="mb-8">
          {zustand.fehler}
        </Notification>
      )}

      <div className="mb-8">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoFocus
          required
          className="mt-2"
        />
      </div>

      <div className="mb-10">
        <Label htmlFor="passwort">Passwort</Label>
        <Input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2"
        />
      </div>

      <Button type="submit" size="lg" disabled={laeuft} className="w-full">
        {laeuft ? "Wird geprüft…" : "Anmelden"}
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}
