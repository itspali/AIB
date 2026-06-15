import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveSalesCommerceSupplyStates,
  SALES_SUPPLY_STATE_RESOLUTION_ERROR,
} from "@/lib/sales/shared/sales-commerce-draft";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

type ResolveSalesSupplyStatesServerInput = {
  customerId: string;
  originLocationId?: string | null;
  billingState?: string | null;
  shippingState?: string | null;
};

export async function resolveSalesCommerceSupplyStatesServer(
  supabase: SupabaseClient,
  tenantId: string,
  input: ResolveSalesSupplyStatesServerInput
): Promise<
  | { billing_state: string; shipping_state: string }
  | { error: string }
> {
  const customerId = input.customerId.trim();
  if (!customerId) {
    return { error: "Select a customer." };
  }

  const locationId = input.originLocationId?.trim() || null;

  const [customerResult, locationResult] = await Promise.all([
    supabase
      .from("entities")
      .select("billing_state, shipping_state")
      .eq("tenant_id", tenantId)
      .eq("id", customerId)
      .maybeSingle(),
    locationId
      ? supabase
          .from("tenant_locations")
          .select("state")
          .eq("tenant_id", tenantId)
          .eq("id", locationId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (customerResult.error) {
    return { error: customerResult.error.message };
  }
  if (locationResult.error) {
    return { error: locationResult.error.message };
  }

  const customers: CustomerOption[] = customerResult.data
    ? [
        {
          id: customerId,
          name: "",
          payment_terms_days: 0,
          base_currency_override: null,
          billing_state: (customerResult.data.billing_state as string | null) ?? null,
          shipping_state: (customerResult.data.shipping_state as string | null) ?? null,
        },
      ]
    : [];

  const locations: SalesLocationOption[] =
    locationId && locationResult.data
      ? [
          {
            id: locationId,
            name: "",
            code: "",
            state: (locationResult.data.state as string | null) ?? null,
          },
        ]
      : [];

  const resolved = resolveSalesCommerceSupplyStates({
    customers,
    locations,
    customerId,
    originLocationId: locationId,
    billingState: input.billingState,
    shippingState: input.shippingState,
  });

  if (!resolved.billing_state.trim() || !resolved.shipping_state.trim()) {
    return { error: SALES_SUPPLY_STATE_RESOLUTION_ERROR };
  }

  return resolved;
}
