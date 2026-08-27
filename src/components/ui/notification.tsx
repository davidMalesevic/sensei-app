import * as React from "react"
import {
  CheckmarkFilled,
  ErrorFilled,
  InformationFilled,
  WarningFilled,
} from "@carbon/icons-react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Carbon Inline Notification.
 * https://carbondesignsystem.com/components/notification/style/
 *
 * Ein 3px-Balken links in der Statusfarbe, das passende gefüllte Icon, dann
 * fetter Titel und Fliesstext in einer Zeile. Nichts ist rund, nichts schwebt.
 */
const notificationVariants = cva(
  "flex w-full items-start gap-4 border-l-[3px] p-4 min-h-12",
  {
    variants: {
      kind: {
        error:
          "border-l-support-error bg-notification-error text-foreground dark:border-l-support-error",
        success: "border-l-support-success bg-notification-success text-foreground",
        warning: "border-l-support-warning bg-notification-warning text-foreground",
        info: "border-l-support-info bg-notification-info text-foreground",
      },
    },
    defaultVariants: {
      kind: "info",
    },
  }
)

const ICONS = {
  error: ErrorFilled,
  success: CheckmarkFilled,
  warning: WarningFilled,
  info: InformationFilled,
} as const

const ICON_FARBE = {
  error: "text-support-error",
  success: "text-support-success",
  warning: "text-support-warning",
  info: "text-support-info",
} as const

function Notification({
  className,
  kind = "info",
  titel,
  children,
  action,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof notificationVariants> & {
    /** Die fette erste Zeile — was ist passiert. */
    titel?: React.ReactNode
    /** Rechts aussen: eine einzelne Folgehandlung. */
    action?: React.ReactNode
  }) {
  const art = kind ?? "info"
  const Icon = ICONS[art]

  return (
    <div
      data-slot="notification"
      role={art === "error" ? "alert" : "status"}
      className={cn(notificationVariants({ kind }), className)}
      {...props}
    >
      <Icon size={20} className={cn("mt-px shrink-0", ICON_FARBE[art])} />
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
        {titel && (
          <span className="type-heading-02 text-foreground">{titel}</span>
        )}
        {children && (
          <span className="type-body-02 text-text-secondary">{children}</span>
        )}
      </div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  )
}

export { Notification, notificationVariants }
