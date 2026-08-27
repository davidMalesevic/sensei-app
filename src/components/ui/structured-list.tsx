import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Carbon Structured List.
 * https://carbondesignsystem.com/components/structured-list/style/
 *
 * Für Inhalte, die keine Tabelle sind, aber eine Ordnung haben: Zeilen auf
 * `layer`, getrennt durch 1px, Kopfzeile fett und ohne Fläche.
 */
function StructuredList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="structured-list"
      className={cn("w-full bg-layer", className)}
      {...props}
    />
  )
}

function StructuredListHead({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="structured-list-head"
      className={cn(
        "type-heading-compact-02 flex items-center gap-4 border-b border-border-strong px-4 py-2 text-foreground",
        className
      )}
      {...props}
    />
  )
}

function StructuredListRow({
  className,
  interaktiv = false,
  ...props
}: React.ComponentProps<"div"> & { interaktiv?: boolean }) {
  return (
    <div
      data-slot="structured-list-row"
      className={cn(
        "type-body-02 flex gap-4 border-b border-border-subtle px-4 py-3 text-foreground last:border-b-0",
        interaktiv &&
          "cursor-pointer transition-colors duration-[110ms] ease-carbon-standard hover:bg-layer-hover",
        className
      )}
      {...props}
    />
  )
}

function StructuredListCell({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="structured-list-cell"
      className={cn("min-w-0 flex-1", className)}
      {...props}
    />
  )
}

export {
  StructuredList,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
}
