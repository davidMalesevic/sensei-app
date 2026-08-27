"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** Carbon Label: label-01, sekundäre Textfarbe, 8px Abstand zum Feld. */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "type-label-02 flex items-center gap-2 text-text-secondary select-none",
        "group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-text-disabled",
        "peer-disabled:cursor-not-allowed peer-disabled:text-text-disabled",
        className
      )}
      {...props}
    />
  )
}

/** Carbon Helper Text — die Erklärung unter dem Feld. */
function HelperText({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="helper-text"
      className={cn("type-helper-02 text-text-helper", className)}
      {...props}
    />
  )
}

export { Label, HelperText }
