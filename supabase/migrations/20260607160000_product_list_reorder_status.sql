-- List workspace views: expose item reorder default and per-location below-reorder signal.

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
    COALESCE(i.code, dv.sku) AS default_sku,
    dv.barcode,
    COALESCE(
        dv.price,
        (
            SELECT pbe.price
            FROM public.price_book_entries pbe
            INNER JOIN public.price_books pb
                ON pb.id = pbe.price_book_id
                AND pb.tenant_id = pbe.tenant_id
            WHERE pbe.tenant_id = i.tenant_id
              AND pbe.item_id = i.id
              AND (pbe.variant_id = dv.id OR pbe.variant_id IS NULL)
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY (pbe.variant_id = dv.id) DESC NULLS LAST, pb.created_at ASC
            LIMIT 1
        )
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
        FROM public.entities e
        INNER JOIN public.supplier_items si
            ON si.supplier_id = e.id
            AND si.tenant_id = e.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
        ORDER BY si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path,
    i.variant_strategy::TEXT AS variant_strategy,
    i.code AS style_code,
    dv.is_master AS variant_is_master,
    dv.is_sellable AS variant_is_sellable,
    COALESCE(vc.sellable_variant_count, 0) AS sellable_variant_count,
    COALESCE(
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
        0::NUMERIC
    ) AS reorder_point,
    (
        i.track_inventory = TRUE
        AND EXISTS (
            SELECT 1
            FROM public.item_variants vv
            INNER JOIN public.tenant_locations tl
                ON tl.tenant_id = i.tenant_id
               AND tl.is_active = TRUE
               AND tl.is_stock_holding = TRUE
               AND tl.presence_type IS DISTINCT FROM 'VIRTUAL'
            LEFT JOIN public.item_valuations iv
                ON iv.tenant_id = i.tenant_id
               AND iv.item_id = i.id
               AND iv.variant_id = vv.id
               AND iv.location_id = tl.id
            LEFT JOIN public.inventory_buffer_thresholds bt
                ON bt.tenant_id = i.tenant_id
               AND bt.item_id = i.id
               AND bt.variant_id = vv.id
               AND bt.location_id = tl.id
            WHERE vv.tenant_id = i.tenant_id
              AND vv.item_id = i.id
              AND vv.is_sellable = TRUE
              AND GREATEST(
                    COALESCE(
                        bt.reorder_point_qty,
                        NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
                        NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
                        0::NUMERIC
                    ),
                    0::NUMERIC
                ) > 0
              AND COALESCE(iv.total_quantity_on_hand, 0)
                    <= COALESCE(
                        bt.reorder_point_qty,
                        NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
                        NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
                        0::NUMERIC
                    )
        )
    ) AS below_reorder
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.id, v.sku, v.barcode, v.price, v.is_master, v.is_sellable
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.is_sellable DESC, v.is_master DESC, v.created_at ASC
    LIMIT 1
) dv ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    INNER JOIN public.item_variants vv
        ON vv.id = iv.variant_id
        AND vv.tenant_id = iv.tenant_id
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
      AND vv.is_sellable = TRUE
) stock ON TRUE
LEFT JOIN LATERAL (
    SELECT COUNT(*)::INTEGER AS sellable_variant_count
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
      AND v.is_sellable = TRUE
) vc ON TRUE
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

GRANT SELECT ON public.product_list_workspace_rows TO authenticated;

