import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { pickPrimaryImageStoragePath } from "@/lib/products/primary-image";

type MediaRow = {
  item_id: string;
  variant_id: string | null;
  storage_url: string;
  sort_order: number | null;
  is_primary: boolean | null;
};

type VariantMasterRow = {
  id: string;
  item_id: string;
  is_master: boolean | null;
};

export async function fetchVariantPrimaryImageUrl(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string,
  variantId: string
): Promise<string | null> {
  if (!itemId.trim() || !variantId.trim()) return null;

  const [{ data: mediaRows, error: mediaError }, { data: variantRows, error: variantError }] =
    await Promise.all([
      supabase
        .from("item_media")
        .select("item_id, variant_id, storage_url, sort_order, is_primary")
        .eq("tenant_id", tenantId)
        .eq("item_id", itemId),
      supabase
        .from("item_variants")
        .select("id, item_id, is_master")
        .eq("tenant_id", tenantId)
        .eq("item_id", itemId)
        .eq("is_active", true),
    ]);

  if (mediaError) throw new Error(mediaError.message);
  if (variantError) throw new Error(variantError.message);

  const storagePath = pickPrimaryImageStoragePath(
    (mediaRows ?? []).map((row) => ({
      item_id: row.item_id,
      variant_id: row.variant_id,
      storage_url: row.storage_url,
      sort_order: row.sort_order ?? 0,
      is_primary: row.is_primary,
    })),
    variantId,
    (variantRows ?? []).map((variant) => ({
      id: variant.id,
      item_id: variant.item_id,
      is_master: variant.is_master ?? undefined,
    }))
  );
  if (!storagePath) return null;

  const signedUrls = await resolveProductMediaSignedUrls(supabase, [storagePath]);
  return signedUrls.get(storagePath) ?? null;
}
