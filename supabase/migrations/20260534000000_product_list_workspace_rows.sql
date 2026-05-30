-- Denormalized Items list projection: one row per item for workspace list + pagination.

CREATE OR REPLACE VIEW public.product_list_workspace_rows
WITH (security_invoker = true) AS
SELECT
    i.id,
    i.tenant_id,
    i.name,
    i.description,
    i.classification,
    i.base_unit_of_measure,
    i.category_id,
    ic.name AS category_name,
    i.hsn_sac_code,
    i.has_variants,
    i.default_tax_category,
    i.is_active,
    i.is_purchasable,
    i.is_salable,
    i.is_returnable,
    i.created_at,
    i.updated_at,
    dv.id AS default_variant_id,
    dv.sku AS default_sku,
    dv.barcode,
    (
        SELECT pbe.price
        FROM public.price_book_entries pbe
        INNER JOIN public.price_books pb
            ON pb.id = pbe.price_book_id
            AND pb.tenant_id = pbe.tenant_id
        WHERE pbe.tenant_id = i.tenant_id
          AND pbe.item_id = i.id
          AND pb.is_active = TRUE
          AND pbe.min_quantity = 1
        ORDER BY pb.created_at ASC
        LIMIT 1
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price,
    (
        SELECT e.name
        FROM public.supplier_items si
        INNER JOIN public.entities e
            ON e.id = si.supplier_id
            AND e.tenant_id = si.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.id, v.sku, v.barcode
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.created_at ASC
    LIMIT 1
) dv ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
) stock ON TRUE
LEFT JOIN LATERAL (
    SELECT im.storage_url
    FROM public.item_media im
    WHERE im.tenant_id = i.tenant_id
      AND im.item_id = i.id
      AND (
          im.variant_id IS NULL
          OR im.variant_id = dv.id
      )
    ORDER BY
        im.is_primary DESC,
        CASE WHEN im.variant_id IS NULL THEN 0 ELSE 1 END,
        im.sort_order ASC,
        im.created_at ASC
    LIMIT 1
) primary_media ON TRUE;

CREATE INDEX IF NOT EXISTS items_tenant_name_idx
    ON public.items (tenant_id, name);

COMMENT ON VIEW public.product_list_workspace_rows IS
    'Workspace Items list projection with default variant, pricing, stock, and primary media path.';

GRANT SELECT ON public.product_list_workspace_rows TO authenticated;