CREATE OR REPLACE VIEW public.product_list_workspace_variant_rows
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
    v.id AS variant_id,
    v.id AS default_variant_id,
    v.sku AS default_sku,
    v.barcode,
    v.variant_attributes,
    v.is_active AS variant_is_active,
    COALESCE(
        v.price,
        (
            SELECT pbe.price
            FROM public.price_book_entries pbe
            INNER JOIN public.price_books pb
                ON pb.id = pbe.price_book_id
                AND pb.tenant_id = pbe.tenant_id
            WHERE pbe.tenant_id = i.tenant_id
              AND pbe.item_id = i.id
              AND (pbe.variant_id = v.id OR pbe.variant_id IS NULL)
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY (pbe.variant_id = v.id) DESC NULLS LAST, pb.created_at ASC
            LIMIT 1
        )
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
          AND (si.variant_id = v.id OR si.variant_id IS NULL)
        ORDER BY (si.variant_id = v.id) DESC NULLS LAST, si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price,
    (
        SELECT e.name
        FROM public.entities e
        INNER JOIN public.supplier_items si
            ON si.supplier_id = e.id
            AND si.tenant_id = e.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
          AND (si.variant_id = v.id OR si.variant_id IS NULL)
        ORDER BY (si.variant_id = v.id) DESC NULLS LAST, si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(variant_stock.total_quantity_on_hand, 0) AS stock_on_hand,
    variant_media.storage_url AS primary_image_storage_path,
    i.variant_strategy::TEXT AS variant_strategy,
    i.code AS style_code,
    v.is_master AS variant_is_master,
    v.is_sellable AS variant_is_sellable,
    COALESCE(
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
        0::NUMERIC
    ) AS reorder_point,
    (
        i.track_inventory = TRUE
        AND COALESCE(
            (
                SELECT BOOL_OR(
                    GREATEST(
                        COALESCE(
                            bt.reorder_point_qty,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
                            0::NUMERIC
                        ),
                        0::NUMERIC
                    ) > 0
                    AND COALESCE(iv.total_quantity_on_hand, 0)
                        <= COALESCE(
                            bt.reorder_point_qty,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
                            0::NUMERIC
                        )
                )
                FROM public.tenant_locations tl
                LEFT JOIN public.item_valuations iv
                    ON iv.tenant_id = i.tenant_id
                   AND iv.item_id = i.id
                   AND iv.variant_id = v.id
                   AND iv.location_id = tl.id
                LEFT JOIN public.inventory_buffer_thresholds bt
                    ON bt.tenant_id = i.tenant_id
                   AND bt.item_id = i.id
                   AND bt.variant_id = v.id
                   AND bt.location_id = tl.id
                WHERE tl.tenant_id = i.tenant_id
                  AND tl.is_active = TRUE
                  AND tl.is_stock_holding = TRUE
                  AND tl.presence_type IS DISTINCT FROM 'VIRTUAL'
            ),
            FALSE
        )
    ) AS below_reorder
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
INNER JOIN public.item_variants v
    ON v.tenant_id = i.tenant_id
    AND v.item_id = i.id
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
      AND iv.variant_id = v.id
) variant_stock ON TRUE
LEFT JOIN LATERAL (
    SELECT im.storage_url
    FROM public.item_media im
    WHERE im.tenant_id = i.tenant_id
      AND im.item_id = i.id
      AND (
          im.variant_id = v.id
          OR im.variant_id IS NULL
      )
    ORDER BY
        (im.variant_id = v.id) DESC,
        im.is_primary DESC,
        CASE WHEN im.variant_id IS NULL THEN 0 ELSE 1 END,
        im.sort_order ASC,
        im.created_at ASC
    LIMIT 1
) variant_media ON TRUE
WHERE i.has_variants = TRUE
  AND v.is_sellable = TRUE

UNION ALL

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
    dv.id AS variant_id,
    dv.id AS default_variant_id,
    dv.sku AS default_sku,
    dv.barcode,
    COALESCE(dv.variant_attributes, '{}'::jsonb) AS variant_attributes,
    dv.is_active AS variant_is_active,
    COALESCE(
        dv.price,
        (
            SELECT pbe.price
            FROM public.price_book_entries pbe
            INNER JOIN public.price_books pb
                ON pb.id = pbe.price_book_id
                AND pb.tenant_id = pbe.tenant_id
            WHERE pbe.tenant_id = i.tenant_id
              AND pbe.item_id = i.id
              AND (pbe.variant_id = dv.id OR pbe.variant_id IS NULL)
              AND pb.is_active = TRUE
              AND pbe.min_quantity = 1
            ORDER BY (pbe.variant_id = dv.id) DESC NULLS LAST, pb.created_at ASC
            LIMIT 1
        )
    ) AS selling_price,
    (
        SELECT si.supplier_price
        FROM public.supplier_items si
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
          AND (si.variant_id = dv.id OR si.variant_id IS NULL)
        ORDER BY (si.variant_id = dv.id) DESC NULLS LAST, si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS purchase_price,
    (
        SELECT e.name
        FROM public.entities e
        INNER JOIN public.supplier_items si
            ON si.supplier_id = e.id
            AND si.tenant_id = e.tenant_id
        WHERE si.tenant_id = i.tenant_id
          AND si.item_id = i.id
          AND (si.variant_id = dv.id OR si.variant_id IS NULL)
        ORDER BY (si.variant_id = dv.id) DESC NULLS LAST, si.is_preferred DESC, si.supplier_id ASC
        LIMIT 1
    ) AS supplier_name,
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path,
    i.variant_strategy::TEXT AS variant_strategy,
    i.code AS style_code,
    dv.is_master AS variant_is_master,
    dv.is_sellable AS variant_is_sellable,
    COALESCE(
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
        NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
        0::NUMERIC
    ) AS reorder_point,
    (
        i.track_inventory = TRUE
        AND dv.id IS NOT NULL
        AND COALESCE(
            (
                SELECT BOOL_OR(
                    GREATEST(
                        COALESCE(
                            bt.reorder_point_qty,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
                            0::NUMERIC
                        ),
                        0::NUMERIC
                    ) > 0
                    AND COALESCE(iv.total_quantity_on_hand, 0)
                        <= COALESCE(
                            bt.reorder_point_qty,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point'), '')::NUMERIC,
                            NULLIF(TRIM(i.custom_fields ->> 'reorder_point_qty'), '')::NUMERIC,
                            0::NUMERIC
                        )
                )
                FROM public.tenant_locations tl
                LEFT JOIN public.item_valuations iv
                    ON iv.tenant_id = i.tenant_id
                   AND iv.item_id = i.id
                   AND iv.variant_id = dv.id
                   AND iv.location_id = tl.id
                LEFT JOIN public.inventory_buffer_thresholds bt
                    ON bt.tenant_id = i.tenant_id
                   AND bt.item_id = i.id
                   AND bt.variant_id = dv.id
                   AND bt.location_id = tl.id
                WHERE tl.tenant_id = i.tenant_id
                  AND tl.is_active = TRUE
                  AND tl.is_stock_holding = TRUE
                  AND tl.presence_type IS DISTINCT FROM 'VIRTUAL'
            ),
            FALSE
        )
    ) AS below_reorder
FROM public.items i
LEFT JOIN public.item_categories ic
    ON ic.tenant_id = i.tenant_id
    AND ic.id = i.category_id
LEFT JOIN LATERAL (
    SELECT v.id, v.sku, v.barcode, v.price, v.variant_attributes, v.is_active, v.is_master, v.is_sellable
    FROM public.item_variants v
    WHERE v.tenant_id = i.tenant_id
      AND v.item_id = i.id
    ORDER BY v.is_sellable DESC, v.is_master DESC, v.created_at ASC
    LIMIT 1
) dv ON TRUE
LEFT JOIN LATERAL (
    SELECT SUM(iv.total_quantity_on_hand) AS total_quantity_on_hand
    FROM public.item_valuations iv
    WHERE iv.tenant_id = i.tenant_id
      AND iv.item_id = i.id
      AND (dv.id IS NULL OR iv.variant_id = dv.id)
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
) primary_media ON TRUE
WHERE i.has_variants = FALSE;

GRANT SELECT ON public.product_list_workspace_variant_rows TO authenticated;
