import { cn } from "@/lib/utils";

/** Top-level section card in the entity drawer form. */
export function entitySectionCardClass() {
  return "rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6";
}

/** Vertical rhythm between top-level section cards. */
export function entitySectionStackClass() {
  return "space-y-6";
}

/** Subsection block inside a section card (Identity, Primary contact, etc.). */
export function entitySubsectionClass() {
  return "space-y-3";
}

/** Subsection title within a section card. */
export function entitySubsectionTitleClass() {
  return "text-sm font-medium text-foreground";
}

/** Centered disclosure row with a full-width line behind the label. */
export function entityDisclosureRowClass() {
  return "relative flex w-full items-center";
}

export function entityDisclosureLineClass() {
  return "pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/50";
}

export function entityDisclosureButtonClass() {
  return cn(
    "relative z-[1] mx-auto h-7 bg-background px-3 text-xs font-medium text-primary hover:bg-accent hover:text-primary"
  );
}

/** Compact bordered row for boolean toggles (Active, same-as-billing). */
export function entityToggleRowClass() {
  return "flex items-center justify-between rounded-lg border border-border/80 px-3 py-2";
}

/** Full-width row inside a 2-column drawer grid. */
export function entityGridFullSpanClass() {
  return "col-span-full";
}
