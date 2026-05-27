import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WizardNavStatus } from "@/lib/onboarding/types";

export function WizardStepBadge({ status }: { status: WizardNavStatus }) {
  if (status === "DONE") {
    return (
      <Badge variant="completed" className="gap-1">
        <Check className="h-3 w-3" />
        DONE
      </Badge>
    );
  }
  if (status === "ACTIVE") {
    return <Badge variant="active">ACTIVE</Badge>;
  }
  return <Badge variant="locked">LOCKED</Badge>;
}
