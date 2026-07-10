import type { ItemLifecycleStatusTone } from "@/lib/products/item-lifecycle-status";
import { cn } from "@/lib/utils";

type Props = {
  tone: ItemLifecycleStatusTone;
  label: string;
  className?: string;
};

export function ItemLifecycleStatusDot({ tone, label, className }: Props) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        tone === "active" && "bg-primary ring-1 ring-primary/30",
        tone === "warning" && "bg-amber-500 ring-1 ring-amber-500/30",
        tone === "inactive" && "bg-muted-foreground/50 ring-1 ring-border/70",
        className
      )}
      title={label}
      aria-label={label}
    />
  );
}
