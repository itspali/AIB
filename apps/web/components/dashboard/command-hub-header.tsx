import { Radio } from "lucide-react";

type CommandHubHeaderProps = {
  approvalAlertCount?: number;
};

export function CommandHubHeader({ approvalAlertCount = 0 }: CommandHubHeaderProps) {
  return (
    <header className="relative mb-10 overflow-hidden rounded-2xl border border-border/80 bg-card/60 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:shadow-glow-sm md:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <Radio className="h-3 w-3 animate-pulse-glow" aria-hidden />
              Live sync active
            </span>
            {approvalAlertCount > 0 && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                {approvalAlertCount} approval{approvalAlertCount === 1 ? "" : "s"} pending
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="gradient-text">Command Hub</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Your multi-tenant control centre — monitor exposure, tune workspace policy, and
            manage statutory tax slabs without leaving the canvas.
          </p>
        </div>

        <div className="flex shrink-0 gap-2 text-xs text-muted-foreground">
          <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2 dark:border-white/10 dark:bg-background/40">
            <span className="block font-medium text-foreground">Zone C</span>
            Active workspace
          </div>
          <div className="rounded-lg border border-border/80 bg-background/60 px-3 py-2 dark:border-white/10 dark:bg-background/40">
            <span className="block font-medium text-foreground">RLS</span>
            Tenant scoped
          </div>
        </div>
      </div>
    </header>
  );
}
