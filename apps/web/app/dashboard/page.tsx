import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  if (!snapshot.isOnboardingComplete) redirect("/onboarding");

  return (
    <DashboardShell orgName={snapshot.tenant.trade_name || snapshot.tenant.name}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">Workspace Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Your tenant is live. Module consoles for Procurement, Inventory, Sales, and Financials are
          available from the navigation rail on desktop or the bottom tab bar on mobile.
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
