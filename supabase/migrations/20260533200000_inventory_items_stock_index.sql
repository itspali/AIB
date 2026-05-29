-- Additive inventory search performance indexes (stock list aggregation + module views guard).

CREATE INDEX IF NOT EXISTS item_valuations_tenant_item_idx
    ON public.item_valuations (tenant_id, item_id);

COMMENT ON INDEX public.item_valuations_tenant_item_idx IS
    'Accelerates aggregate stock-on-hand lookups for the Items list workspace.';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'custom_module_views'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'custom_module_views_module_name_chk'
    ) THEN
        ALTER TABLE public.custom_module_views
            ADD CONSTRAINT custom_module_views_module_name_chk
            CHECK (
                module_name IN (
                    'items',
                    'categories',
                    'locations',
                    'procurement',
                    'sales',
                    'logistics',
                    'financials'
                )
            );
    END IF;
END $$;
