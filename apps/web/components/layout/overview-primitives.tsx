import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type OverviewKpiTileProps = {
  label: string;
  value: string;
  subtitle?: string;
  href?: string;
  className?: string;
};

/** Compact KPI tile for module overview stat rails. */
export function OverviewKpiTile({ label, value, subtitle, href, className }: OverviewKpiTileProps) {
  const content = (
    <div className={cn("overview-kpi-tile surface-panel p-4", className)}>
      <p className="overview-kpi-tile__label text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="overview-kpi-tile__value mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {subtitle ? (
        <p className="overview-kpi-tile__sub mt-1 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );

  if (!href) return content;

  return (
    <Link
      href={href}
      className="block rounded-[10px] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  );
}

type OverviewShortcutCardProps = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  comingSoon?: boolean;
};

/** Shortcut card for module overview workflow grids. */
export function OverviewShortcutCard({
  href,
  label,
  description,
  icon: Icon,
  comingSoon = false,
}: OverviewShortcutCardProps) {
  const content = (
    <>
      <div className="flex items-center gap-3">
        <span className="overview-shortcut-card__icon flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{label}</span>
            {comingSoon ? (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Soon
              </span>
            ) : null}
          </span>
        </span>
        {!comingSoon ? (
          <ArrowRight
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        ) : null}
      </div>
      <p className="overview-shortcut-card__desc mt-3 text-xs text-muted-foreground">{description}</p>
    </>
  );

  if (comingSoon) {
    return (
      <div aria-disabled className="overview-shortcut-card surface-panel cursor-default opacity-70">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "overview-shortcut-card surface-panel group block transition-colors",
        "hover:border-primary/30 hover:bg-accent/20"
      )}
    >
      {content}
    </Link>
  );
}

type OverviewSectionShellProps = {
  title: string;
  description?: string;
  kicker?: string;
  headingLevel?: 1 | 2;
  children: React.ReactNode;
  className?: string;
};

/** Section wrapper with optional kicker for module overview pages. */
export function OverviewSectionShell({
  title,
  description,
  kicker,
  headingLevel = 2,
  children,
  className,
}: OverviewSectionShellProps) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const headingClass =
    headingLevel === 1
      ? "text-2xl font-bold tracking-tight"
      : "text-sm font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <section className={cn("overview-section-shell", className)}>
      <header className={headingLevel === 1 ? "mb-6" : "mb-3"}>
        {kicker ? (
          <p className="revamp-kicker mb-1">{kicker}</p>
        ) : null}
        <Heading className={headingClass}>{title}</Heading>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
