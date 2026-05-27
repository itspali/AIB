import { Badge } from "@/components/ui/badge";
import type { MilestoneStatus } from "@/lib/onboarding/types";

const labels: Record<MilestoneStatus, string> = {
  COMPLETED: "COMPLETED",
  ACTION_REQUIRED: "ACTION_REQUIRED",
  LOCKED: "LOCKED",
};

const variants: Record<MilestoneStatus, "completed" | "action_required" | "locked"> = {
  COMPLETED: "completed",
  ACTION_REQUIRED: "action_required",
  LOCKED: "locked",
};

export function MilestoneBadge({ status }: { status: MilestoneStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
