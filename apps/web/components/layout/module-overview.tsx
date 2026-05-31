import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type ModuleOverviewCard = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  comingSoon?: boolean;
};

type Props = {
  title: string;
  description: string;
  cards: ModuleOverviewCard[];
};

/** Shared module landing layout: section shortcut cards under the module header. */
export function ModuleOverview({ title, description, cards }: Props) {
  return (
    <div className="canvas-scroll-endpad">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const content = (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                  <Icon className="h-5 w-5 text-primary" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {card.label}
                    </span>
                    {card.comingSoon ? (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Soon
                      </span>
                    ) : null}
                  </span>
                </span>
                {!card.comingSoon ? (
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{card.description}</p>
            </>
          );

          if (card.comingSoon) {
            return (
              <div
                key={card.href}
                aria-disabled
                className="surface-panel cursor-default opacity-70"
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={card.href}
              href={card.href}
              prefetch
              className={cn(
                "surface-panel group block transition-colors",
                "hover:border-primary/30 hover:bg-accent/20"
              )}
            >
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
