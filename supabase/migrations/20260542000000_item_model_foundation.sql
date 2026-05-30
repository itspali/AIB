-- ====================================================================
-- AIB SMART ERP - ITEM MODEL FOUNDATION (Phase 0)
-- Migration: 20260542000000_item_model_foundation.sql
-- --------------------------------------------------------------------
-- Establishes the full item data model up front so later phases add
-- features without breaking schema changes. Purely structural &
-- additive: new columns carry safe defaults, existing RPCs keep working.
--
--   * item_type (Physical/Service/Digital) decoupled from classification
--   * classification += CONSUMABLE
--   * items.track_inventory, status, needs_review, source
--   * items.costing_method, standard_cost  (costing)
--   * items.tracking_mode (lot/serial anticipatory), is_bundle (BOM anticipatory)
--   * items.tax_code_id, price_is_tax_inclusive  (GST-capable tax)
--   * items.base_uom_id  (managed UOM, FK nullable until UOM mgmt seeds)
--   * item_categories.default_item_type
--   * reference tables: uoms, tax_codes, tax_code_components,
--                       item_variant_identifiers
--   * backfills derived from existing data
--
-- Heavy feature tables (lots, serials, BOM, audit, merge) and the
-- pg_trgm/vector dedupe surface land in later phases.
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. ENUMS
-- --------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_type') THEN
        CREATE TYPE public.item_type AS ENUM ('PHYSICAL', 'SERVICE', 'DIGITAL');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_status') THEN
        CREATE TYPE public.item_status AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED', 'ARCHIVED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_source') THEN
        CREATE TYPE public.item_source AS ENUM ('MANUAL', 'QUICK_CREATE', 'AI', 'IMPORT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_costing_method') THEN
        CREATE TYPE public.item_costing_method AS ENUM ('FIFO', 'WEIGHTED_AVG', 'STANDARD');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_tracking_mode') THEN
        CREATE TYPE public.item_tracking_mode AS ENUM ('NONE', 'LOT', 'SERIAL');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'uom_family') THEN
        CREATE TYPE public.uom_family AS ENUM ('COUNT', 'WEIGHT', 'LENGTH', 'AREA', 'VOLUME', 'TIME');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tax_code_kind') THEN
        CREATE TYPE public.tax_code_kind AS ENUM ('GST', 'VAT', 'SALES_TAX', 'EXEMPT', 'NIL', 'ZERO');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'item_identifier_type') THEN
        CREATE TYPE public.item_identifier_type AS ENUM (
            'BARCODE', 'EAN13', 'UPC', 'GTIN', 'ISBN', 'MPN', 'INTERNAL', 'OTHER'
        );
    END IF;
END;
$$;

-- classification gains CONSUMABLE (not used in this migration, so safe in-txn)
ALTER TYPE public.item_classification_type ADD VALUE IF NOT EXISTS 'CONSUMABLE';

