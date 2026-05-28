"use client";

import type { LucideIcon } from "lucide-react";
import { MetricSparkline } from "@/components/dashboard/metric-sparkline";
import { HubPanel } from "@/components/dashboard/hub-panel";
import { cn } from "@/lib/utils";

type HubAccent = "cyan" | "violet" | "emerald" | "amber";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  accent?: HubAccent;
  sparkline?: number[];
  className?: string;
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent = "cyan",
  sparkline,
  className,
}: MetricCardProps) {
  return (
    <HubPanel accent={accent} icon={icon} className={className}>
      <div className="p-6 pr-16">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {sparkline && sparkline.length > 0 && (
            <MetricSparkline data={sparkline} accent={accent} className="shrink-0" />
          )}
        </div>
        <p className={cn("mt-3 text-right text-3xl font-semibold tracking-tight tabular-nums")}>
          {value}
        </p>
        {subtitle && (
          <p className="mt-2 text-right text-xs leading-relaxed text-muted-foreground/80">
            {subtitle}
          </p>
        )}
      </div>
    </HubPanel>
  );
}
