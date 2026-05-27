import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TenantProfile } from "@/lib/onboarding/types";

type TenantProfileCardProps = {
  tenant: TenantProfile;
  progressPercent: number;
};

export function TenantProfileCard({ tenant, progressPercent }: TenantProfileCardProps) {
  return (
    <Card className="border-neutral-200 bg-neutral-50/50">
      <CardHeader>
        <CardTitle className="text-2xl font-bold tracking-tight">
          {tenant.trade_name || tenant.name}
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Complete your corporate profile and milestone setup to launch the AIB Smart ERP workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
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
            <dt className="font-medium text-muted-foreground">Onboarding Status</dt>
            <dd className="capitalize">{tenant.onboarding_status.replace(/_/g, " ").toLowerCase()}</dd>
          </div>
        </dl>
        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-medium text-muted-foreground">Tenant readiness</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