-- --------------------------------------------------------------------
-- 2. REFERENCE TABLE: uoms (managed units of measure)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.uoms (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    family          public.uom_family NOT NULL DEFAULT 'COUNT',
    factor_to_base  NUMERIC(20, 8) NOT NULL DEFAULT 1,
    is_family_base  BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uoms_tenant_code_unique UNIQUE (tenant_id, code),
    CONSTRAINT uoms_factor_positive_chk CHECK (factor_to_base > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uoms_tenant_id_id_unique
    ON public.uoms (tenant_id, id);

CREATE INDEX IF NOT EXISTS uoms_tenant_family_idx
    ON public.uoms (tenant_id, family);

-- --------------------------------------------------------------------
-- 3. REFERENCE TABLE: tax_codes (+ components for GST CGST/SGST/IGST)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tax_codes (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    code                    TEXT NOT NULL,
    name                    TEXT NOT NULL,
    kind                    public.tax_code_kind NOT NULL DEFAULT 'GST',
    rate                    NUMERIC(7, 4) NOT NULL DEFAULT 0,
    is_inclusive_default    BOOLEAN NOT NULL DEFAULT FALSE,
    effective_from          DATE,
    effective_to            DATE,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_codes_tenant_code_unique UNIQUE (tenant_id, code),
    CONSTRAINT tax_codes_rate_non_negative_chk CHECK (rate >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS tax_codes_tenant_id_id_unique
    ON public.tax_codes (tenant_id, id);

CREATE TABLE IF NOT EXISTS public.tax_code_components (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    tax_code_id     UUID NOT NULL,
    name            TEXT NOT NULL,           -- e.g. CGST / SGST / IGST / CESS
    rate            NUMERIC(7, 4) NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_code_components_rate_non_negative_chk CHECK (rate >= 0)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tax_code_components_tax_code_tenant_fk'
    ) THEN
        ALTER TABLE public.tax_code_components
            ADD CONSTRAINT tax_code_components_tax_code_tenant_fk
            FOREIGN KEY (tenant_id, tax_code_id)
            REFERENCES public.tax_codes (tenant_id, id)
            ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS tax_code_components_tax_code_idx
    ON public.tax_code_components (tenant_id, tax_code_id);

-- --------------------------------------------------------------------
-- 4. REFERENCE TABLE: item_variant_identifiers (multiple barcodes/codes)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.item_variant_identifiers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    item_id         UUID NOT NULL,
    variant_id      UUID NOT NULL,
    type            public.item_identifier_type NOT NULL DEFAULT 'BARCODE',
    value           TEXT NOT NULL,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_variant_identifiers_variant_tenant_fk'
    ) THEN
        ALTER TABLE public.item_variant_identifiers
            ADD CONSTRAINT item_variant_identifiers_variant_tenant_fk
            FOREIGN KEY (tenant_id, variant_id)
            REFERENCES public.item_variants (tenant_id, id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'item_variant_identifiers_item_tenant_fk'
    ) THEN
        ALTER TABLE public.item_variant_identifiers
            ADD CONSTRAINT item_variant_identifiers_item_tenant_fk
            FOREIGN KEY (tenant_id, item_id)
            REFERENCES public.items (tenant_id, id)
            ON DELETE CASCADE;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS item_variant_identifiers_variant_idx
    ON public.item_variant_identifiers (tenant_id, variant_id);

-- Non-unique for now; uniqueness enforced in the RPC layer (Phase 8)
-- to avoid migration failure on any pre-existing duplicate barcodes.
CREATE INDEX IF NOT EXISTS item_variant_identifiers_value_idx
    ON public.item_variant_identifiers (tenant_id, value);

-- --------------------------------------------------------------------
-- 5. items: new columns
-- --------------------------------------------------------------------
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS item_type public.item_type NOT NULL DEFAULT 'PHYSICAL',
    ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS status public.item_status NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS source public.item_source NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS costing_method public.item_costing_method NOT NULL DEFAULT 'WEIGHTED_AVG',
    ADD COLUMN IF NOT EXISTS standard_cost NUMERIC(15, 4),
    ADD COLUMN IF NOT EXISTS tracking_mode public.item_tracking_mode NOT NULL DEFAULT 'NONE',
    ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS price_is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tax_code_id UUID,
    ADD COLUMN IF NOT EXISTS base_uom_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'items_tax_code_tenant_fk'
    ) THEN
        ALTER TABLE public.items
            ADD CONSTRAINT items_tax_code_tenant_fk
            FOREIGN KEY (tenant_id, tax_code_id)
            REFERENCES public.tax_codes (tenant_id, id)
            ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'items_base_uom_tenant_fk'
    ) THEN
        ALTER TABLE public.items
            ADD CONSTRAINT items_base_uom_tenant_fk
            FOREIGN KEY (tenant_id, base_uom_id)
            REFERENCES public.uoms (tenant_id, id)
            ON DELETE SET NULL;
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS items_tenant_status_idx
    ON public.items (tenant_id, status);

CREATE INDEX IF NOT EXISTS items_tenant_item_type_idx
    ON public.items (tenant_id, item_type);

CREATE INDEX IF NOT EXISTS items_tenant_needs_review_idx
    ON public.items (tenant_id, needs_review)
    WHERE needs_review = TRUE;

-- --------------------------------------------------------------------
-- 6. item_categories: default_item_type
-- --------------------------------------------------------------------
ALTER TABLE public.item_categories
    ADD COLUMN IF NOT EXISTS default_item_type public.item_type NOT NULL DEFAULT 'PHYSICAL';

-- --------------------------------------------------------------------
-- 7. BACKFILLS (derive from existing data)
-- --------------------------------------------------------------------
-- Nature axis: only SERVICE maps to a non-physical nature today.
UPDATE public.items
SET item_type = 'SERVICE'
WHERE classification = 'SERVICE'
  AND item_type = 'PHYSICAL';

-- Services do not hold stock.
UPDATE public.items
SET track_inventory = FALSE
WHERE item_type IN ('SERVICE', 'DIGITAL');

-- Lifecycle: archived <- inactive, else active.
UPDATE public.items
SET status = CASE WHEN is_active THEN 'ACTIVE'::public.item_status
                  ELSE 'ARCHIVED'::public.item_status END;

-- Migrate existing single barcode into the identifiers table.
INSERT INTO public.item_variant_identifiers (
    tenant_id, item_id, variant_id, type, value, is_primary
)
SELECT
    v.tenant_id, v.item_id, v.id, 'BARCODE'::public.item_identifier_type,
    btrim(v.barcode), TRUE
FROM public.item_variants v
WHERE v.barcode IS NOT NULL
  AND btrim(v.barcode) <> ''
  AND NOT EXISTS (
      SELECT 1 FROM public.item_variant_identifiers ivi
      WHERE ivi.tenant_id = v.tenant_id
        AND ivi.variant_id = v.id
  );

-- --------------------------------------------------------------------
-- 8. updated_at triggers (house convention: public.set_updated_at)
-- --------------------------------------------------------------------
DROP TRIGGER IF EXISTS uoms_set_updated_at ON public.uoms;
CREATE TRIGGER uoms_set_updated_at
    BEFORE UPDATE ON public.uoms
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tax_codes_set_updated_at ON public.tax_codes;
CREATE TRIGGER tax_codes_set_updated_at
    BEFORE UPDATE ON public.tax_codes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tax_code_components_set_updated_at ON public.tax_code_components;
CREATE TRIGGER tax_code_components_set_updated_at
    BEFORE UPDATE ON public.tax_code_components
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS item_variant_identifiers_set_updated_at ON public.item_variant_identifiers;
CREATE TRIGGER item_variant_identifiers_set_updated_at
    BEFORE UPDATE ON public.item_variant_identifiers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 9. RLS: tenant isolation (mirrors existing catalog policy macro)
-- --------------------------------------------------------------------
ALTER TABLE public.uoms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_code_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_variant_identifiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS uoms_tenant_isolation ON public.uoms;
CREATE POLICY uoms_tenant_isolation ON public.uoms
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS tax_codes_tenant_isolation ON public.tax_codes;
CREATE POLICY tax_codes_tenant_isolation ON public.tax_codes
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS tax_code_components_tenant_isolation ON public.tax_code_components;
CREATE POLICY tax_code_components_tenant_isolation ON public.tax_code_components
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

DROP POLICY IF EXISTS item_variant_identifiers_tenant_isolation ON public.item_variant_identifiers;
CREATE POLICY item_variant_identifiers_tenant_isolation ON public.item_variant_identifiers
    FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());
