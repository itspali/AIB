import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PIPELINE_STAGE_LABELS } from "@/lib/console/pipeline-stage";
import type { PipelineStage } from "@/lib/console/types";
import { cn } from "@/lib/utils";

function pipelineStageVariant(stage: PipelineStage): BadgeProps["variant"] {
  switch (stage) {
    case "LIVE":
    case "PAYING":
      return "completed";
    case "TRIAL":
      return "action_required";
    case "CHURNED":
      return "administrative";
    case "ONBOARDING":
    case "TENANT_CREATED":
    case "EMAIL_VERIFIED":
      return "active";
    case "REGISTERED":
    default:
      return "locked";
  }
}

type PipelineStageBadgeProps = {
  stage: PipelineStage;
  className?: string;
};

export function PipelineStageBadge({ stage, className }: PipelineStageBadgeProps) {
  return (
    <Badge variant={pipelineStageVariant(stage)} className={cn(className)}>
      {PIPELINE_STAGE_LABELS[stage]}
    </Badge>
  );
}
