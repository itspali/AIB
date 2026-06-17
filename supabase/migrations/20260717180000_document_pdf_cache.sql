-- Document PDF cache in Storage + metadata table for invalidation

-- --------------------------------------------------------------------
-- 1. Storage bucket
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'document-pdfs',
    'document-pdfs',
    FALSE,
    10485760,
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS document_pdfs_select_tenant ON storage.objects;
CREATE POLICY document_pdfs_select_tenant
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'document-pdfs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS document_pdfs_insert_tenant ON storage.objects;
CREATE POLICY document_pdfs_insert_tenant
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'document-pdfs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS document_pdfs_update_tenant ON storage.objects;
CREATE POLICY document_pdfs_update_tenant
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'document-pdfs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    )
    WITH CHECK (
        bucket_id = 'document-pdfs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

DROP POLICY IF EXISTS document_pdfs_delete_tenant ON storage.objects;
CREATE POLICY document_pdfs_delete_tenant
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'document-pdfs'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

-- --------------------------------------------------------------------
-- 2. Cache metadata
-- --------------------------------------------------------------------
CREATE TABLE public.document_pdf_cache (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    module_key          TEXT NOT NULL,
    document_id         UUID NOT NULL,
    view_context        TEXT NOT NULL DEFAULT 'PDF_PRINT',
    location_id         UUID NULL REFERENCES tenant_locations (id) ON DELETE CASCADE,
    location_scope      TEXT NOT NULL DEFAULT 'tenant',
    storage_path        TEXT NOT NULL,
    source_updated_at   TIMESTAMPTZ NOT NULL,
    render_fingerprint  TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT document_pdf_cache_view_context_chk
        CHECK (view_context IN ('PDF_PRINT', 'EMAIL_HTML')),
    CONSTRAINT document_pdf_cache_lookup_unique
        UNIQUE (tenant_id, module_key, document_id, view_context, location_scope)
);

CREATE INDEX document_pdf_cache_tenant_module_idx
    ON public.document_pdf_cache (tenant_id, module_key);

ALTER TABLE public.document_pdf_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY document_pdf_cache_tenant_isolation
    ON public.document_pdf_cache
    FOR ALL
    TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE TRIGGER document_pdf_cache_set_updated_at
    BEFORE UPDATE ON public.document_pdf_cache
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
