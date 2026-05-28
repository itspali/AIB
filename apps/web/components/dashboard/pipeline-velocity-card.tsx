"use client";

import { Badge } from "@/components/ui/badge";
import { MetricSparkline } from "@/components/dashboard/metric-sparkline";
import { HubPanel } from "@/components/dashboard/hub-panel";
import { Activity } from "lucide-react";
import type { PipelineCounts } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type PipelineVelocityCardProps = {
  counts: PipelineCounts;
  sparkline?: number[];
};

function VelocityRow({
  label,
  count,
  total,
  variant,
  barClass,
}: {
  label: string;
  count: number;
  total: number;
  variant: "completed" | "active" | "action_required";
  barClass: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-right text-lg font-semibold tracking-tight tabular-nums">
          {count}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/80">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barClass)}
          style={{ width: `${Math.max(pct, count > 0 ? 8 : 0)}%` }}
        />
      </div>
    </div>
  );
}

export function PipelineVelocityCard({ counts, sparkline }: PipelineVelocityCardProps) {
  const total = counts.fullyPaid + counts.dispatchedInTransit + counts.creditHold;

  return (
    <HubPanel accent="violet" icon={Activity}>
      <div className="p-6 pr-16">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Pipeline Order Velocity</p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {total} active pipeline signal{total === 1 ? "" : "s"}
            </p>
          </div>
          {sparkline && sparkline.length > 0 && (
            <MetricSparkline data={sparkline} accent="violet" className="shrink-0" />
          )}
        </div>
        <div className="mt-5 space-y-4">
          <VelocityRow
            label="FULLY_PAID"
            count={counts.fullyPaid}
            total={total}
            variant="completed"
            barClass="bg-emerald-400/80"
          />
          <VelocityRow
            label="DISPATCHED_IN_TRANSIT"
            count={counts.dispatchedInTransit}
            total={total}
            variant="active"
            barClass="bg-indigo-400/80"
          />
          <VelocityRow
            label="CREDIT_HOLD"
            count={counts.creditHold}
            total={total}
            variant="action_required"
            barClass="bg-amber-400/80"
          />
        </div>
      </div>
    </HubPanel>
  );
}
