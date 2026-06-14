-- ====================================================================
-- Supplier portal MVP — portal users, PO acknowledge, invoice uploads
-- Migration: 20260622130000_supplier_portal.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Portal user linkage (auth user → supplier entity)
-- --------------------------------------------------------------------
CREATE TABLE public.supplier_portal_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    supplier_entity_id  UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, user_id)
);

CREATE INDEX supplier_portal_users_supplier_idx
    ON public.supplier_portal_users (tenant_id, supplier_entity_id)
    WHERE is_active = TRUE;

CREATE TRIGGER supplier_portal_users_set_updated_at
    BEFORE UPDATE ON public.supplier_portal_users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 2. PO supplier acknowledgement
-- --------------------------------------------------------------------
ALTER TABLE public.purchase_orders
    ADD COLUMN IF NOT EXISTS supplier_acknowledged_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS supplier_acknowledged_by UUID REFERENCES public.users (id) ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 3. Supplier invoice upload metadata (AP clerk review queue)
-- --------------------------------------------------------------------
CREATE TABLE public.supplier_invoice_uploads (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    supplier_entity_id      UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    purchase_order_id       UUID REFERENCES public.purchase_orders (id) ON DELETE SET NULL,
    storage_path            TEXT NOT NULL,
    file_name               TEXT NOT NULL,
    file_size_bytes         BIGINT,
    mime_type               TEXT,
    vendor_invoice_number   TEXT,
    status                  TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    uploaded_by             UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    reviewed_at             TIMESTAMPTZ,
    reviewed_by             UUID REFERENCES public.users (id) ON DELETE SET NULL,
    purchase_invoice_id     UUID REFERENCES public.purchase_invoices (id) ON DELETE SET NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT supplier_invoice_uploads_status_chk
        CHECK (status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'))
);

CREATE INDEX supplier_invoice_uploads_tenant_status_idx
    ON public.supplier_invoice_uploads (tenant_id, status, created_at DESC);

CREATE TRIGGER supplier_invoice_uploads_set_updated_at
    BEFORE UPDATE ON public.supplier_invoice_uploads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 4. Helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.current_supplier_portal_entity_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT spu.supplier_entity_id
    FROM public.supplier_portal_users spu
    WHERE spu.tenant_id = private.current_tenant_id()
      AND spu.user_id = auth.uid()
      AND spu.is_active = TRUE
    LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.current_supplier_portal_entity_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_supplier_portal_entity_id() TO authenticated;

-- --------------------------------------------------------------------
-- 5. RLS — portal-scoped PO read; portal tables
-- --------------------------------------------------------------------
ALTER TABLE public.supplier_portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_invoice_uploads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS purchase_orders_tenant_isolation ON public.purchase_orders;

CREATE POLICY purchase_orders_tenant_isolation
    ON public.purchase_orders
    FOR ALL
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND (
            private.current_supplier_portal_entity_id() IS NULL
            OR supplier_id = private.current_supplier_portal_entity_id()
        )
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_supplier_portal_entity_id() IS NULL
    );

DROP POLICY IF EXISTS purchase_order_items_tenant_isolation ON public.purchase_order_items;

CREATE POLICY purchase_order_items_tenant_isolation
    ON public.purchase_order_items
    FOR ALL
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND (
            private.current_supplier_portal_entity_id() IS NULL
            OR EXISTS (
                SELECT 1
                FROM public.purchase_orders po
                WHERE po.id = purchase_order_items.purchase_order_id
                  AND po.tenant_id = purchase_order_items.tenant_id
                  AND po.supplier_id = private.current_supplier_portal_entity_id()
            )
        )
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_supplier_portal_entity_id() IS NULL
    );

CREATE POLICY supplier_portal_users_tenant_isolation
    ON public.supplier_portal_users
    FOR ALL
    TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_supplier_portal_entity_id() IS NULL
    );

