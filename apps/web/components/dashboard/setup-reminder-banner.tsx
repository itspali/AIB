import Link from "next/link";
import { ArrowRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HubPanel } from "@/components/dashboard/hub-panel";
import { NEUTRAL_FINANCE_REMINDER_COPY } from "@/lib/onboarding/business-model";

export function SetupReminderBanner() {
  const copy = NEUTRAL_FINANCE_REMINDER_COPY;

  return (
    <HubPanel accent="amber" icon={Settings2} className="mb-8 p-6 md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Setup</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{copy.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/onboarding">
            {copy.cta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </HubPanel>
  );
}
