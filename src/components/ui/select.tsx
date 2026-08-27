"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"
import { ChevronDown, ChevronUp, Checkmark } from "@carbon/icons-react"

import { cn } from "@/lib/utils"

/**
 * Carbon Dropdown.
 * https://carbondesignsystem.com/components/dropdown/style/
 *
 * Wie das Text Input: gefüllte Fläche, eine Linie unten, Chevron rechts.
 * Die Liste liegt auf `layer` und wirft einen harten, tiefen Schatten.
 */
const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-0", className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 truncate text-left", className)}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default" | "lg"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "type-body-compact-02 flex w-full items-center justify-between gap-2 px-4 whitespace-nowrap",
        "border-0 border-b border-border-strong bg-field text-foreground",
        "transition-colors duration-[110ms] ease-carbon-standard outline-none select-none",
        "hover:bg-field-hover",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        "disabled:cursor-not-allowed disabled:border-b-transparent disabled:text-text-disabled",
        "aria-invalid:border-b-support-error aria-invalid:outline-2 aria-invalid:-outline-offset-2 aria-invalid:outline-support-error",
        "data-placeholder:text-text-placeholder",
        "data-[size=sm]:h-10 data-[size=default]:h-12 data-[size=lg]:h-12",
        "*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <span className="pointer-events-none shrink-0 text-foreground transition-transform duration-[110ms] ease-carbon-standard data-[popup-open]:rotate-180">
            <ChevronDown size={16} />
          </span>
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 0,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Positioner
      side={side}
      sideOffset={sideOffset}
      align={align}
      alignOffset={alignOffset}
      alignItemWithTrigger={alignItemWithTrigger}
      className="isolate z-50"
    >
      <SelectPrimitive.Popup
        data-slot="select-content"
        className={cn(
          "relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-40",
          "overflow-x-hidden overflow-y-auto bg-layer text-foreground",
          "shadow-[0_2px_6px_rgba(0,0,0,0.2)] duration-[110ms]",
          "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          className
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.List>{children}</SelectPrimitive.List>
        <SelectScrollDownButton />
      </SelectPrimitive.Popup>
    </SelectPrimitive.Positioner>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        "type-label-02 border-b border-border-subtle px-4 py-2 text-text-helper",
        className
      )}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "type-body-compact-02 relative flex h-12 w-full cursor-pointer items-center gap-2 pr-10 pl-4",
        "border-b border-transparent text-foreground outline-none select-none",
        "transition-colors duration-[70ms] ease-carbon-standard",
        "data-highlighted:bg-layer-hover data-selected:bg-layer-selected",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--ring)]",
        "data-disabled:pointer-events-none data-disabled:text-text-disabled",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-4 flex items-center justify-center text-primary" />
        }
      >
        <Checkmark size={16} />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none h-px bg-border-subtle", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-layer py-1",
        className
      )}
      {...props}
    >
      <ChevronUp size={16} />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-layer py-1",
        className
      )}
      {...props}
    >
      <ChevronDown size={16} />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
