import Link from "next/link";
import { AlertTriangle, ArrowLeftRight, ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OverviewSectionShell } from "@/components/layout/overview-primitives";
import { formatDate } from "@/lib/dashboard/format";
import type { DashboardAttentionItem, DashboardAttentionKind } from "@/lib/dashboard/types";

type Props = {
  items: DashboardAttentionItem[];
};

const KIND_LABEL: Record<DashboardAttentionKind, string> = {
  APPROVAL: "Approval",
  CREDIT_HOLD: "Credit hold",
  TRANSFER_APPROVAL: "Transfer",
};

const KIND_ICON: Record<DashboardAttentionKind, typeof ClipboardCheck> = {
  APPROVAL: ClipboardCheck,
  CREDIT_HOLD: AlertTriangle,
  TRANSFER_APPROVAL: ArrowLeftRight,
};

const KIND_BADGE: Record<DashboardAttentionKind, "action_required" | "administrative" | "active"> = {
  APPROVAL: "action_required",
  CREDIT_HOLD: "action_required",
  TRANSFER_APPROVAL: "active",
};

export function NeedsAttentionSection({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <OverviewSectionShell
      title="Needs attention"
      description="Approvals, credit holds, and transfer gates that may need action today."
      className="mb-8"
    >
      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <li key={item.id}>
              <article className="surface-panel flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-primary/30">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
                    <Icon className="h-4 w-4 text-primary" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      <Badge variant={KIND_BADGE[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
                    </div>
                    {item.subtitle ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">{item.subtitle}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.submittedAt ? `Updated ${formatDate(item.submittedAt)}` : "Pending"}
                      {item.amountLabel ? ` · ${item.amountLabel}` : ""}
                    </p>
                  </div>
                </div>
                <Button type="button" size="sm" variant="outline" asChild className="shrink-0">
                  <Link href={item.href}>Review</Link>
                </Button>
              </article>
            </li>
          );
        })}
      </ul>
      <div className="mt-3">
        <Link href="/approvals" className="text-sm font-medium text-primary hover:underline">
          View all approvals
        </Link>
      </div>
    </OverviewSectionShell>
  );
}
