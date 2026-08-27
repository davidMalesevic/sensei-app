import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import { ChevronDown } from "@carbon/icons-react"

import { cn } from "@/lib/utils"

/**
 * Carbon Accordion.
 * https://carbondesignsystem.com/components/accordion/style/
 *
 * Trennlinien oben und unten, Chevron rechts, Hover legt `layer-hover` unter
 * die ganze Zeile. Kein Rahmen, keine Rundung.
 */
function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
  return (
    <AccordionPrimitive.Root
      data-slot="accordion"
      className={cn(
        "flex w-full flex-col border-b border-border-subtle",
        className
      )}
      {...props}
    />
  )
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-t border-border-subtle", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionPrimitive.Trigger.Props) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger type-body-compact-02 relative flex min-h-12 flex-1 items-center justify-between gap-4 px-4 py-3 text-left",
          "text-foreground transition-colors duration-[110ms] ease-carbon-standard outline-none",
          "hover:bg-layer-hover",
          "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
          "aria-disabled:pointer-events-none aria-disabled:text-text-disabled",
          className
        )}
        {...props}
      >
        {children}
        <span
          data-slot="accordion-trigger-icon"
          className="pointer-events-none shrink-0 self-start pt-0.5 text-foreground transition-transform duration-[110ms] ease-carbon-standard group-aria-expanded/accordion-trigger:rotate-180"
        >
          <ChevronDown size={16} />
        </span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

function AccordionContent({
  className,
  children,
  ...props
}: AccordionPrimitive.Panel.Props) {
  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden data-open:animate-accordion-down data-closed:animate-accordion-up"
      {...props}
    >
      <div
        className={cn(
          "type-body-02 h-(--accordion-panel-height) px-4 pt-0 pb-6 data-ending-style:h-0 data-starting-style:h-0",
          "[&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_p:not(:last-child)]:mb-4",
          className
        )}
      >
        {children}
      </div>
    </AccordionPrimitive.Panel>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
