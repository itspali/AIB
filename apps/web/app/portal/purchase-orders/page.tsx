import { redirect } from "next/navigation";
import { SupplierPortalPurchaseOrdersTerminal } from "@/components/supplier-portal/supplier-portal-purchase-orders-terminal";
import {
  fetchSupplierPortalContext,
  fetchSupplierPortalPurchaseOrders,
} from "@/lib/supplier-portal/queries";
import { createClient } from "@/lib/supabase/server";
import { getSessionClaims } from "@/lib/supabase/auth";

export default async function PortalPurchaseOrdersPage() {
  const claims = await getSessionClaims();
  if (!claims?.tenantId || !claims.userId) {
    redirect("/login");
  }

  const supabase = await createClient();

  const portal = await fetchSupplierPortalContext(supabase, claims.tenantId, claims.userId);
  if (!portal) {
    return (
      <div className="rounded-md border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Supplier portal</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account is not linked to a supplier portal profile. Ask your customer&apos;s admin to
          provision supplier portal access.
        </p>
      </div>
    );
  }

  const orders = await fetchSupplierPortalPurchaseOrders(supabase, claims.tenantId);

  return (
    <SupplierPortalPurchaseOrdersTerminal
      portal={portal}
      orders={orders}
      tenantId={claims.tenantId}
    />
  );
}
