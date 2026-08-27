import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Carbon Tag.
 * https://carbondesignsystem.com/components/tag/style/
 *
 * Die einzige runde Form im System: Carbon-Tags sind Pillen (radius 15px).
 * Die Farbpalette ist qualitativ gemeint — sie ordnet zu, sie wertet nicht.
 * Für Zustände gibt es `red` (Fehler), `green` (fertig), `blue` (aktiv).
 */
const badgeVariants = cva(
  [
    "group/badge type-label-02 inline-flex w-fit shrink-0 items-center justify-center gap-1",
    "overflow-hidden rounded-[0.9375rem] border border-transparent whitespace-nowrap",
    "transition-colors duration-[70ms] ease-carbon-standard",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
    "[&>svg]:pointer-events-none [&>svg]:size-3.5",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[#e0e0e0] text-[#161616] dark:bg-[#6f6f6f] dark:text-[#f4f4f4]",
        gray: "bg-[#e0e0e0] text-[#161616] dark:bg-[#6f6f6f] dark:text-[#f4f4f4]",
        "cool-gray":
          "bg-[#dde1e6] text-[#121619] dark:bg-[#697077] dark:text-[#f2f4f8]",
        blue: "bg-[#d0e2ff] text-[#0043ce] dark:bg-[#0043ce] dark:text-[#d0e2ff]",
        green:
          "bg-[#a7f0ba] text-[#0e6027] dark:bg-[#0e6027] dark:text-[#a7f0ba]",
        red: "bg-[#ffd7d9] text-[#a2191f] dark:bg-[#a2191f] dark:text-[#ffd7d9]",
        purple:
          "bg-[#e8daff] text-[#6929c4] dark:bg-[#6929c4] dark:text-[#e8daff]",
        teal: "bg-[#9ef0f0] text-[#005d5d] dark:bg-[#005d5d] dark:text-[#9ef0f0]",
        cyan: "bg-[#bae6ff] text-[#00539a] dark:bg-[#00539a] dark:text-[#bae6ff]",
        magenta:
          "bg-[#ffd6e8] text-[#9f1853] dark:bg-[#9f1853] dark:text-[#ffd6e8]",
        // Kompatibilität mit den shadcn-Namen
        secondary:
          "bg-[#dde1e6] text-[#121619] dark:bg-[#697077] dark:text-[#f2f4f8]",
        destructive:
          "bg-[#ffd7d9] text-[#a2191f] dark:bg-[#a2191f] dark:text-[#ffd7d9]",
        "high-contrast":
          "bg-[#393939] text-white dark:bg-[#f4f4f4] dark:text-[#161616]",
        outline: "border-border-inverse bg-transparent text-foreground",
        ghost: "border-border-strong bg-transparent text-text-secondary",
      },
      size: {
        sm: "h-6 px-2",
        default: "h-7 px-3",
        lg: "h-8 px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
