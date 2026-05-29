-- Custom saved views for native omnibar filters (per user, tenant, module).

CREATE TABLE IF NOT EXISTS public.custom_module_views (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    module_name         TEXT NOT NULL,
    view_name           VARCHAR(255) NOT NULL,
    raw_search_text     TEXT NOT NULL,
    compiled_ast        JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_system_default   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT custom_module_views_name_unique
        UNIQUE (tenant_id, user_id, module_name, view_name)
);

CREATE INDEX IF NOT EXISTS idx_custom_views_lookup
    ON public.custom_module_views (tenant_id, user_id, module_name);

CREATE TRIGGER custom_module_views_set_updated_at
    BEFORE UPDATE ON public.custom_module_views
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.custom_module_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS custom_module_views_owner_all ON public.custom_module_views;

CREATE POLICY custom_module_views_owner_all
    ON public.custom_module_views
    FOR ALL
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    );

COMMENT ON TABLE public.custom_module_views IS
    'User-owned saved native filter views keyed by module scope.';
