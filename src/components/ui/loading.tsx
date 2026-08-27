import { CheckmarkFilled, ErrorFilled } from "@carbon/icons-react"

import { cn } from "@/lib/utils"

/**
 * Carbon Loading — der rotierende Ring.
 * https://carbondesignsystem.com/components/loading/style/
 */
function Loading({
  size = 16,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="status"
      aria-label="Lädt"
      className={cn("shrink-0 animate-[carbon-spin_690ms_linear_infinite]", className)}
    >
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        strokeWidth="10"
        className="stroke-layer-accent"
      />
      <circle
        cx="50"
        cy="50"
        r="42"
        fill="none"
        strokeWidth="10"
        strokeDasharray="240 264"
        className="stroke-primary"
      />
    </svg>
  )
}

/**
 * Carbon Inline Loading: Ring plus Text, direkt neben der auslösenden
 * Schaltfläche. Endet sichtbar — «fertig» ist auch ein Zustand.
 */
function InlineLoading({
  status = "active",
  text,
  className,
}: {
  status?: "active" | "finished" | "error"
  text?: string
  className?: string
}) {
  return (
    <div
      className={cn("type-body-compact-02 flex items-center gap-2", className)}
      aria-live="polite"
    >
      {status === "active" && <Loading size={16} />}
      {status === "finished" && (
        <CheckmarkFilled size={16} className="shrink-0 text-support-success" />
      )}
      {status === "error" && (
        <ErrorFilled size={16} className="shrink-0 text-support-error" />
      )}
      {text && <span className="text-text-secondary">{text}</span>}
    </div>
  )
}

export { Loading, InlineLoading }
