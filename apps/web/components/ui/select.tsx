import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { popoverAboveDrawerClassName } from "@/lib/layout/overlay-z-index";
import { cn } from "@/lib/utils";
import {
  menuItemHighlightClassName,
  selectItemCheckedClassName,
  selectItemHoverCheckClassName,
} from "@/components/ui/menu-item-classes";

/** `modal={false}` avoids Radix blocking pointer events on the portaled item drawer. */
const Select = ({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>) => (
  <SelectPrimitive.Root modal={modal} {...props} />
);
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:border-ring focus:ring-2 focus:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

/** Shared width/scroll cap for selects with multi-line option help text. */
export const selectPopperContentClassName =
  "min-w-[var(--radix-select-trigger-width)] max-w-[min(20rem,calc(100vw-2rem))]";

/** @deprecated Default `SelectContent` already stacks above the item drawer. */
export const selectContentAboveDrawerClassName = popoverAboveDrawerClassName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", sideOffset = 4, collisionPadding = 12, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out",
        popoverAboveDrawerClassName,
        position === "popper" && "data-[side=bottom]:translate-y-1",
        position === "popper" && selectPopperContentClassName,
        className
      )}
      position={position}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "max-h-[min(20rem,var(--radix-select-content-available-height,20rem))] overflow-y-auto overscroll-contain p-1",
          position === "popper" &&
            "w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm",
      menuItemHighlightClassName,
      selectItemCheckedClassName,
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <Check className={selectItemHoverCheckClassName} aria-hidden />
      <SelectPrimitive.ItemIndicator className="flex items-center justify-center">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

/** Menu row with title + helper line; `textValue` keeps the closed trigger to the title only. */
const SelectItemWithDescription = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    label: string;
    description: string;
  }
>(({ className, label, description, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    textValue={label}
    className={cn(
      "relative flex w-full cursor-default select-none items-start rounded-md py-2.5 pl-9 pr-3 text-sm",
      menuItemHighlightClassName,
      selectItemCheckedClassName,
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2.5 top-3 flex h-3.5 w-3.5 items-center justify-center">
      <Check className={selectItemHoverCheckClassName} aria-hidden />
      <SelectPrimitive.ItemIndicator className="flex items-center justify-center">
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <div className="flex min-w-0 flex-col gap-1">
      <SelectPrimitive.ItemText className="font-medium leading-none">{label}</SelectPrimitive.ItemText>
      <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>
    </div>
  </SelectPrimitive.Item>
));
SelectItemWithDescription.displayName = "SelectItemWithDescription";

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground", className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export {
  Select,
  SelectGroup,
  SelectLabel,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectItemWithDescription,
};
