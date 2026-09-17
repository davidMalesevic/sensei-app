"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Carbon Toggle, kleine Grösse: 32×16 px, Grün eingeschaltet.
 * https://carbondesignsystem.com/components/toggle/style/
 *
 * Ein Knopf mit `role="switch"` — als `type="submit"` lässt er sich in eine
 * Form Action setzen, damit `revalidatePath` greift.
 */
function Switch({
  checked,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "role"> & { checked: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-slot="switch"
      className={cn(
        "relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full transition-colors duration-[70ms] ease-carbon-standard",
        "outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-support-success" : "bg-border-strong",
        className
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] size-2.5 rounded-full bg-text-on-color transition-[left] duration-[70ms] ease-carbon-standard",
          checked ? "left-[19px]" : "left-[3px]"
        )}
      />
    </button>
  )
}

export { Switch }
