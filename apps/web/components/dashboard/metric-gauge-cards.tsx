"use client";

import { Activity, Wallet, Warehouse } from "lucide-react";
import { formatCurrency } from "@/lib/dashboard/format";
import type { DashboardMetrics } from "@/lib/dashboard/types";
import { HubSectionHeading } from "@/components/dashboard/hub-panel";
import { MetricCard } from "@/components/dashboard/metric-card";
import { PipelineVelocityCard } from "@/components/dashboard/pipeline-velocity-card";

type MetricGaugeCardsProps = {
  metrics: DashboardMetrics;
};

export function MetricGaugeCards({ metrics }: MetricGaugeCardsProps) {
  return (
    <section aria-label="Operational analytical gauges" className="mb-10">
      <HubSectionHeading
        step="01"
        title="Live Operational Gauges"
        description="Real-time capital, inventory, and order pipeline signals from Supabase."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Net Capital Cash Flow Exposure"
          value={formatCurrency(metrics.netCapitalExposure)}
          subtitle="1200-AR net balance minus unpaid vendor liabilities"
          icon={Wallet}
          accent="cyan"
          sparkline={metrics.sparklines.netCapital}
        />
        <MetricCard
          title="Multi-Warehouse Inventory Valuation"
          value={formatCurrency(metrics.inventoryValuation)}
          subtitle="On-hand quantity × average cost across all locations"
          icon={Warehouse}
          accent="emerald"
          sparkline={metrics.sparklines.inventory}
        />
        <PipelineVelocityCard
          counts={metrics.pipelineCounts}
          sparkline={metrics.sparklines.pipeline}
        />
      </div>
    </section>
  );
}
