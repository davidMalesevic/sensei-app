import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Carbon Button.
 * https://carbondesignsystem.com/components/button/style/
 *
 * Die Carbon-Signatur: Beschriftung linksbündig, Icon rechts aussen, keine
 * abgerundeten Ecken, 2px-Fokusrahmen nach innen. Für dichte Zeilen sind
 * Icon-Varianten (`size="icon-sm"`, `variant="ghost"`) vorgesehen — nicht
 * schmalere Textknöpfe.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center text-left align-top",
    "type-body-compact-02 border border-transparent whitespace-nowrap",
    "transition-colors duration-[70ms] ease-carbon-entrance outline-none select-none",
    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
    "disabled:pointer-events-none disabled:cursor-not-allowed",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        // Carbon: Primary
        default:
          "bg-primary text-white hover:bg-button-primary-hover active:bg-button-primary-active focus-visible:shadow-[inset_0_0_0_1px_var(--background)] disabled:bg-[#c6c6c6] disabled:text-[#8d8d8d] dark:disabled:bg-[#525252] dark:disabled:text-[#8d8d8d]",
        // Carbon: Secondary
        secondary:
          "bg-button-secondary text-white hover:bg-button-secondary-hover active:bg-button-secondary-active focus-visible:shadow-[inset_0_0_0_1px_var(--background)] disabled:bg-[#c6c6c6] disabled:text-[#8d8d8d] dark:disabled:bg-[#525252] dark:disabled:text-[#8d8d8d]",
        // Carbon: Tertiary — der Rahmenknopf
        outline:
          "border-primary bg-transparent text-primary hover:bg-primary hover:text-white active:bg-button-primary-active active:text-white disabled:border-[#c6c6c6] disabled:bg-transparent disabled:text-[#c6c6c6] dark:disabled:border-[#525252] dark:disabled:text-[#525252]",
        // Carbon: Ghost
        ghost:
          "bg-transparent text-primary hover:bg-layer-hover hover:text-link-hover active:bg-layer-active disabled:text-[#c6c6c6] dark:disabled:text-[#525252]",
        // Carbon: Ghost, aber in Textfarbe — für Werkzeugleisten über Tabellen
        "ghost-neutral":
          "bg-transparent text-foreground hover:bg-layer-hover active:bg-layer-active disabled:text-text-disabled",
        // Carbon: Danger Primary
        destructive:
          "bg-support-error text-white hover:bg-button-danger-hover active:bg-button-danger-active focus-visible:shadow-[inset_0_0_0_1px_var(--background)] disabled:bg-[#c6c6c6] disabled:text-[#8d8d8d]",
        // Carbon: Danger Tertiary
        "destructive-outline":
          "border-support-error bg-transparent text-support-error hover:bg-support-error hover:text-white active:bg-button-danger-active active:text-white disabled:border-[#c6c6c6] disabled:text-[#c6c6c6]",
        // Carbon: Danger Ghost
        "destructive-ghost":
          "bg-transparent text-support-error hover:bg-support-error hover:text-white active:bg-button-danger-active active:text-white disabled:text-[#c6c6c6]",
        link: "bg-transparent p-0 text-link underline underline-offset-2 hover:text-link-hover disabled:text-text-disabled",
      },
      size: {
        // Carbon: Beschriftung links, grosszügiger Raum rechts fürs Icon.
        // `xs` behält die dichte 01-Schrift — kleines Feld, kleine Schrift.
        xs: "type-body-compact-01 h-8 justify-start pr-12 pl-3 [&_svg]:absolute [&_svg]:right-3",
        sm: "h-10 justify-start pr-14 pl-[15px] [&_svg]:absolute [&_svg]:right-4",
        default: "h-12 justify-start pr-16 pl-[15px] [&_svg]:absolute [&_svg]:right-4",
        lg: "h-12 justify-start pr-16 pl-[15px] [&_svg]:absolute [&_svg]:right-4",
        // Icon-only: quadratisch, Icon zentriert.
        "icon-xs": "size-8 justify-center p-0",
        "icon-sm": "size-10 justify-center p-0",
        icon: "size-12 justify-center p-0",
        "icon-lg": "size-16 justify-center p-0",
        // Ohne Höhe/Padding — für Text-Links im Fliesstext.
        inline: "h-auto justify-start gap-2 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
