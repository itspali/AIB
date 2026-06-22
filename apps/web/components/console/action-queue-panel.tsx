import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { HubPanel, HubSectionHeading } from "@/components/dashboard/hub-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ActionQueueItem = {
  id: string;
  title: string;
  subtitle?: string;
  issueLabel?: string;
  href: string;
  actionLabel?: string;
  severity?: "amber" | "violet" | "emerald";
};

type ActionQueuePanelProps = {
  items: ActionQueueItem[];
  title?: string;
  description?: string;
  emptyMessage?: string;
  className?: string;
};

const severityBadgeClass: Record<NonNullable<ActionQueueItem["severity"]>, string> = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  violet: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

export function ActionQueuePanel({
  items,
  title = "Needs attention",
  description = "Stuck signups, expiring trials, and suspended tenants that need operator action.",
  emptyMessage = "All clear — no items need attention right now.",
  className,
}: ActionQueuePanelProps) {
  return (
    <section className={cn("mb-10", className)} aria-label={title}>
      <HubSectionHeading step="!" title={title} description={description} />
      <HubPanel accent="amber" icon={ClipboardList} className="p-5 md:p-6">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{item.title}</p>
                    {item.issueLabel ? (
                      <Badge
                        className={cn(
                          "font-medium",
                          severityBadgeClass[item.severity ?? "amber"]
                        )}
                      >
                        {item.issueLabel}
                      </Badge>
                    ) : null}
                  </div>
                  {item.subtitle ? (
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{item.subtitle}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.actionLabel ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.href}>{item.actionLabel}</Link>
                    </Button>
                  ) : (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={item.href}>View</Link>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {items.length > 0 ? (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            Actions are audited in the console activity log.
          </p>
        ) : null}
      </HubPanel>
    </section>
  );
}
