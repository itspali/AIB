import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isOrganizationGstRegistered } from "@/lib/procurement/purchase-orders/po-gst-compliance";
import { mapOrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";

export async function fetchOrganizationGstRegistered(
  supabase: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("tenants")
    .select(
      "name, legal_name, trade_name, tax_identifier, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_zip_postal, billing_country_code"
    )
    .eq("id", tenantId)
    .maybeSingle();

  if (!data) return false;
  return isOrganizationGstRegistered(mapOrganizationBillToSnapshot(data));
}
