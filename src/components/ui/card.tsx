import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Carbon Tile.
 * https://carbondesignsystem.com/components/tile/style/
 *
 * Eine Fläche auf der Ebene `layer`, kantig, mit 16px Innenabstand. Kein
 * Schatten, keine Rundung — Carbon trennt Flächen über Helligkeit, nicht
 * über Tiefe.
 */
function Card({
  className,
  size = "default",
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col bg-layer text-card-foreground",
        "gap-(--card-spacing) py-(--card-spacing) [--card-spacing:--spacing(4)]",
        "data-[size=sm]:[--card-spacing:--spacing(3)]",
        className
      )}
      {...props}
    />
  )
}

/** Anklickbare Kachel: Hover hebt die Ebene an, Fokus setzt den Carbon-Rahmen. */
function CardClickable({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-colors duration-[110ms] ease-carbon-standard",
        "hover:bg-layer-hover",
        "focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-[var(--ring)]",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min items-start gap-1 px-(--card-spacing)",
        "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

/** Carbon: heading-compact-01 — Kachelüberschriften bleiben klein und fett. */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("type-heading-compact-02 text-foreground", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("type-body-02 text-text-secondary", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("type-body-02 px-(--card-spacing)", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex items-center border-t border-border-subtle px-(--card-spacing) pt-(--card-spacing)",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardClickable,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
