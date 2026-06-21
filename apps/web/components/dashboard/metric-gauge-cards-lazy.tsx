"use client";

import { lazyClientExport } from "@/lib/lazy/lazy-client-export";
import type { DashboardMetrics } from "@/lib/dashboard/types";

const MetricGaugeCards = lazyClientExport(
  () => import("@/components/dashboard/metric-gauge-cards"),
  "MetricGaugeCards"
);

type Props = {
  metrics: DashboardMetrics;
};

export function MetricGaugeCardsLazy({ metrics }: Props) {
  return <MetricGaugeCards metrics={metrics} />;
}
