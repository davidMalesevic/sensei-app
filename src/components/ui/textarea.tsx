import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Carbon Text Area — wie das Text Input, nur mehrzeilig.
 * https://carbondesignsystem.com/components/text-area/style/
 */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "type-body-compact-02 flex field-sizing-content min-h-24 w-full bg-field px-4 py-3 text-foreground",
        "border-0 border-b border-border-strong transition-colors duration-[110ms] ease-carbon-standard",
        "outline-none placeholder:text-text-placeholder",
        "hover:bg-field-hover",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:border-b-transparent disabled:text-text-disabled",
        "aria-invalid:border-b-support-error aria-invalid:outline-2 aria-invalid:-outline-offset-2 aria-invalid:outline-support-error",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
