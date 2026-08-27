import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Carbon Text Input.
 * https://carbondesignsystem.com/components/text-input/style/
 *
 * Ein Feld ist in Carbon eine gefüllte Fläche mit einer einzigen Linie unten —
 * kein Rahmen ringsum. Der Fokus wird durch einen 2px-Rahmen nach innen gesetzt.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "type-body-compact-02 h-12 w-full min-w-0 bg-field px-4 text-foreground",
        "border-0 border-b border-border-strong transition-colors duration-[110ms] ease-carbon-standard",
        "outline-none placeholder:text-text-placeholder",
        "hover:bg-field-hover",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:border-b-transparent disabled:text-text-disabled",
        "aria-invalid:border-b-support-error aria-invalid:outline-2 aria-invalid:-outline-offset-2 aria-invalid:outline-support-error",
        "file:mr-4 file:h-full file:cursor-pointer file:border-0 file:bg-transparent file:text-base file:font-normal file:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Input }