CREATE POLICY supplier_portal_users_self_read
    ON public.supplier_portal_users
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND user_id = auth.uid()
    );

CREATE POLICY supplier_invoice_uploads_tenant_read
    ON public.supplier_invoice_uploads
    FOR SELECT
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND (
            private.current_supplier_portal_entity_id() IS NULL
            OR supplier_entity_id = private.current_supplier_portal_entity_id()
        )
    );

CREATE POLICY supplier_invoice_uploads_portal_insert
    ON public.supplier_invoice_uploads
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND uploaded_by = auth.uid()
        AND (
            private.current_supplier_portal_entity_id() IS NULL
            OR supplier_entity_id = private.current_supplier_portal_entity_id()
        )
    );

CREATE POLICY supplier_invoice_uploads_staff_update
    ON public.supplier_invoice_uploads
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id = private.current_tenant_id()
        AND private.current_supplier_portal_entity_id() IS NULL
    )
    WITH CHECK (
        tenant_id = private.current_tenant_id()
        AND private.current_supplier_portal_entity_id() IS NULL
    );

-- --------------------------------------------------------------------
-- 6. acknowledge_purchase_order RPC
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acknowledge_purchase_order(p_purchase_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_supplier_id UUID;
    v_po RECORD;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    v_supplier_id := private.current_supplier_portal_entity_id();
    IF v_supplier_id IS NULL THEN
        RAISE EXCEPTION 'supplier portal access required';
    END IF;

    SELECT id, supplier_id, document_status
    INTO v_po
    FROM public.purchase_orders
    WHERE id = p_purchase_order_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.supplier_id <> v_supplier_id THEN
        RAISE EXCEPTION 'purchase order not found';
    END IF;

    IF v_po.document_status NOT IN (
        'ISSUED_ACTIVE'::public.purchase_document_status,
        'PARTIALLY_FULFILLED'::public.purchase_document_status
    ) THEN
        RAISE EXCEPTION 'purchase order is not open for supplier acknowledgement';
    END IF;

    UPDATE public.purchase_orders
    SET supplier_acknowledged_at = NOW(),
        supplier_acknowledged_by = auth.uid(),
        updated_at = NOW()
    WHERE id = p_purchase_order_id
      AND tenant_id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.acknowledge_purchase_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acknowledge_purchase_order(UUID) TO authenticated;

-- --------------------------------------------------------------------
-- 7. Storage bucket — supplier-invoices
-- --------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'supplier-invoices',
    'supplier-invoices',
    FALSE,
    10485760,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY supplier_invoices_select
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'supplier-invoices'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (
            NOT EXISTS (
                SELECT 1
                FROM public.supplier_portal_users spu
                WHERE spu.user_id = auth.uid()
                  AND spu.is_active = TRUE
                  AND spu.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
            )
            OR (storage.foldername(name))[2] IN (
                SELECT spu.supplier_entity_id::text
                FROM public.supplier_portal_users spu
                WHERE spu.user_id = auth.uid()
                  AND spu.is_active = TRUE
                  AND spu.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
            )
        )
    );

CREATE POLICY supplier_invoices_insert
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'supplier-invoices'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (
            NOT EXISTS (
                SELECT 1
                FROM public.supplier_portal_users spu
                WHERE spu.user_id = auth.uid()
                  AND spu.is_active = TRUE
                  AND spu.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
            )
            OR (storage.foldername(name))[2] IN (
                SELECT spu.supplier_entity_id::text
                FROM public.supplier_portal_users spu
                WHERE spu.user_id = auth.uid()
                  AND spu.is_active = TRUE
                  AND spu.tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
            )
        )
    );

CREATE POLICY supplier_invoices_update
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'supplier-invoices'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    )
    WITH CHECK (
        bucket_id = 'supplier-invoices'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
    );

CREATE POLICY supplier_invoices_delete
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'supplier-invoices'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND private.current_supplier_portal_entity_id() IS NULL
    );
