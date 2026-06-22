import Link from "next/link";
import { Radio } from "lucide-react";

type ConsoleHubPill = {
  label: string;
  href: string;
  tone?: "amber" | "emerald" | "violet";
};

type ConsoleHubHeaderProps = {
  pills?: ConsoleHubPill[];
  deployLabel?: string | null;
};

const pillToneClass: Record<NonNullable<ConsoleHubPill["tone"]>, string> = {
  amber:
    "border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-300",
  emerald:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300",
  violet:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 hover:bg-violet-500/20 dark:text-violet-300",
};

export function ConsoleHubHeader({ pills = [], deployLabel }: ConsoleHubHeaderProps) {
  return (
    <header className="relative mb-10 overflow-hidden rounded-2xl border border-border/80 border-black/[0.06] bg-card p-6 shadow-md shadow-black/[0.04] shadow-glow-sm backdrop-blur-xl dark:border-white/10 dark:bg-card/60 dark:shadow-sm md:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-300">
              <Radio className="h-3 w-3 animate-pulse-glow" aria-hidden />
              Control Plane
            </span>
            {pills.map((pill) => (
              <Link
                key={pill.href}
                href={pill.href}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${pillToneClass[pill.tone ?? "amber"]}`}
              >
                {pill.label}
              </Link>
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-violet-600 via-amber-600 to-violet-500 bg-clip-text text-transparent dark:from-violet-300 dark:via-amber-300 dark:to-violet-200">
              Control Plane
            </span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Platform health in one view — monitor signup funnel velocity, tenant lifecycle, and
            operator queues across every workspace.
          </p>
        </div>

        <div className="flex shrink-0 gap-2 text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/80 border-black/[0.06] bg-muted/40 px-3 py-2 dark:border-white/10 dark:bg-background/40">
            <span className="block font-medium text-foreground">Cross-tenant</span>
            Service role reads
          </div>
          <div className="rounded-lg border border-border/80 border-black/[0.06] bg-muted/40 px-3 py-2 dark:border-white/10 dark:bg-background/40">
            <span className="block font-medium text-foreground">Audited</span>
            Operator actions
          </div>
          {deployLabel ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-900 dark:text-amber-200">
              <span className="block font-medium text-foreground">Deploy</span>
              {deployLabel}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
