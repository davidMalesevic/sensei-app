"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Carbon Tabs.
 * https://carbondesignsystem.com/components/tabs/style/
 *
 * `line` (Vorgabe): die aktive Lasche trägt einen 2px-Balken unten in
 * `border-interactive`. `contained`: gefüllte Laschen auf `layer`.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex gap-6 data-horizontal:flex-col", className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list flex w-full items-stretch group-data-vertical/tabs:w-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        line: "bg-transparent",
        contained: "bg-layer",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "type-body-compact-02 relative inline-flex h-12 items-center gap-2 px-4 whitespace-nowrap",
        "text-text-secondary transition-colors duration-[110ms] ease-carbon-standard outline-none",
        "hover:text-foreground",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        "aria-disabled:pointer-events-none aria-disabled:text-text-disabled",
        "data-active:font-semibold data-active:text-foreground",
        // Linien-Laschen
        "group-data-[variant=default]/tabs-list:border-b-2 group-data-[variant=default]/tabs-list:border-border-subtle",
        "group-data-[variant=default]/tabs-list:hover:border-border-strong",
        "group-data-[variant=default]/tabs-list:data-active:border-border-interactive",
        "group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-border-subtle",
        "group-data-[variant=line]/tabs-list:hover:border-border-strong",
        "group-data-[variant=line]/tabs-list:data-active:border-border-interactive",
        // Gefüllte Laschen
        "group-data-[variant=contained]/tabs-list:flex-1 group-data-[variant=contained]/tabs-list:justify-center",
        "group-data-[variant=contained]/tabs-list:border-r group-data-[variant=contained]/tabs-list:border-border-subtle",
        "group-data-[variant=contained]/tabs-list:hover:bg-layer-hover",
        "group-data-[variant=contained]/tabs-list:data-active:bg-layer-selected",
        "group-data-[variant=contained]/tabs-list:data-active:shadow-[inset_0_2px_0_0_var(--border-interactive)]",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("type-body-02 flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
