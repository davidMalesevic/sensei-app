import { cn } from "@/lib/utils"

/** Carbon Skeleton: eckige Fläche auf `layer-accent`, ruhig pulsierend. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse bg-layer-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }
