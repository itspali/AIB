import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { humanOnboardingStatus } from "@/lib/onboarding/locale-presets";
import type { TenantProfile } from "@/lib/onboarding/types";

type TenantProfileCardProps = {
  tenant: TenantProfile;
  progressPercent: number;
  showDashboardExit?: boolean;
};

export function TenantProfileCard({
  tenant,
  progressPercent,
  showDashboardExit = false,
}: TenantProfileCardProps) {
  const statusLabel = humanOnboardingStatus(tenant.onboarding_status, progressPercent);

  return (
    <Card className="border-neutral-200 bg-neutral-50/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-bold tracking-tight md:text-2xl">
          {tenant.trade_name || tenant.name}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Finish the checklist below to complete your business setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="hidden gap-3 text-sm sm:grid sm:grid-cols-2">
          <div>
            <dt className="font-medium text-muted-foreground">Legal Name</dt>
            <dd>{tenant.legal_name || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Registration No.</dt>
            <dd>{tenant.legal_registration_number || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Tax Identifier</dt>
            <dd>{tenant.tax_identifier || "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">Setup Status</dt>
            <dd>{statusLabel}</dd>
          </div>
        </dl>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">Setup progress</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        {showDashboardExit ? (
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              You can explore the dashboard now. Finish finance setup when you are ready to invoice or
              buy stock.
            </p>
            <Button asChild variant="outline" className="shrink-0">
              <Link href="/dashboard">
                Go to dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
