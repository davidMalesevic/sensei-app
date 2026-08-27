"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Checkmark, Subtract } from "@carbon/icons-react"

import { cn } from "@/lib/utils"

/**
 * Carbon Checkbox.
 * https://carbondesignsystem.com/components/checkbox/style/
 *
 * 16px, eckig, 1px-Rahmen in `border-strong`. Angehakt füllt sich die Fläche
 * mit `icon-primary` — in Carbon also Schwarz, nicht Blau.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center",
        "border border-border-inverse bg-transparent transition-colors duration-[70ms] ease-carbon-standard outline-none",
        "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:border-text-disabled",
        "data-checked:border-border-inverse data-checked:bg-border-inverse data-checked:text-background",
        "data-indeterminate:border-border-inverse data-indeterminate:bg-border-inverse data-indeterminate:text-background",
        "aria-invalid:border-support-error",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current"
        render={(indicatorProps, state) => (
          <span {...indicatorProps}>
            {state.indeterminate ? <Subtract size={16} /> : <Checkmark size={16} />}
          </span>
        )}
      />
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
