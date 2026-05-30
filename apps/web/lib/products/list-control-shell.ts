import { cn } from "@/lib/utils";

/** Shared container for list filter / bulk action control bars above the product grid. */
export function listControlShellClassName(className?: string) {
  return cn(
    "w-full min-w-0 rounded-lg border border-primary/25",
    "bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--background)))]",
    "px-3 py-2.5 shadow-sm sm:px-4 sm:py-3",
    className
  );
}
