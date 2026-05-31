"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { NavTextLinkContent } from "@/components/layout/nav-link-content";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import type { ModuleNavChild, ModuleNavItem } from "@/components/layout/module-nav";
import { cn } from "@/lib/utils";

type Props = {
  module: ModuleNavItem;
  activeHref: string;
};

const SOON_BADGE =
  "ml-auto rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground";

export function ModuleSubNav({ module, activeHref }: Props) {
  const router = useRouter();
  const sections = module.children ?? [];
  if (sections.length < 2) return null;

  const chips = sections.map((section) => ({
    id: section.href,
    label: section.label,
  }));

  const handleSelect = (href: string) => {
    if (href !== activeHref) router.push(href);
  };

  return (
    <>
      {/* Mobile / tablet: horizontal sub-tab bar under the page header (non-sticky). */}
      <div className="mb-3 lg:hidden">
        <SectionScrollChipBar
          chips={chips}
          activeId={activeHref}
          onSelect={handleSelect}
          embedded
          className="rounded-lg border border-border bg-background/95 px-1 py-1.5"
        />
      </div>

      {/* Desktop: secondary left sub-rail. */}
      <nav aria-label={`${module.label} sections`} className="hidden lg:block">
        <div className="sticky top-0 space-y-1 pt-0.5">
          {sections.map((section) => (
            <ModuleSubNavLink
              key={section.href}
              section={section}
              active={section.href === activeHref}
            />
          ))}
        </div>
      </nav>
    </>
  );
}

function ModuleSubNavLink({
  section,
  active,
}: {
  section: ModuleNavChild;
  active: boolean;
}) {
  return (
    <Link
      href={section.href}
      prefetch
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
        active
          ? "bg-secondary font-medium text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      <NavTextLinkContent className="min-w-0 flex-1">
        <span className="truncate">{section.label}</span>
      </NavTextLinkContent>
      {section.comingSoon ? <span className={SOON_BADGE}>Soon</span> : null}
    </Link>
  );
}
