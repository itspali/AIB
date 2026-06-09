-- ====================================================================
-- Entity party nature + dual workspace category trees
-- ====================================================================

CREATE TYPE public.party_nature_type AS ENUM ('INDIVIDUAL', 'ORGANIZATION');

-- --------------------------------------------------------------------
-- Category tables (mirror item_categories minus item-only columns)
-- --------------------------------------------------------------------
CREATE TABLE public.entity_customer_categories (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name                        TEXT NOT NULL,
    parent_id                   UUID REFERENCES public.entity_customer_categories (id) ON DELETE CASCADE,
    attribute_templates         JSONB NOT NULL DEFAULT '[]'::jsonb,
    inherit_parent_attributes   BOOLEAN NOT NULL DEFAULT TRUE,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX entity_customer_categories_tenant_id_id_unique
    ON public.entity_customer_categories (tenant_id, id);

CREATE INDEX entity_customer_categories_tenant_id_parent_id_idx
    ON public.entity_customer_categories (tenant_id, parent_id);

CREATE TABLE public.entity_supplier_categories (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name                        TEXT NOT NULL,
    parent_id                   UUID REFERENCES public.entity_supplier_categories (id) ON DELETE CASCADE,
    attribute_templates         JSONB NOT NULL DEFAULT '[]'::jsonb,
    inherit_parent_attributes   BOOLEAN NOT NULL DEFAULT TRUE,
    is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX entity_supplier_categories_tenant_id_id_unique
    ON public.entity_supplier_categories (tenant_id, id);

CREATE INDEX entity_supplier_categories_tenant_id_parent_id_idx
    ON public.entity_supplier_categories (tenant_id, parent_id);

CREATE TRIGGER entity_customer_categories_set_updated_at
    BEFORE UPDATE ON public.entity_customer_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER entity_supplier_categories_set_updated_at
    BEFORE UPDATE ON public.entity_supplier_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.entity_customer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_supplier_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY entity_customer_categories_tenant_isolation ON public.entity_customer_categories
    FOR ALL USING (tenant_id = private.current_tenant_id());

CREATE POLICY entity_supplier_categories_tenant_isolation ON public.entity_supplier_categories
    FOR ALL USING (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- entities extensions
-- --------------------------------------------------------------------
ALTER TABLE public.entities
    ADD COLUMN party_nature public.party_nature_type NOT NULL DEFAULT 'ORGANIZATION',
    ADD COLUMN customer_category_id UUID,
    ADD COLUMN supplier_category_id UUID,
    ADD COLUMN customer_custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN supplier_custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Backfill custom field buckets from legacy column
UPDATE public.entities
SET customer_custom_fields = COALESCE(custom_fields, '{}'::jsonb)
WHERE type IN ('CUSTOMER', 'MUTUAL_PARTNER');

UPDATE public.entities
SET supplier_custom_fields = COALESCE(custom_fields, '{}'::jsonb)
WHERE type IN ('SUPPLIER', 'MUTUAL_PARTNER');

UPDATE public.entities
SET supplier_custom_fields = COALESCE(custom_fields, '{}'::jsonb),
    customer_custom_fields = COALESCE(custom_fields, '{}'::jsonb)
WHERE type = 'MUTUAL_PARTNER';

-- Seed default "General" categories per tenant with entities
INSERT INTO public.entity_customer_categories (tenant_id, name, is_active)
SELECT DISTINCT e.tenant_id, 'General', TRUE
FROM public.entities e
WHERE e.type IN ('CUSTOMER', 'MUTUAL_PARTNER')
  AND NOT EXISTS (
    SELECT 1 FROM public.entity_customer_categories cc
    WHERE cc.tenant_id = e.tenant_id
      AND cc.name = 'General'
      AND cc.parent_id IS NULL
  );

INSERT INTO public.entity_supplier_categories (tenant_id, name, is_active)
SELECT DISTINCT e.tenant_id, 'General', TRUE
FROM public.entities e
WHERE e.type IN ('SUPPLIER', 'MUTUAL_PARTNER')
  AND NOT EXISTS (
    SELECT 1 FROM public.entity_supplier_categories sc
    WHERE sc.tenant_id = e.tenant_id
      AND sc.name = 'General'
      AND sc.parent_id IS NULL
  );

-- Assign default categories (first "General" per tenant)
UPDATE public.entities e
SET customer_category_id = cc.id
FROM public.entity_customer_categories cc
WHERE e.tenant_id = cc.tenant_id
  AND cc.name = 'General'
  AND cc.parent_id IS NULL
  AND e.type IN ('CUSTOMER', 'MUTUAL_PARTNER')
  AND e.customer_category_id IS NULL;

UPDATE public.entities e
SET supplier_category_id = sc.id
FROM public.entity_supplier_categories sc
WHERE e.tenant_id = sc.tenant_id
  AND sc.name = 'General'
  AND sc.parent_id IS NULL
  AND e.type IN ('SUPPLIER', 'MUTUAL_PARTNER')
  AND e.supplier_category_id IS NULL;

ALTER TABLE public.entities
    ADD CONSTRAINT entities_customer_category_tenant_fk
        FOREIGN KEY (tenant_id, customer_category_id)
        REFERENCES public.entity_customer_categories (tenant_id, id)
        ON DELETE RESTRICT,
    ADD CONSTRAINT entities_supplier_category_tenant_fk
        FOREIGN KEY (tenant_id, supplier_category_id)
        REFERENCES public.entity_supplier_categories (tenant_id, id)
        ON DELETE RESTRICT;

CREATE INDEX entities_tenant_id_customer_category_id_idx
    ON public.entities (tenant_id, customer_category_id);

CREATE INDEX entities_tenant_id_supplier_category_id_idx
    ON public.entities (tenant_id, supplier_category_id);

CREATE INDEX entities_tenant_id_party_nature_idx
    ON public.entities (tenant_id, party_nature);

-- --------------------------------------------------------------------
-- Effective attribute keys (inheritance-aware)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.effective_entity_customer_category_attribute_keys(
    p_tenant_id UUID,
    p_category_id UUID
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_parent_id UUID;
    v_inherit BOOLEAN;
    v_templates JSONB;
    v_parent_keys TEXT[];
    v_own_keys TEXT[];
BEGIN
    IF p_category_id IS NULL THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT parent_id, inherit_parent_attributes, attribute_templates
    INTO v_parent_id, v_inherit, v_templates
    FROM public.entity_customer_categories
    WHERE id = p_category_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT COALESCE(array_agg(btrim(template ->> 'key')), ARRAY[]::TEXT[])
    INTO v_own_keys
    FROM jsonb_array_elements(COALESCE(v_templates, '[]'::jsonb)) AS template
    WHERE btrim(template ->> 'key') <> '';

    IF NOT COALESCE(v_inherit, TRUE) OR v_parent_id IS NULL THEN
        RETURN COALESCE(v_own_keys, ARRAY[]::TEXT[]);
    END IF;

    v_parent_keys := private.effective_entity_customer_category_attribute_keys(p_tenant_id, v_parent_id);

    RETURN ARRAY(
        SELECT DISTINCT unnest(COALESCE(v_parent_keys, ARRAY[]::TEXT[]) || COALESCE(v_own_keys, ARRAY[]::TEXT[]))
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.effective_entity_supplier_category_attribute_keys(
    p_tenant_id UUID,
    p_category_id UUID
)
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_parent_id UUID;
    v_inherit BOOLEAN;
    v_templates JSONB;
    v_parent_keys TEXT[];
    v_own_keys TEXT[];
BEGIN
    IF p_category_id IS NULL THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT parent_id, inherit_parent_attributes, attribute_templates
    INTO v_parent_id, v_inherit, v_templates
    FROM public.entity_supplier_categories
    WHERE id = p_category_id AND tenant_id = p_tenant_id;

    IF NOT FOUND THEN
        RETURN ARRAY[]::TEXT[];
    END IF;

    SELECT COALESCE(array_agg(btrim(template ->> 'key')), ARRAY[]::TEXT[])
    INTO v_own_keys
    FROM jsonb_array_elements(COALESCE(v_templates, '[]'::jsonb)) AS template
    WHERE btrim(template ->> 'key') <> '';

    IF NOT COALESCE(v_inherit, TRUE) OR v_parent_id IS NULL THEN
        RETURN COALESCE(v_own_keys, ARRAY[]::TEXT[]);
    END IF;

    v_parent_keys := private.effective_entity_supplier_category_attribute_keys(p_tenant_id, v_parent_id);

    RETURN ARRAY(
        SELECT DISTINCT unnest(COALESCE(v_parent_keys, ARRAY[]::TEXT[]) || COALESCE(v_own_keys, ARRAY[]::TEXT[]))
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.prune_entity_custom_fields(
    p_fields JSONB,
    p_allowed_keys TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_fields IS NULL OR jsonb_typeof(p_fields) IS DISTINCT FROM 'object' THEN
        RETURN '{}'::jsonb;
    END IF;

    IF p_allowed_keys IS NULL OR array_length(p_allowed_keys, 1) IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    RETURN COALESCE(
        (
            SELECT jsonb_object_agg(kv.key, kv.value)
            FROM jsonb_each_text(p_fields) AS kv
            WHERE kv.key = ANY(p_allowed_keys)
        ),
        '{}'::jsonb
    );
END;
$$;

-- --------------------------------------------------------------------
-- Save entity customer category
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.save_entity_customer_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_category_id UUID;
    v_trimmed_name TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission(CASE WHEN p_category_id IS NULL THEN 'insert' ELSE 'update' END) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'category name is required';
    END IF;

    IF p_attribute_templates IS NULL THEN
        p_attribute_templates := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_attribute_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'attribute_templates must be a JSON array';
    END IF;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.entity_customer_categories
            WHERE id = p_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;
    END IF;

    IF p_parent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.entity_customer_categories
            WHERE id = p_parent_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'parent category not found for tenant';
        END IF;
    END IF;

    IF p_category_id IS NULL THEN
        INSERT INTO public.entity_customer_categories (
            tenant_id, name, parent_id, attribute_templates, inherit_parent_attributes, is_active
        )
        VALUES (
            v_tenant_id, v_trimmed_name, p_parent_id, p_attribute_templates,
            COALESCE(p_inherit_parent_attributes, TRUE), COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_category_id;
    ELSE
        UPDATE public.entity_customer_categories
        SET
            name = v_trimmed_name,
            parent_id = p_parent_id,
            attribute_templates = p_attribute_templates,
            inherit_parent_attributes = COALESCE(p_inherit_parent_attributes, inherit_parent_attributes),
            is_active = COALESCE(p_is_active, is_active)
        WHERE id = p_category_id AND tenant_id = v_tenant_id
        RETURNING id INTO v_category_id;
    END IF;

    RETURN v_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_entity_customer_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_entity_customer_category(
        p_name, p_parent_id, p_is_active, p_attribute_templates, p_category_id, p_inherit_parent_attributes
    );
$$;

-- Supplier save (parallel)
CREATE OR REPLACE FUNCTION private.save_entity_supplier_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_category_id UUID;
    v_trimmed_name TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission(CASE WHEN p_category_id IS NULL THEN 'insert' ELSE 'update' END) THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    v_trimmed_name := btrim(p_name);
    IF v_trimmed_name IS NULL OR v_trimmed_name = '' THEN
        RAISE EXCEPTION 'category name is required';
    END IF;

    IF p_attribute_templates IS NULL THEN
        p_attribute_templates := '[]'::jsonb;
    END IF;

    IF jsonb_typeof(p_attribute_templates) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'attribute_templates must be a JSON array';
    END IF;

    IF p_category_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.entity_supplier_categories
            WHERE id = p_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'category not found for tenant';
        END IF;
    END IF;

    IF p_parent_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.entity_supplier_categories
            WHERE id = p_parent_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'parent category not found for tenant';
        END IF;
    END IF;

    IF p_category_id IS NULL THEN
        INSERT INTO public.entity_supplier_categories (
            tenant_id, name, parent_id, attribute_templates, inherit_parent_attributes, is_active
        )
        VALUES (
            v_tenant_id, v_trimmed_name, p_parent_id, p_attribute_templates,
            COALESCE(p_inherit_parent_attributes, TRUE), COALESCE(p_is_active, TRUE)
        )
        RETURNING id INTO v_category_id;
    ELSE
        UPDATE public.entity_supplier_categories
        SET
            name = v_trimmed_name,
            parent_id = p_parent_id,
            attribute_templates = p_attribute_templates,
            inherit_parent_attributes = COALESCE(p_inherit_parent_attributes, inherit_parent_attributes),
            is_active = COALESCE(p_is_active, is_active)
        WHERE id = p_category_id AND tenant_id = v_tenant_id
        RETURNING id INTO v_category_id;
    END IF;

    RETURN v_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_entity_supplier_category(
    p_name TEXT,
    p_parent_id UUID DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_attribute_templates JSONB DEFAULT '[]'::jsonb,
    p_category_id UUID DEFAULT NULL,
    p_inherit_parent_attributes BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.save_entity_supplier_category(
        p_name, p_parent_id, p_is_active, p_attribute_templates, p_category_id, p_inherit_parent_attributes
    );
$$;

-- --------------------------------------------------------------------
-- Delete category RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.delete_entity_customer_category(p_category_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entity_count BIGINT;
    v_child_count BIGINT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission('delete') THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'category id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entity_customer_categories
        WHERE id = p_category_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'category not found for tenant';
    END IF;

    SELECT COUNT(*)::bigint INTO v_entity_count
    FROM public.entities
    WHERE tenant_id = v_tenant_id AND customer_category_id = p_category_id;

    IF v_entity_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete: % entit(ies) assigned to this category', v_entity_count;
    END IF;

    SELECT COUNT(*)::bigint INTO v_child_count
    FROM public.entity_customer_categories
    WHERE tenant_id = v_tenant_id AND parent_id = p_category_id;

    IF v_child_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete: % child categor(ies) exist under this category', v_child_count;
    END IF;

    DELETE FROM public.entity_customer_categories
    WHERE id = p_category_id AND tenant_id = v_tenant_id;

    RETURN 'DELETED';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_entity_customer_category(p_category_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_entity_customer_category(p_category_id);
$$;

CREATE OR REPLACE FUNCTION private.delete_entity_supplier_category(p_category_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entity_count BIGINT;
    v_child_count BIGINT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.role_has_entity_permission('delete') THEN
        RAISE EXCEPTION 'permission denied';
    END IF;

    IF p_category_id IS NULL THEN
        RAISE EXCEPTION 'category id is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entity_supplier_categories
        WHERE id = p_category_id AND tenant_id = v_tenant_id
    ) THEN
        RAISE EXCEPTION 'category not found for tenant';
    END IF;

    SELECT COUNT(*)::bigint INTO v_entity_count
    FROM public.entities
    WHERE tenant_id = v_tenant_id AND supplier_category_id = p_category_id;

    IF v_entity_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete: % entit(ies) assigned to this category', v_entity_count;
    END IF;

    SELECT COUNT(*)::bigint INTO v_child_count
    FROM public.entity_supplier_categories
    WHERE tenant_id = v_tenant_id AND parent_id = p_category_id;

    IF v_child_count > 0 THEN
        RAISE EXCEPTION 'Cannot delete: % child categor(ies) exist under this category', v_child_count;
    END IF;

    DELETE FROM public.entity_supplier_categories
    WHERE id = p_category_id AND tenant_id = v_tenant_id;

    RETURN 'DELETED';
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_entity_supplier_category(p_category_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT private.delete_entity_supplier_category(p_category_id);
$$;

-- --------------------------------------------------------------------
-- Count entities by category
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_entities_by_customer_category()
RETURNS TABLE(category_id UUID, entity_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    RETURN QUERY
    SELECT e.customer_category_id, COUNT(*)::bigint
    FROM public.entities e
    WHERE e.tenant_id = v_tenant_id AND e.customer_category_id IS NOT NULL
    GROUP BY e.customer_category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_entities_by_supplier_category()
RETURNS TABLE(category_id UUID, entity_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    RETURN QUERY
    SELECT e.supplier_category_id, COUNT(*)::bigint
    FROM public.entities e
    WHERE e.tenant_id = v_tenant_id AND e.supplier_category_id IS NOT NULL
    GROUP BY e.supplier_category_id;
END;
$$;

-- --------------------------------------------------------------------
-- Patch save_entity_profile_core
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.save_entity_profile_core(
    p_entity JSONB,
    p_primary_contact JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_entity_id UUID;
    v_name TEXT;
    v_type public.entity_commercial_type;
    v_tax_treatment public.tax_treatment_type;
    v_tax_registration_number TEXT;
    v_party_nature public.party_nature_type;
    v_customer_category_id UUID;
    v_supplier_category_id UUID;
    v_customer_custom_fields JSONB;
    v_supplier_custom_fields JSONB;
    v_customer_allowed TEXT[];
    v_supplier_allowed TEXT[];
    v_contact_id UUID;
    v_primary_first_name TEXT;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF p_entity IS NULL OR jsonb_typeof(p_entity) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION 'entity payload must be a JSON object';
    END IF;

    v_entity_id := NULLIF(p_entity ->> 'entity_id', '')::UUID;

    IF v_entity_id IS NOT NULL THEN
        IF NOT private.role_has_entity_permission('update') THEN
            RAISE EXCEPTION 'permission denied to update entities';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.entities e
            WHERE e.id = v_entity_id AND e.tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'entity not found for tenant';
        END IF;
    ELSE
        IF NOT private.role_has_entity_permission('insert') THEN
            RAISE EXCEPTION 'permission denied to create entities';
        END IF;
    END IF;

    v_name := btrim(p_entity ->> 'name');
    IF v_name IS NULL OR v_name = '' THEN
        RAISE EXCEPTION 'entity name is required';
    END IF;

    BEGIN
        v_type := upper(btrim(p_entity ->> 'type'))::public.entity_commercial_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid entity commercial type';
    END;

    BEGIN
        v_tax_treatment := upper(btrim(COALESCE(p_entity ->> 'tax_treatment', 'REGULAR_B2B')))::public.tax_treatment_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid tax treatment';
    END;

    BEGIN
        v_party_nature := upper(btrim(COALESCE(p_entity ->> 'party_nature', 'ORGANIZATION')))::public.party_nature_type;
    EXCEPTION
        WHEN others THEN
            RAISE EXCEPTION 'invalid party nature';
    END;

    v_tax_registration_number := private.normalize_entity_tax_registration(
        v_tax_treatment,
        p_entity ->> 'tax_registration_number'
    );

    v_customer_category_id := NULLIF(p_entity ->> 'customer_category_id', '')::UUID;
    v_supplier_category_id := NULLIF(p_entity ->> 'supplier_category_id', '')::UUID;

    IF v_type IN ('CUSTOMER', 'MUTUAL_PARTNER') THEN
        IF v_customer_category_id IS NULL THEN
            RAISE EXCEPTION 'customer category is required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.entity_customer_categories
            WHERE id = v_customer_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'customer category not found for tenant';
        END IF;
    ELSE
        v_customer_category_id := NULL;
    END IF;

    IF v_type IN ('SUPPLIER', 'MUTUAL_PARTNER') THEN
        IF v_supplier_category_id IS NULL THEN
            RAISE EXCEPTION 'supplier category is required';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM public.entity_supplier_categories
            WHERE id = v_supplier_category_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'supplier category not found for tenant';
        END IF;
    ELSE
        v_supplier_category_id := NULL;
    END IF;

    v_customer_custom_fields := COALESCE(p_entity -> 'customer_custom_fields', '{}'::jsonb);
    v_supplier_custom_fields := COALESCE(p_entity -> 'supplier_custom_fields', '{}'::jsonb);

    IF v_customer_category_id IS NOT NULL THEN
        v_customer_allowed := private.effective_entity_customer_category_attribute_keys(v_tenant_id, v_customer_category_id);
        v_customer_custom_fields := private.prune_entity_custom_fields(v_customer_custom_fields, v_customer_allowed);
    ELSE
        v_customer_custom_fields := '{}'::jsonb;
    END IF;

    IF v_supplier_category_id IS NOT NULL THEN
        v_supplier_allowed := private.effective_entity_supplier_category_attribute_keys(v_tenant_id, v_supplier_category_id);
        v_supplier_custom_fields := private.prune_entity_custom_fields(v_supplier_custom_fields, v_supplier_allowed);
    ELSE
        v_supplier_custom_fields := '{}'::jsonb;
    END IF;

    IF v_entity_id IS NULL THEN
        INSERT INTO public.entities (
            tenant_id, name, legal_name, code, type, tax_registration_number, tax_treatment,
            party_nature, customer_category_id, supplier_category_id,
            base_currency_override, credit_limit, payment_terms_days,
            billing_address_line1, billing_address_line2, billing_city, billing_state,
            billing_zip_postal, billing_country_code,
            shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
            shipping_zip_postal, shipping_country_code,
            incoterms_code, default_shipping_method, company_email, company_phone,
            website_url, internal_notes,
            custom_fields, customer_custom_fields, supplier_custom_fields,
            logo_url, is_active
        )
        VALUES (
            v_tenant_id, v_name,
            NULLIF(btrim(p_entity ->> 'legal_name'), ''),
            NULLIF(btrim(p_entity ->> 'code'), ''),
            v_type, v_tax_registration_number, v_tax_treatment,
            v_party_nature, v_customer_category_id, v_supplier_category_id,
            NULLIF(upper(btrim(p_entity ->> 'base_currency_override')), ''),
            COALESCE((p_entity ->> 'credit_limit')::NUMERIC, 0),
            COALESCE((p_entity ->> 'payment_terms_days')::INTEGER, 0),
            NULLIF(btrim(p_entity ->> 'billing_address_line1'), ''),
            NULLIF(btrim(p_entity ->> 'billing_address_line2'), ''),
            NULLIF(btrim(p_entity ->> 'billing_city'), ''),
            NULLIF(btrim(p_entity ->> 'billing_state'), ''),
            NULLIF(btrim(p_entity ->> 'billing_zip_postal'), ''),
            NULLIF(upper(btrim(p_entity ->> 'billing_country_code')), ''),
            NULLIF(btrim(p_entity ->> 'shipping_address_line1'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_address_line2'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_city'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_state'), ''),
            NULLIF(btrim(p_entity ->> 'shipping_zip_postal'), ''),
            NULLIF(upper(btrim(p_entity ->> 'shipping_country_code')), ''),
            NULLIF(upper(btrim(p_entity ->> 'incoterms_code')), ''),
            NULLIF(btrim(p_entity ->> 'default_shipping_method'), ''),
            NULLIF(lower(btrim(p_entity ->> 'company_email')), ''),
            NULLIF(btrim(p_entity ->> 'company_phone'), ''),
            NULLIF(btrim(p_entity ->> 'website_url'), ''),
            NULLIF(btrim(p_entity ->> 'internal_notes'), ''),
            '{}'::jsonb,
            v_customer_custom_fields,
            v_supplier_custom_fields,
            NULLIF(btrim(p_entity ->> 'logo_url'), ''),
            COALESCE((p_entity ->> 'is_active')::BOOLEAN, TRUE)
        )
        RETURNING id INTO v_entity_id;
    ELSE
        UPDATE public.entities
        SET
            name = v_name,
            legal_name = NULLIF(btrim(p_entity ->> 'legal_name'), ''),
            code = NULLIF(btrim(p_entity ->> 'code'), ''),
            type = v_type,
            tax_registration_number = v_tax_registration_number,
            tax_treatment = v_tax_treatment,
            party_nature = v_party_nature,
            customer_category_id = v_customer_category_id,
            supplier_category_id = v_supplier_category_id,
            base_currency_override = NULLIF(upper(btrim(p_entity ->> 'base_currency_override')), ''),
            credit_limit = COALESCE((p_entity ->> 'credit_limit')::NUMERIC, credit_limit),
            payment_terms_days = COALESCE((p_entity ->> 'payment_terms_days')::INTEGER, payment_terms_days),
            billing_address_line1 = NULLIF(btrim(p_entity ->> 'billing_address_line1'), ''),
            billing_address_line2 = NULLIF(btrim(p_entity ->> 'billing_address_line2'), ''),
            billing_city = NULLIF(btrim(p_entity ->> 'billing_city'), ''),
            billing_state = NULLIF(btrim(p_entity ->> 'billing_state'), ''),
            billing_zip_postal = NULLIF(btrim(p_entity ->> 'billing_zip_postal'), ''),
            billing_country_code = NULLIF(upper(btrim(p_entity ->> 'billing_country_code')), ''),
            shipping_address_line1 = NULLIF(btrim(p_entity ->> 'shipping_address_line1'), ''),
            shipping_address_line2 = NULLIF(btrim(p_entity ->> 'shipping_address_line2'), ''),
            shipping_city = NULLIF(btrim(p_entity ->> 'shipping_city'), ''),
            shipping_state = NULLIF(btrim(p_entity ->> 'shipping_state'), ''),
            shipping_zip_postal = NULLIF(btrim(p_entity ->> 'shipping_zip_postal'), ''),
            shipping_country_code = NULLIF(upper(btrim(p_entity ->> 'shipping_country_code')), ''),
            incoterms_code = NULLIF(upper(btrim(p_entity ->> 'incoterms_code')), ''),
            default_shipping_method = NULLIF(btrim(p_entity ->> 'default_shipping_method'), ''),
            company_email = NULLIF(lower(btrim(p_entity ->> 'company_email')), ''),
            company_phone = NULLIF(btrim(p_entity ->> 'company_phone'), ''),
            website_url = NULLIF(btrim(p_entity ->> 'website_url'), ''),
            internal_notes = NULLIF(btrim(p_entity ->> 'internal_notes'), ''),
            customer_custom_fields = v_customer_custom_fields,
            supplier_custom_fields = v_supplier_custom_fields,
            logo_url = NULLIF(btrim(p_entity ->> 'logo_url'), ''),
            is_active = COALESCE((p_entity ->> 'is_active')::BOOLEAN, is_active)
        WHERE id = v_entity_id AND tenant_id = v_tenant_id;
    END IF;

    IF p_primary_contact IS NOT NULL AND jsonb_typeof(p_primary_contact) = 'object' THEN
        v_primary_first_name := btrim(p_primary_contact ->> 'first_name');
        IF v_primary_first_name IS NOT NULL AND v_primary_first_name <> '' THEN
            v_contact_id := NULLIF(p_primary_contact ->> 'contact_id', '')::UUID;

            IF v_contact_id IS NOT NULL THEN
                UPDATE public.entity_contacts
                SET
                    first_name = v_primary_first_name,
                    last_name = NULLIF(btrim(p_primary_contact ->> 'last_name'), ''),
                    email = NULLIF(lower(btrim(p_primary_contact ->> 'email')), ''),
                    phone = NULLIF(btrim(p_primary_contact ->> 'phone'), ''),
                    mobile = NULLIF(btrim(p_primary_contact ->> 'mobile'), ''),
                    whatsapp_number = NULLIF(btrim(p_primary_contact ->> 'whatsapp_number'), ''),
                    department = NULLIF(btrim(p_primary_contact ->> 'department'), ''),
                    job_title = NULLIF(btrim(p_primary_contact ->> 'job_title'), ''),
                    is_primary = TRUE,
                    is_active = TRUE
                WHERE id = v_contact_id
                  AND entity_id = v_entity_id
                  AND tenant_id = v_tenant_id;
            ELSE
                UPDATE public.entity_contacts
                SET is_primary = FALSE
                WHERE entity_id = v_entity_id
                  AND tenant_id = v_tenant_id
                  AND is_primary = TRUE;

                INSERT INTO public.entity_contacts (
                    tenant_id, entity_id, first_name, last_name, email, phone, mobile,
                    whatsapp_number, department, job_title, is_primary, is_active
                )
                VALUES (
                    v_tenant_id, v_entity_id, v_primary_first_name,
                    NULLIF(btrim(p_primary_contact ->> 'last_name'), ''),
                    NULLIF(lower(btrim(p_primary_contact ->> 'email')), ''),
                    NULLIF(btrim(p_primary_contact ->> 'phone'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'mobile'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'whatsapp_number'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'department'), ''),
                    NULLIF(btrim(p_primary_contact ->> 'job_title'), ''),
                    TRUE, TRUE
                );
            END IF;
        END IF;
    END IF;

    RETURN v_entity_id;
END;
$$;

-- --------------------------------------------------------------------
-- Patch fetch_entity_list_page (extended filters + category names)
-- --------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fetch_entity_list_page(TEXT, INTEGER, INTEGER, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION public.fetch_entity_list_page(
    p_workspace TEXT,
    p_offset INTEGER DEFAULT 0,
    p_limit INTEGER DEFAULT 50,
    p_search TEXT DEFAULT NULL,
    p_active_only BOOLEAN DEFAULT NULL,
    p_party_nature TEXT DEFAULT NULL,
    p_customer_category_id UUID DEFAULT NULL,
    p_supplier_category_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    legal_name TEXT,
    code VARCHAR(30),
    type entity_commercial_type,
    party_nature party_nature_type,
    tax_treatment tax_treatment_type,
    tax_registration_number TEXT,
    customer_category_id UUID,
    customer_category_name TEXT,
    supplier_category_id UUID,
    supplier_category_name TEXT,
    credit_limit NUMERIC(15, 4),
    current_balance NUMERIC(15, 4),
    payment_terms_days INTEGER,
    company_email TEXT,
    company_phone TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    primary_contact_name TEXT,
    primary_contact_email TEXT,
    total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_search TEXT;
    v_party_nature public.party_nature_type;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RETURN;
    END IF;

    IF NOT private.role_has_entity_permission('select') THEN
        RETURN;
    END IF;

    v_search := NULLIF(btrim(p_search), '');

    IF p_party_nature IS NOT NULL AND btrim(p_party_nature) <> '' THEN
        BEGIN
            v_party_nature := upper(btrim(p_party_nature))::public.party_nature_type;
        EXCEPTION
            WHEN others THEN
                v_party_nature := NULL;
        END;
    END IF;

    RETURN QUERY
    WITH filtered AS (
        SELECT e.*
        FROM public.entities e
        LEFT JOIN public.entity_customer_categories cc
            ON cc.id = e.customer_category_id AND cc.tenant_id = e.tenant_id
        LEFT JOIN public.entity_supplier_categories sc
            ON sc.id = e.supplier_category_id AND sc.tenant_id = e.tenant_id
        WHERE e.tenant_id = v_tenant_id
          AND (
            CASE lower(btrim(p_workspace))
                WHEN 'customer' THEN e.type IN ('CUSTOMER', 'MUTUAL_PARTNER')
                WHEN 'supplier' THEN e.type IN ('SUPPLIER', 'MUTUAL_PARTNER')
                ELSE TRUE
            END
          )
          AND (p_active_only IS NULL OR e.is_active = p_active_only)
          AND (v_party_nature IS NULL OR e.party_nature = v_party_nature)
          AND (p_customer_category_id IS NULL OR e.customer_category_id = p_customer_category_id)
          AND (p_supplier_category_id IS NULL OR e.supplier_category_id = p_supplier_category_id)
          AND (
            v_search IS NULL
            OR e.name ILIKE '%' || v_search || '%'
            OR COALESCE(e.code, '') ILIKE '%' || v_search || '%'
            OR COALESCE(e.legal_name, '') ILIKE '%' || v_search || '%'
            OR COALESCE(cc.name, '') ILIKE '%' || v_search || '%'
            OR COALESCE(sc.name, '') ILIKE '%' || v_search || '%'
          )
    ),
    counted AS (
        SELECT COUNT(*)::BIGINT AS cnt FROM filtered
    )
    SELECT
        f.id,
        f.name,
        f.legal_name,
        f.code,
        f.type,
        f.party_nature,
        f.tax_treatment,
        f.tax_registration_number,
        f.customer_category_id,
        cc.name AS customer_category_name,
        f.supplier_category_id,
        sc.name AS supplier_category_name,
        f.credit_limit,
        f.current_balance,
        f.payment_terms_days,
        f.company_email,
        f.company_phone,
        f.is_active,
        f.created_at,
        f.updated_at,
        NULLIF(
            btrim(concat_ws(' ', pc.first_name, NULLIF(pc.last_name, ''))),
            ''
        ) AS primary_contact_name,
        pc.email AS primary_contact_email,
        c.cnt AS total_count
    FROM filtered f
    CROSS JOIN counted c
    LEFT JOIN public.entity_customer_categories cc
        ON cc.id = f.customer_category_id AND cc.tenant_id = f.tenant_id
    LEFT JOIN public.entity_supplier_categories sc
        ON sc.id = f.supplier_category_id AND sc.tenant_id = f.tenant_id
    LEFT JOIN LATERAL (
        SELECT ec.first_name, ec.last_name, ec.email
        FROM public.entity_contacts ec
        WHERE ec.entity_id = f.id
          AND ec.tenant_id = f.tenant_id
          AND ec.is_primary = TRUE
        LIMIT 1
    ) pc ON TRUE
    ORDER BY f.name ASC, f.id ASC
    OFFSET GREATEST(p_offset, 0)
    LIMIT GREATEST(p_limit, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.save_entity_customer_category(TEXT, UUID, BOOLEAN, JSONB, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_entity_customer_category(TEXT, UUID, BOOLEAN, JSONB, UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.save_entity_supplier_category(TEXT, UUID, BOOLEAN, JSONB, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_entity_supplier_category(TEXT, UUID, BOOLEAN, JSONB, UUID, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_entity_customer_category(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_entity_customer_category(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.delete_entity_supplier_category(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_entity_supplier_category(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.count_entities_by_customer_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_entities_by_customer_category() TO authenticated;

REVOKE ALL ON FUNCTION public.count_entities_by_supplier_category() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_entities_by_supplier_category() TO authenticated;

REVOKE ALL ON FUNCTION public.fetch_entity_list_page(TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_entity_list_page(TEXT, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT, UUID, UUID) TO authenticated;
