"use client";

import { useOptimistic } from "react";

import { Switch } from "@/components/ui/switch";
import { methodeSchalten } from "./actions";

/**
 * Ein/Aus für die eigene Planung. Als Form Action, damit die Liste nach dem
 * Umschalten neu gerendert wird; optimistisch, damit der Schalter nicht erst
 * nach der Antwort umspringt.
 */
export function MethodeSchalter({
  schluessel,
  name,
  an,
  mitText = false,
}: {
  schluessel: string;
  name: string;
  an: boolean;
  mitText?: boolean;
}) {
  const [angezeigt, setzeAngezeigt] = useOptimistic(an);

  return (
    <form
      action={async () => {
        setzeAngezeigt(!angezeigt);
        await methodeSchalten(schluessel, !angezeigt);
      }}
      className="flex items-center gap-2"
    >
      <Switch
        type="submit"
        checked={angezeigt}
        aria-label={`${name} in der Planung verwenden`}
        title={angezeigt ? "Wird in der Planung verwendet" : "Ausgeschaltet"}
      />
      {mitText && (
        <span className="type-body-compact-02 text-text-secondary">
          {angezeigt ? "In der Planung verwendet" : "Ausgeschaltet"}
        </span>
      )}
    </form>
  );
}
