-- ====================================================================
-- AIB SMART ERP - MILESTONE 3: MASTER PRODUCT & INVENTORY CATALOG
-- Migration: 20260527123000_create_master_product_and_inventory_catalog.sql
-- ====================================================================
--
-- --------------------------------------------------------------------
-- ARCHITECTURAL UX DOCUMENTATION (downstream Next.js / worker alignment)
-- --------------------------------------------------------------------
--
-- PROGRESSIVE FORM STRUCTURES:
--   Item create: Essentials = name, classification, base_unit_of_measure,
--     category, is_purchasable, is_salable. Advanced toggle = description,
--     hsn_sac_code, has_variants, default_tax_category, custom_fields,
--     UOM repeater, supplier matrix, price book links, media gallery, tags.
--   Variant create: sku, barcode, variant_attributes (from category
--     attribute_templates), dimensions/weight. SKU mask auto-parse from
--     template keys e.g. "{BASE}-{Size}-{Color}".
--
-- FORMULAIC SKU PARSING MASKS:
--   category.attribute_templates drives dynamic variant attribute fields.
--   App layer composes sku from parent item code + attribute slug join.
--
-- OPENING BALANCE LEDGER WORKFLOW:
--   Post INVENTORY_ADJUSTMENT with positive quantity + cost_at_transaction
--   per location/variant. reference_document = 'OPENING-BALANCE-{location_code}'.
--   Block direct UPDATE/DELETE on inventory_ledger (append-only trigger).
--
-- MULTI-CHANNEL IMAGE VISIBILITY ROUTING:
--   item_media.show_on_storefront -> B2C/B2B storefront renderers
--   item_media.show_in_digital_catalog -> PDF/email catalog exports
--   item_media.show_on_internal_transactions -> PO/SO print layouts
--   is_primary partial unique per item OR variant context.
--
-- MULTI-STATE BRANCH TAX / INVOICE PROCESSING:
--   tenant_locations.location_tax_identifier + tax_registered_name supply
--   branch GSTIN/VAT on printed invoices. Resolve issuing location from
--   sales order fulfillment location or storefront default branch.
--
-- STOREFRONT THEME INJECTION (Next.js):
--   Resolve storefront_channels by domain_url or slug in middleware.
--   Inject theme_config CSS variables on :root. brand_logo_url /
--   brand_favicon_url on layout shell. Domain header filtering enforced
--   in API/middleware; DB anon policies expose active/visible rows only.
--
-- DOCUMENT / EMAIL WORKER BRANDING:
--   Use storefront brand_logo_url + theme_config.primary_color on
--   outbound HTML templates (invoices, dispatch receipts, sales orders).
--
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. COMPLIANCE ALTERATIONS — tenant_locations (multi-state branches)
-- --------------------------------------------------------------------
ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS location_tax_identifier TEXT DEFAULT NULL;

ALTER TABLE public.tenant_locations
    ADD COLUMN IF NOT EXISTS tax_registered_name TEXT DEFAULT NULL;

-- --------------------------------------------------------------------
-- 2. SYSTEM ENUMS
-- --------------------------------------------------------------------
CREATE TYPE item_classification_type AS ENUM (
    'RAW_MATERIAL',
    'WIP_ASSEMBLY',
    'FINISHED_GOOD',
    'SERVICE',
    'KIT_BUNDLE'
);

CREATE TYPE storefront_channel_type AS ENUM (
    'B2C_ECOMMERCE',
    'B2B_PORTAL',
    'MARKETPLACE_FEED',
    'PHYSICAL_POS'
);

CREATE TYPE inventory_transaction_type AS ENUM (
    'PURCHASE_RECEIPT',
    'SALES_SHIPMENT',
    'PRODUCTION_CONSUMPTION',
    'PRODUCTION_YIELD',
    'STOCK_TRANSFER',
    'INVENTORY_ADJUSTMENT',
    'CYCLE_COUNT_CORRECTION'
);

-- --------------------------------------------------------------------
-- 3. item_categories (template tree)
-- --------------------------------------------------------------------
CREATE TABLE public.item_categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name                TEXT NOT NULL,
    parent_id           UUID REFERENCES public.item_categories (id) ON DELETE CASCADE,
    attribute_templates JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX item_categories_tenant_id_id_unique
    ON public.item_categories (tenant_id, id);

