"use client";

import { useState } from "react";
import { TrashCan } from "@carbon/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Löschen in Carbon: ein Danger-Modal statt `window.confirm`.
 * Der Fuss trägt zwei randlose Knöpfe zu gleichen Teilen — links abbrechen,
 * rechts die gefährliche Handlung in Rot.
 * https://carbondesignsystem.com/patterns/dialog-pattern/#danger-modal
 *
 * Der Aufruf läuft über eine Form Action, damit `revalidatePath` greift.
 */
export function DeleteButton({
  onDelete,
  titel,
  beschreibung,
  label = "Löschen",
}: {
  onDelete: () => Promise<void>;
  titel: string;
  beschreibung: string;
  label?: string;
}) {
  const [offen, setOffen] = useState(false);

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger
        render={
          <Button
            variant="destructive-ghost"
            size="icon-sm"
            aria-label={label}
            title={label}
          />
        }
      >
        <TrashCan size={16} />
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titel}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <DialogDescription>{beschreibung}</DialogDescription>
        </DialogBody>
        <DialogFooter showCloseButton>
          <form
            action={async () => {
              await onDelete();
              setOffen(false);
            }}
            className="flex flex-1"
          >
            <Button
              type="submit"
              variant="destructive"
              className="h-16 flex-1 items-start pt-4"
            >
              {label}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
