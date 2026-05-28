import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type HubAccent = "cyan" | "violet" | "emerald" | "amber";

const accentStyles: Record<
  HubAccent,
  { bar: string; icon: string; glow: string }
> = {
  cyan: {
    bar: "from-cyan-400 via-primary to-transparent",
    icon: "bg-cyan-500/15 text-cyan-600 ring-cyan-500/25 dark:text-cyan-300 dark:ring-cyan-400/20",
    glow: "group-hover:shadow-cyan-500/10",
  },
  violet: {
    bar: "from-violet-400 via-accent to-transparent",
    icon: "bg-violet-500/15 text-violet-600 ring-violet-500/25 dark:text-violet-300 dark:ring-violet-400/20",
    glow: "group-hover:shadow-violet-500/10",
  },
  emerald: {
    bar: "from-emerald-400 to-transparent",
    icon: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300 dark:ring-emerald-400/20",
    glow: "group-hover:shadow-emerald-500/10",
  },
  amber: {
    bar: "from-amber-400 to-transparent",
    icon: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300 dark:ring-amber-400/20",
    glow: "group-hover:shadow-amber-500/10",
  },
};

type HubPanelProps = {
  children: React.ReactNode;
  className?: string;
  accent?: HubAccent;
  icon?: LucideIcon;
};

export function HubPanel({ children, className, accent = "cyan", icon: Icon }: HubPanelProps) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/80 shadow-md backdrop-blur-xl transition-all duration-200 hover:border-primary/30 hover:shadow-lg dark:bg-card/70 dark:shadow-lg dark:shadow-black/25 dark:hover:shadow-xl",
        styles.glow,
        className
      )}
    >
      <div
        className={cn("absolute inset-x-0 top-0 h-px bg-gradient-to-r opacity-80", styles.bar)}
        aria-hidden
      />
      {Icon && (
        <div
          className={cn(
            "absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-lg ring-1",
            styles.icon
          )}
          aria-hidden
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      {children}
    </div>
  );
}

export function HubSectionHeading({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/25">
        {step}
      </span>
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
  );
}
