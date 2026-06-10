-- Per-location document layout overrides (nullable location_id on tenant templates).

ALTER TABLE public.document_layout_templates
    ADD COLUMN IF NOT EXISTS location_id UUID NULL
        REFERENCES public.tenant_locations (id) ON DELETE CASCADE;

ALTER TABLE public.document_layout_templates
    DROP CONSTRAINT IF EXISTS document_layout_templates_module_view_unique;

CREATE UNIQUE INDEX IF NOT EXISTS document_layout_templates_tenant_default_unique
    ON public.document_layout_templates (tenant_id, module_key, view_context)
    WHERE location_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS document_layout_templates_location_override_unique
    ON public.document_layout_templates (tenant_id, module_key, view_context, location_id)
    WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS document_layout_templates_location_id_idx
    ON public.document_layout_templates (tenant_id, location_id)
    WHERE location_id IS NOT NULL;
