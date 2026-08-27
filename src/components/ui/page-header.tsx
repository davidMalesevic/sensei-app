import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Carbon Breadcrumb.
 * https://carbondesignsystem.com/components/breadcrumb/style/
 */
function Breadcrumb({
  items,
  className,
}: {
  items: { label: string; href?: string }[]
  className?: string
}) {
  return (
    <nav aria-label="Brotkrumen" className={cn("mb-2", className)}>
      <ol className="type-body-compact-02 flex flex-wrap items-center gap-1 text-text-secondary">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-1">
            {item.href ? (
              <Link
                href={item.href}
                className="text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
                {item.label}
              </span>
            )}
            {i < items.length - 1 && (
              <span aria-hidden="true" className="px-1 text-text-secondary">
                /
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * Carbon Page Header.
 *
 * Titel in heading-04 (28px, Normalgewicht) — in Carbon trägt die Grösse die
 * Hierarchie, nicht der Fettdruck. Handlungen sitzen rechts auf derselben
 * Grundlinie.
 */
function PageHeader({
  titel,
  beschreibung,
  breadcrumb,
  aktionen,
  className,
  children,
}: {
  titel: React.ReactNode
  beschreibung?: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
  aktionen?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn("mb-8", className)}>
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="type-heading-04 text-foreground">{titel}</h1>
          {beschreibung && (
            <p className="type-body-02 mt-2 max-w-2xl text-text-secondary">
              {beschreibung}
            </p>
          )}
        </div>
        {aktionen && (
          <div className="flex shrink-0 flex-wrap items-center gap-px">
            {aktionen}
          </div>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * Abschnittsüberschrift innerhalb einer Seite — heading-03, mit einer
 * Trennlinie darunter, wie Carbon Abschnitte gliedert.
 */
function SectionHeader({
  titel,
  beschreibung,
  aktionen,
  className,
}: {
  titel: React.ReactNode
  beschreibung?: React.ReactNode
  aktionen?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-border-subtle pb-2",
        className
      )}
    >
      <div className="min-w-0">
        <h2 className="type-heading-03 text-foreground">{titel}</h2>
        {beschreibung && (
          <p className="type-body-02 mt-1 text-text-secondary">{beschreibung}</p>
        )}
      </div>
      {aktionen && (
        <div className="flex shrink-0 items-center gap-px">{aktionen}</div>
      )}
    </div>
  )
}

/**
 * Ein Wertepaar, wie Carbon Kennzahlen auszeichnet: kleines Label oben,
 * grosser Wert darunter.
 */
function DataItem({
  label,
  children,
  className,
}: {
  label: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="type-label-02 text-text-helper">{label}</div>
      <div className="type-body-compact-02 mt-1 text-foreground">{children}</div>
    </div>
  )
}

export { Breadcrumb, PageHeader, SectionHeader, DataItem }
