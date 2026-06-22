import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PIPELINE_STAGE_LABELS } from "@/lib/console/pipeline-stage";
import type { PipelineStage } from "@/lib/console/types";
import { cn } from "@/lib/utils";

export type SignupFunnelStep = {
  stage: PipelineStage;
  count: number;
  conversionPercent?: number | null;
  stuckCount?: number;
};

const FUNNEL_STAGES: PipelineStage[] = [
  "REGISTERED",
  "EMAIL_VERIFIED",
  "TENANT_CREATED",
  "LIVE",
  "TRIAL",
  "PAYING",
];

type SignupFunnelBarProps = {
  steps?: SignupFunnelStep[];
  className?: string;
};

function stepHref(stage: PipelineStage): string {
  return `/console/signups?stage=${encodeURIComponent(stage)}`;
}

export function SignupFunnelBar({ steps = [], className }: SignupFunnelBarProps) {
  const stepMap = new Map(steps.map((step) => [step.stage, step]));

  return (
    <div
      className={cn(
        "surface-inset overflow-x-auto rounded-xl border border-border/80 p-3 md:p-4",
        className
      )}
    >
      <div className="flex min-w-max items-stretch gap-1">
        {FUNNEL_STAGES.map((stage, index) => {
          const data = stepMap.get(stage);
          const count = data?.count ?? 0;
          const stuck = (data?.stuckCount ?? 0) > 0;
          const conversion =
            data?.conversionPercent != null ? `${data.conversionPercent}%` : null;

          return (
            <div key={stage} className="flex items-stretch">
              <Link
                href={stepHref(stage)}
                className={cn(
                  "group flex min-w-[7.5rem] flex-col rounded-lg border border-border/60 bg-card/60 px-3 py-2.5 transition-colors hover:border-violet-500/30 hover:bg-card",
                  stuck && "border-amber-500/40 ring-1 ring-amber-500/20"
                )}
              >
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {PIPELINE_STAGE_LABELS[stage]}
                </span>
                <span className="mt-1 text-lg font-semibold tabular-nums">{count}</span>
                {conversion ? (
                  <span className="mt-0.5 text-[11px] text-muted-foreground">{conversion} conv.</span>
                ) : (
                  <span className="mt-0.5 text-[11px] text-muted-foreground">&nbsp;</span>
                )}
                {stuck ? (
                  <span className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    {data?.stuckCount} stuck
                  </span>
                ) : null}
              </Link>
              {index < FUNNEL_STAGES.length - 1 ? (
                <div className="flex items-center px-1 text-muted-foreground/50" aria-hidden>
                  <ChevronRight className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
