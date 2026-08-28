"use client";

import { useActionState } from "react";
import { ArrowRight } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, HelperText } from "@/components/ui/label";
import { Notification } from "@/components/ui/notification";
import { neuesPasswortSetzen, type AuthZustand } from "../../actions";

export function PasswortFormular({ token }: { token: string }) {
  const [zustand, action, laeuft] = useActionState<AuthZustand, FormData>(
    neuesPasswortSetzen,
    {}
  );

  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />

      {zustand.fehler && (
        <Notification kind="error" titel="Das hat nicht geklappt" className="mb-8">
          {zustand.fehler}
        </Notification>
      )}

      <div className="mb-8">
        <Label htmlFor="passwort">Neues Passwort</Label>
        <Input
          id="passwort"
          name="passwort"
          type="password"
          autoComplete="new-password"
          required
          autoFocus
          className="mt-2"
        />
        <HelperText className="mt-2">Mindestens 10 Zeichen.</HelperText>
      </div>

      <div className="mb-10">
        <Label htmlFor="wiederholung">Noch einmal</Label>
        <Input
          id="wiederholung"
          name="wiederholung"
          type="password"
          autoComplete="new-password"
          required
          className="mt-2"
        />
      </div>

      <Button type="submit" size="lg" disabled={laeuft} className="w-full">
        {laeuft ? "Wird gesetzt…" : "Passwort setzen"}
        <ArrowRight size={16} />
      </Button>
    </form>
  );
}