CREATE INDEX item_categories_tenant_id_parent_id_idx
    ON public.item_categories (tenant_id, parent_id);

-- --------------------------------------------------------------------
-- 4. items (parent master)
-- --------------------------------------------------------------------
CREATE TABLE public.items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    category_id             UUID,
    name                    TEXT NOT NULL,
    description             TEXT,
    classification          item_classification_type NOT NULL,
    base_unit_of_measure    TEXT NOT NULL,
    hsn_sac_code            TEXT,
    is_purchasable          BOOLEAN NOT NULL DEFAULT TRUE,
    is_salable              BOOLEAN NOT NULL DEFAULT TRUE,
    has_variants            BOOLEAN NOT NULL DEFAULT FALSE,
    default_tax_category    TEXT NOT NULL DEFAULT 'STANDARD',
    custom_fields           JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX items_tenant_id_id_unique
    ON public.items (tenant_id, id);

CREATE INDEX items_tenant_id_category_id_idx
    ON public.items (tenant_id, category_id);

CREATE INDEX items_tenant_id_classification_idx
    ON public.items (tenant_id, classification);

ALTER TABLE public.items
    ADD CONSTRAINT items_category_tenant_fk
    FOREIGN KEY (tenant_id, category_id)
    REFERENCES public.item_categories (tenant_id, id)
    ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 5. item_variants (child SKU)
-- --------------------------------------------------------------------
CREATE TABLE public.item_variants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id             UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    sku                 TEXT NOT NULL,
    barcode             TEXT,
    variant_attributes  JSONB NOT NULL DEFAULT '{}'::jsonb,
    weight              NUMERIC(15, 4),
    volume              NUMERIC(15, 4),
    length              NUMERIC(15, 4),
    width               NUMERIC(15, 4),
    height              NUMERIC(15, 4),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_variants_tenant_sku_unique
        UNIQUE (tenant_id, sku)
);

CREATE UNIQUE INDEX item_variants_tenant_id_id_unique
    ON public.item_variants (tenant_id, id);

CREATE INDEX item_variants_item_id_idx
    ON public.item_variants (item_id);

ALTER TABLE public.item_variants
    ADD CONSTRAINT item_variants_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 6. Decoupled sub-modules
-- --------------------------------------------------------------------
CREATE TABLE public.item_uoms (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    uom_code            TEXT NOT NULL,
    conversion_factor   NUMERIC(15, 6) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_uoms_item_uom_unique
        UNIQUE (item_id, uom_code),
    CONSTRAINT item_uoms_conversion_factor_positive_chk
        CHECK (conversion_factor > 0)
);

ALTER TABLE public.item_uoms
    ADD CONSTRAINT item_uoms_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

CREATE TABLE public.supplier_items (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    supplier_id             UUID NOT NULL REFERENCES public.entities (id) ON DELETE RESTRICT,
    supplier_part_number    TEXT,
    supplier_price          NUMERIC(15, 4) NOT NULL,
    supplier_currency       VARCHAR(3) NOT NULL DEFAULT 'USD',
    minimum_order_quantity  NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    lead_time_days          INTEGER,
    is_preferred            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT supplier_items_item_supplier_unique
        UNIQUE (item_id, supplier_id),
    CONSTRAINT supplier_items_price_non_negative_chk
        CHECK (supplier_price >= 0),
    CONSTRAINT supplier_items_moq_positive_chk
        CHECK (minimum_order_quantity > 0)
);

