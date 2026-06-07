-- Speed peek-drawer stock lookups filtered by variant_id.
CREATE INDEX IF NOT EXISTS item_valuations_tenant_item_variant_idx
    ON public.item_valuations (tenant_id, item_id, variant_id);

COMMENT ON INDEX public.item_valuations_tenant_item_variant_idx IS
    'Peek drawer valuations: eq filters on tenant_id, item_id, variant_id.';
