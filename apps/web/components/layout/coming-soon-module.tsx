import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

type Props = {
  title: string;
  description: string;
  icon: LucideIcon;
  plannedSections: string[];
};

/** Placeholder shell for modules that are planned but not yet built. */
export function ComingSoonModule({ title, description, icon: Icon, plannedSections }: Props) {
  return (
    <div className="canvas-scroll-endpad">
      <header className="mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden />
            Coming soon
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="surface-inset flex flex-col items-center justify-center border-dashed px-6 py-12 text-center">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <Icon className="h-8 w-8 text-primary" aria-hidden />
        </span>
        <p className="text-sm font-medium text-foreground">This module is under construction.</p>
        <p className="mt-1 max-w-md text-xs text-muted-foreground">
          The planned sections below will follow the same list, drawer, and editor patterns as the
          Items master.
        </p>

        {plannedSections.length ? (
          <ul className="mt-5 flex flex-wrap justify-center gap-2">
            {plannedSections.map((section) => (
              <li
                key={section}
                className="rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground"
              >
                {section}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
