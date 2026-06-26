"use client";

import { AlertTriangle, ClipboardCheck, Wallet, Warehouse } from "lucide-react";
import { OverviewSectionShell } from "@/components/layout/overview-primitives";
import { formatCurrency } from "@/lib/dashboard/format";
import type { DashboardMetrics } from "@/lib/dashboard/types";
import { MetricCard } from "@/components/dashboard/metric-card";
import { soCreditHoldListHref } from "@/lib/sales/navigation";

type MetricGaugeCardsProps = {
  metrics: DashboardMetrics;
};

export function MetricGaugeCards({ metrics }: MetricGaugeCardsProps) {
  return (
    <OverviewSectionShell
      title="Operational summary"
      description="Live capital, inventory, and pipeline signals from your workspace."
      className="mb-8"
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Net capital exposure"
          value={formatCurrency(metrics.netCapitalExposure)}
          subtitle="AR net balance minus unpaid vendor liabilities"
          icon={Wallet}
          accent="cyan"
          sparkline={metrics.sparklines.netCapital}
          href="/financials"
        />
        <MetricCard
          title="Inventory valuation"
          value={formatCurrency(metrics.inventoryValuation)}
          subtitle="On-hand quantity × average cost across locations"
          icon={Warehouse}
          accent="emerald"
          sparkline={metrics.sparklines.inventory}
          href="/inventory"
        />
        <MetricCard
          title="Pending approvals"
          value={String(metrics.kpiCounts.pendingApprovals)}
          subtitle="Documents and transfers awaiting managerial action"
          icon={ClipboardCheck}
          accent="amber"
          href="/approvals"
        />
        <MetricCard
          title="Credit holds"
          value={String(metrics.kpiCounts.creditHolds)}
          subtitle="Sales orders blocked on credit policy"
          icon={AlertTriangle}
          accent="violet"
          href={soCreditHoldListHref()}
        />
      </div>
    </OverviewSectionShell>
  );
}
