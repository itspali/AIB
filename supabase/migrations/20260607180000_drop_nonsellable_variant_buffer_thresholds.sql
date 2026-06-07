-- Reorder thresholds apply to stocked sellable SKUs, not multi-SKU master anchors.

DELETE FROM public.inventory_buffer_thresholds bt
USING public.item_variants v
WHERE v.id = bt.variant_id
  AND v.tenant_id = bt.tenant_id
  AND v.is_sellable = FALSE;
