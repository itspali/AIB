"use server";

import { requireTenantId } from "@/lib/supabase/require-tenant";
import { fetchPoLineCatalogContext } from "@/lib/procurement/purchase-orders/catalog-context";

export async function lookupSalesLineCatalogContext(input: { variant_id: string }) {
  const variantId = input.variant_id?.trim();
  if (!variantId) {
    return { error: "Variant is required." } as const;
  }

  const { supabase, tenantId } = await requireTenantId();
  const context = await fetchPoLineCatalogContext(supabase, tenantId, variantId);
  if (!context) {
    return { error: "Item catalog details were not found for this variant." } as const;
  }

  return { context } as const;
}