ALTER TABLE public.supplier_items
    ADD CONSTRAINT supplier_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.supplier_items
    ADD CONSTRAINT supplier_items_supplier_tenant_fk
    FOREIGN KEY (tenant_id, supplier_id)
    REFERENCES public.entities (tenant_id, id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX supplier_items_one_preferred_per_item
    ON public.supplier_items (item_id)
    WHERE is_preferred = TRUE;

CREATE TABLE public.price_books (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    currency_code   VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX price_books_tenant_id_id_unique
    ON public.price_books (tenant_id, id);

CREATE TABLE public.price_book_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    price_book_id   UUID NOT NULL REFERENCES public.price_books (id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    uom_code        TEXT,
    min_quantity    NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    price           NUMERIC(15, 4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT price_book_entries_unique_key
        UNIQUE (price_book_id, item_id, uom_code, min_quantity),
    CONSTRAINT price_book_entries_price_non_negative_chk
        CHECK (price >= 0),
    CONSTRAINT price_book_entries_min_quantity_positive_chk
        CHECK (min_quantity > 0)
);

ALTER TABLE public.price_book_entries
    ADD CONSTRAINT price_book_entries_book_tenant_fk
    FOREIGN KEY (tenant_id, price_book_id)
    REFERENCES public.price_books (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.price_book_entries
    ADD CONSTRAINT price_book_entries_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 7. Multi-storefront catalog engine + branding
-- --------------------------------------------------------------------
CREATE TABLE public.storefront_channels (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name                            TEXT NOT NULL,
    channel_type                    storefront_channel_type NOT NULL,
    slug                            TEXT NOT NULL,
    domain_url                      TEXT,
    brand_logo_url                  TEXT,
    brand_favicon_url               TEXT,
    theme_config                    JSONB NOT NULL DEFAULT '{"primary_color": "#4F46E5", "secondary_color": "#10B981", "font_family": "Inter, sans-serif"}'::jsonb,
    inventory_fulfillment_strategy  JSONB NOT NULL DEFAULT '{"fallback_to_all_locations": true}'::jsonb,
    is_active                       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT storefront_channels_tenant_slug_unique
        UNIQUE (tenant_id, slug)
);

CREATE UNIQUE INDEX storefront_channels_tenant_id_id_unique
    ON public.storefront_channels (tenant_id, id);

CREATE UNIQUE INDEX storefront_channels_domain_url_unique
    ON public.storefront_channels (domain_url)
    WHERE domain_url IS NOT NULL;

CREATE TABLE public.storefront_items (
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    storefront_id           UUID NOT NULL REFERENCES public.storefront_channels (id) ON DELETE CASCADE,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    is_visible              BOOLEAN NOT NULL DEFAULT TRUE,
    store_custom_name       TEXT,
    store_price_book_id     UUID,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (storefront_id, item_id)
);

ALTER TABLE public.storefront_items
    ADD CONSTRAINT storefront_items_channel_tenant_fk
    FOREIGN KEY (tenant_id, storefront_id)
    REFERENCES public.storefront_channels (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.storefront_items
    ADD CONSTRAINT storefront_items_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.storefront_items
    ADD CONSTRAINT storefront_items_price_book_tenant_fk
    FOREIGN KEY (tenant_id, store_price_book_id)
    REFERENCES public.price_books (tenant_id, id)
    ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 8. Media engine + discovery tags
-- --------------------------------------------------------------------
CREATE TABLE public.tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    tag_group   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tags_tenant_slug_unique
        UNIQUE (tenant_id, slug)
);

CREATE UNIQUE INDEX tags_tenant_id_id_unique
    ON public.tags (tenant_id, id);

CREATE TABLE public.item_media (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    item_id                         UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    variant_id                      UUID REFERENCES public.item_variants (id) ON DELETE CASCADE,
    storage_url                     TEXT NOT NULL,
    sort_order                      INTEGER NOT NULL DEFAULT 0,
    is_primary                      BOOLEAN NOT NULL DEFAULT FALSE,
    show_on_storefront              BOOLEAN NOT NULL DEFAULT TRUE,
    show_in_digital_catalog         BOOLEAN NOT NULL DEFAULT TRUE,
    show_on_internal_transactions   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.item_media
    ADD CONSTRAINT item_media_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.item_media
    ADD CONSTRAINT item_media_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE CASCADE;

CREATE UNIQUE INDEX item_media_one_primary_per_item
    ON public.item_media (item_id)
    WHERE is_primary = TRUE AND variant_id IS NULL;

CREATE UNIQUE INDEX item_media_one_primary_per_variant
    ON public.item_media (variant_id)
    WHERE is_primary = TRUE AND variant_id IS NOT NULL;

CREATE TABLE public.item_tag_assignments (
    tenant_id   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    item_id     UUID NOT NULL REFERENCES public.items (id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES public.tags (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (item_id, tag_id)
);

ALTER TABLE public.item_tag_assignments
    ADD CONSTRAINT item_tag_assignments_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.item_tag_assignments
    ADD CONSTRAINT item_tag_assignments_tag_tenant_fk
    FOREIGN KEY (tenant_id, tag_id)
    REFERENCES public.tags (tenant_id, id)
    ON DELETE CASCADE;

-- --------------------------------------------------------------------
-- 9. inventory_ledger (append-only forensic hub)
-- --------------------------------------------------------------------
CREATE TABLE public.inventory_ledger (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    item_id                 UUID NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
    variant_id              UUID REFERENCES public.item_variants (id) ON DELETE RESTRICT,
    location_id             UUID NOT NULL REFERENCES public.tenant_locations (id) ON DELETE RESTRICT,
    transaction_type        inventory_transaction_type NOT NULL,
    quantity                NUMERIC(15, 4) NOT NULL,
    cost_at_transaction     NUMERIC(15, 4) NOT NULL,
    reference_document      TEXT NOT NULL,
    created_by              UUID NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_item_tenant_fk
    FOREIGN KEY (tenant_id, item_id)
    REFERENCES public.items (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_variant_tenant_fk
    FOREIGN KEY (tenant_id, variant_id)
    REFERENCES public.item_variants (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_location_tenant_fk
    FOREIGN KEY (tenant_id, location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

CREATE INDEX inventory_ledger_tenant_item_location_idx
    ON public.inventory_ledger (tenant_id, item_id, location_id);

CREATE INDEX inventory_ledger_tenant_created_at_idx
    ON public.inventory_ledger (tenant_id, created_at DESC);

-- --------------------------------------------------------------------
-- 10. TRIGGERS & GUARDRAILS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.inventory_ledger_append_only_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'inventory_ledger is append-only: UPDATE and DELETE are prohibited';
END;
$$;

CREATE TRIGGER inventory_ledger_block_update
    BEFORE UPDATE ON public.inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.inventory_ledger_append_only_guard();

CREATE TRIGGER inventory_ledger_block_delete
    BEFORE DELETE ON public.inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.inventory_ledger_append_only_guard();

CREATE OR REPLACE FUNCTION public.inventory_ledger_variant_required_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_has_variants BOOLEAN;
BEGIN
    SELECT i.has_variants
    INTO v_has_variants
    FROM public.items i
    WHERE i.id = NEW.item_id;

    IF v_has_variants AND NEW.variant_id IS NULL THEN
        RAISE EXCEPTION
            'item % requires variant_id on inventory_ledger rows when has_variants is TRUE',
            NEW.item_id;
    END IF;

    IF NOT v_has_variants AND NEW.variant_id IS NOT NULL THEN
        RAISE EXCEPTION
            'item % does not accept variant_id on inventory_ledger when has_variants is FALSE',
            NEW.item_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_ledger_enforce_variant_scope
    BEFORE INSERT ON public.inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION public.inventory_ledger_variant_required_guard();

CREATE TRIGGER item_categories_set_updated_at
    BEFORE UPDATE ON public.item_categories
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER items_set_updated_at
    BEFORE UPDATE ON public.items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER item_variants_set_updated_at
    BEFORE UPDATE ON public.item_variants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER item_uoms_set_updated_at
    BEFORE UPDATE ON public.item_uoms
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER supplier_items_set_updated_at
    BEFORE UPDATE ON public.supplier_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER price_books_set_updated_at
    BEFORE UPDATE ON public.price_books
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER price_book_entries_set_updated_at
    BEFORE UPDATE ON public.price_book_entries
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER storefront_channels_set_updated_at
    BEFORE UPDATE ON public.storefront_channels
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER storefront_items_set_updated_at
    BEFORE UPDATE ON public.storefront_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tags_set_updated_at
    BEFORE UPDATE ON public.tags
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER item_media_set_updated_at
    BEFORE UPDATE ON public.item_media
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 11. ROW-LEVEL SECURITY — authenticated tenant isolation
-- --------------------------------------------------------------------
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_book_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

-- Macro pattern: tenant handshake via private.current_tenant_id()

CREATE POLICY item_categories_tenant_isolation ON public.item_categories
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY items_tenant_isolation ON public.items
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY item_variants_tenant_isolation ON public.item_variants
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY item_uoms_tenant_isolation ON public.item_uoms
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY supplier_items_tenant_isolation ON public.supplier_items
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY price_books_tenant_isolation ON public.price_books
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY price_book_entries_tenant_isolation ON public.price_book_entries
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY storefront_channels_tenant_isolation ON public.storefront_channels
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY storefront_items_tenant_isolation ON public.storefront_items
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY item_media_tenant_isolation ON public.item_media
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY tags_tenant_isolation ON public.tags
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY item_tag_assignments_tenant_isolation ON public.item_tag_assignments
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY inventory_ledger_tenant_select ON public.inventory_ledger
    FOR SELECT TO authenticated
    USING (tenant_id = private.current_tenant_id());

CREATE POLICY inventory_ledger_tenant_insert ON public.inventory_ledger
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = private.current_tenant_id());

-- Ledger: no authenticated UPDATE/DELETE policies (append-only)

-- --------------------------------------------------------------------
-- 12. ANON STOREFRONT CATALOG READ POLICIES
-- Domain/slug resolution enforced in Next.js middleware; DB exposes
-- active/visible catalog rows for public storefront rendering.
-- --------------------------------------------------------------------
CREATE POLICY storefront_channels_anon_select ON public.storefront_channels
    FOR SELECT TO anon
    USING (is_active = TRUE);

CREATE POLICY storefront_items_anon_select ON public.storefront_items
    FOR SELECT TO anon
    USING (
        is_visible = TRUE
        AND EXISTS (
            SELECT 1
            FROM public.storefront_channels sc
            WHERE sc.id = storefront_items.storefront_id
              AND sc.is_active = TRUE
        )
    );

CREATE POLICY items_anon_storefront_select ON public.items
    FOR SELECT TO anon
    USING (
        is_active = TRUE
        AND EXISTS (
            SELECT 1
            FROM public.storefront_items si
            JOIN public.storefront_channels sc ON sc.id = si.storefront_id
            WHERE si.item_id = items.id
              AND si.is_visible = TRUE
              AND sc.is_active = TRUE
        )
    );

CREATE POLICY item_variants_anon_storefront_select ON public.item_variants
    FOR SELECT TO anon
    USING (
        is_active = TRUE
        AND EXISTS (
            SELECT 1
            FROM public.storefront_items si
            JOIN public.storefront_channels sc ON sc.id = si.storefront_id
            WHERE si.item_id = item_variants.item_id
              AND si.is_visible = TRUE
              AND sc.is_active = TRUE
        )
    );

CREATE POLICY item_media_anon_storefront_select ON public.item_media
    FOR SELECT TO anon
    USING (
        show_on_storefront = TRUE
        AND EXISTS (
            SELECT 1
            FROM public.storefront_items si
            JOIN public.storefront_channels sc ON sc.id = si.storefront_id
            WHERE si.item_id = item_media.item_id
              AND si.is_visible = TRUE
              AND sc.is_active = TRUE
        )
    );

CREATE POLICY tags_anon_storefront_select ON public.tags
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM public.item_tag_assignments ita
            JOIN public.storefront_items si ON si.item_id = ita.item_id
            JOIN public.storefront_channels sc ON sc.id = si.storefront_id
            WHERE ita.tag_id = tags.id
              AND si.is_visible = TRUE
              AND sc.is_active = TRUE
        )
    );

CREATE POLICY item_tag_assignments_anon_select ON public.item_tag_assignments
    FOR SELECT TO anon
    USING (
        EXISTS (
            SELECT 1
            FROM public.storefront_items si
            JOIN public.storefront_channels sc ON sc.id = si.storefront_id
            WHERE si.item_id = item_tag_assignments.item_id
              AND si.is_visible = TRUE
              AND sc.is_active = TRUE
        )
    );
