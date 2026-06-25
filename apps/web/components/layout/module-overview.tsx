import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { OverviewSectionShell, OverviewShortcutCard } from "@/components/layout/overview-primitives";

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
  /** When nested inside another module page, render a section heading instead of a page title. */
  headingLevel?: 1 | 2;
};

/** Shared module landing layout: section shortcut cards under the module header. */
export function ModuleOverview({ title, description, cards, headingLevel = 1 }: Props) {
  if (headingLevel === 2) {
    return (
      <OverviewSectionShell title={title} description={description} headingLevel={2}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <OverviewShortcutCard key={card.href} {...card} />
          ))}
        </div>
      </OverviewSectionShell>
    );
  }

  return (
    <OverviewSectionShell title={title} description={description} headingLevel={1}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <OverviewShortcutCard key={card.href} {...card} />
        ))}
      </div>
    </OverviewSectionShell>
  );
}
