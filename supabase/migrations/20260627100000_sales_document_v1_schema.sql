-- ====================================================================
-- Sales document v1: schema parity + core RPCs
-- Migration: 20260627100000_sales_document_v1_schema.sql
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. Header column parity (quotations, orders, invoices)
-- --------------------------------------------------------------------
ALTER TABLE public.sales_quotations
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prices_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tax_supply_nature TEXT NOT NULL DEFAULT 'INTERSTATE',
    ADD COLUMN IF NOT EXISTS tax_mechanism public.gst_tax_mechanism NOT NULL DEFAULT 'FORWARD',
    ADD COLUMN IF NOT EXISTS customer_tax_treatment public.tax_treatment_type,
    ADD COLUMN IF NOT EXISTS customer_country_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS shipping_tax_rate_pct NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS shipping_tax_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS additional_charges_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS transaction_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS transaction_discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS origin_location_id UUID,
    ADD COLUMN IF NOT EXISTS converted_to_order_id UUID,
    ADD COLUMN IF NOT EXISTS converted_to_invoice_id UUID;

ALTER TABLE public.sales_orders
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prices_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tax_supply_nature TEXT NOT NULL DEFAULT 'INTERSTATE',
    ADD COLUMN IF NOT EXISTS tax_mechanism public.gst_tax_mechanism NOT NULL DEFAULT 'FORWARD',
    ADD COLUMN IF NOT EXISTS customer_tax_treatment public.tax_treatment_type,
    ADD COLUMN IF NOT EXISTS customer_country_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS shipping_tax_rate_pct NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS shipping_tax_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS additional_charges_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS transaction_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS transaction_discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE public.sales_invoices
    ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(15, 4) NOT NULL DEFAULT 1.0000,
    ADD COLUMN IF NOT EXISTS payment_terms_days INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS prices_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tax_supply_nature TEXT NOT NULL DEFAULT 'INTERSTATE',
    ADD COLUMN IF NOT EXISTS customer_country_code VARCHAR(3),
    ADD COLUMN IF NOT EXISTS rcm_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS shipping_tax_rate_pct NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS shipping_tax_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS additional_charges_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS transaction_discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS transaction_discount_amount NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS commercial_status public.sales_document_status NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN IF NOT EXISTS source_quotation_id UUID,
    ADD COLUMN IF NOT EXISTS ar_posted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gl_tax_posted_at TIMESTAMPTZ;

-- --------------------------------------------------------------------
-- 2. Line column parity
-- --------------------------------------------------------------------
ALTER TABLE public.sales_quotation_items
    ADD COLUMN IF NOT EXISTS uom_code TEXT,
    ADD COLUMN IF NOT EXISTS uom_conversion_factor NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    ADD COLUMN IF NOT EXISTS tax_rate_percentage NUMERIC(7, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS tax_components_json JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.sales_order_items
    ADD COLUMN IF NOT EXISTS uom_code TEXT,
    ADD COLUMN IF NOT EXISTS uom_conversion_factor NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    ADD COLUMN IF NOT EXISTS tax_rate_percentage NUMERIC(7, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS tax_components_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS quantity_invoiced NUMERIC(15, 4) NOT NULL DEFAULT 0.0000;

ALTER TABLE public.sales_invoice_items
    ADD COLUMN IF NOT EXISTS uom_code TEXT,
    ADD COLUMN IF NOT EXISTS uom_conversion_factor NUMERIC(15, 6) NOT NULL DEFAULT 1.000000,
    ADD COLUMN IF NOT EXISTS tax_rate_percentage NUMERIC(7, 4) NOT NULL DEFAULT 0.0000,
    ADD COLUMN IF NOT EXISTS tax_components_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS source_quotation_line_id UUID;

-- --------------------------------------------------------------------
-- 3. Foreign keys
-- --------------------------------------------------------------------
ALTER TABLE public.sales_quotations
    DROP CONSTRAINT IF EXISTS sales_quotations_origin_location_tenant_fk;

ALTER TABLE public.sales_quotations
    ADD CONSTRAINT sales_quotations_origin_location_tenant_fk
    FOREIGN KEY (tenant_id, origin_location_id)
    REFERENCES public.tenant_locations (tenant_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.sales_quotations
    DROP CONSTRAINT IF EXISTS sales_quotations_converted_to_order_tenant_fk;

ALTER TABLE public.sales_quotations
    ADD CONSTRAINT sales_quotations_converted_to_order_tenant_fk
    FOREIGN KEY (tenant_id, converted_to_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.sales_quotations
    DROP CONSTRAINT IF EXISTS sales_quotations_converted_to_invoice_tenant_fk;

ALTER TABLE public.sales_quotations
    ADD CONSTRAINT sales_quotations_converted_to_invoice_tenant_fk
    FOREIGN KEY (tenant_id, converted_to_invoice_id)
    REFERENCES public.sales_invoices (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.sales_invoices
    DROP CONSTRAINT IF EXISTS sales_invoices_source_quotation_tenant_fk;

ALTER TABLE public.sales_invoices
    ADD CONSTRAINT sales_invoices_source_quotation_tenant_fk
    FOREIGN KEY (tenant_id, source_quotation_id)
    REFERENCES public.sales_quotations (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.sales_invoice_items
    DROP CONSTRAINT IF EXISTS sales_invoice_items_source_quotation_line_tenant_fk;

ALTER TABLE public.sales_invoice_items
    ADD CONSTRAINT sales_invoice_items_source_quotation_line_tenant_fk
    FOREIGN KEY (tenant_id, source_quotation_line_id)
    REFERENCES public.sales_quotation_items (tenant_id, id)
    ON DELETE SET NULL;

ALTER TABLE public.sales_order_items
    DROP CONSTRAINT IF EXISTS sales_order_items_quantity_invoiced_chk;

ALTER TABLE public.sales_order_items
    ADD CONSTRAINT sales_order_items_quantity_invoiced_chk
        CHECK (quantity_invoiced >= 0 AND quantity_invoiced <= quantity_ordered);

-- Backfill legacy invoices that posted AR on insert
UPDATE public.sales_invoices
SET commercial_status = 'APPROVED_ACTIVE',
    ar_posted_at = COALESCE(ar_posted_at, created_at),
    gl_tax_posted_at = CASE
        WHEN total_tax_amount > 0 THEN COALESCE(gl_tax_posted_at, created_at)
        ELSE gl_tax_posted_at
    END
WHERE commercial_status = 'DRAFT';

UPDATE public.sales_invoices
SET exchange_rate = COALESCE(exchange_rate_snapshot, 1.0000)
WHERE exchange_rate IS DISTINCT FROM COALESCE(exchange_rate_snapshot, 1.0000);

-- --------------------------------------------------------------------
-- 4. Trigger fixes — post AR / GL only on APPROVED_ACTIVE
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_invoices_post_accounts_receivable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    IF NEW.commercial_status IS DISTINCT FROM 'APPROVED_ACTIVE'::public.sales_document_status THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    IF NEW.ar_posted_at IS NOT NULL THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    UPDATE public.entities
    SET current_balance = current_balance + NEW.total_net_amount,
        updated_at = NOW()
    WHERE id = NEW.customer_id;

    UPDATE public.sales_invoices
    SET ar_posted_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.id
      AND tenant_id = NEW.tenant_id
      AND ar_posted_at IS NULL;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_invoices_post_accounts_receivable ON public.sales_invoices;
CREATE TRIGGER sales_invoices_post_accounts_receivable
    AFTER INSERT OR UPDATE OF commercial_status, total_net_amount ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_invoices_post_accounts_receivable();

CREATE OR REPLACE FUNCTION public.sales_invoices_post_gl_tax_split()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_header_id UUID;
    v_voucher TEXT;
    v_half_tax NUMERIC(15, 4);
BEGIN
    IF NEW.commercial_status IS DISTINCT FROM 'APPROVED_ACTIVE'::public.sales_document_status THEN
        RETURN NEW;
    END IF;

    IF NEW.gl_tax_posted_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.total_tax_amount <= 0 OR NEW.tax_treatment_applied = 'ZERO_RATED' THEN
        RETURN NEW;
    END IF;

    v_voucher := 'GL-TAX-' || NEW.invoice_number;
    v_header_id := private.create_gl_voucher(
        NEW.tenant_id, v_voucher, NOW(), 'SALES_INVOICE', NEW.id,
        'Output tax liability for invoice ' || NEW.invoice_number
    );

    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1390-OUTPUT-TAX-RECEIVABLE', NEW.total_tax_amount, 0.0000);

    IF NEW.tax_treatment_applied = 'CGST_SGST' THEN
        v_half_tax := NEW.total_tax_amount / 2.0000;
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2111-CGST-LIABILITY', 0.0000, v_half_tax);
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2112-SGST-LIABILITY', 0.0000, NEW.total_tax_amount - v_half_tax);
    ELSIF NEW.tax_treatment_applied = 'COMPOSITION' THEN
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2110-IGST-LIABILITY', 0.0000, NEW.total_tax_amount);
    ELSE
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2110-IGST-LIABILITY', 0.0000, NEW.total_tax_amount);
    END IF;

    UPDATE public.sales_invoices
    SET gl_tax_posted_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.id
      AND tenant_id = NEW.tenant_id
      AND gl_tax_posted_at IS NULL;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_invoices_post_gl_tax_split ON public.sales_invoices;
CREATE TRIGGER sales_invoices_post_gl_tax_split
    AFTER INSERT OR UPDATE OF commercial_status, total_tax_amount, tax_treatment_applied ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_invoices_post_gl_tax_split();

-- --------------------------------------------------------------------
-- 5. Edit permission + approval stub (full engine in migration 2)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.can_edit_sales_orders()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_role public.user_role;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT m.role INTO v_role
    FROM public.user_tenant_memberships m
    WHERE m.user_id = v_user_id
      AND m.tenant_id = v_tenant_id
      AND m.is_active = TRUE;

    IF v_role IN ('OWNER'::public.user_role, 'ADMIN'::public.user_role) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_control_registry
        WHERE tenant_id = v_tenant_id
          AND registry_key = 'allow_sales_order_modification'
          AND target_reference_id = v_user_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION private.so_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_sales_order_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT FALSE;
$$;

CREATE OR REPLACE FUNCTION private.quote_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_quotation_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT FALSE;
$$;

CREATE OR REPLACE FUNCTION private.invoice_approval_required(
    p_tenant_id UUID,
    p_total_net_amount NUMERIC,
    p_submitter_id UUID,
    p_sales_invoice_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
    SELECT FALSE;
$$;

-- --------------------------------------------------------------------
-- 6. Shared sales line + GST helpers
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.resolve_sales_document_gst_context(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_origin_location_id UUID DEFAULT NULL
)
RETURNS TABLE (
    tax_supply_nature TEXT,
    tax_mechanism public.gst_tax_mechanism,
    customer_tax_treatment public.tax_treatment_type,
    customer_country_code VARCHAR(3),
    rcm_applicable BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_country TEXT;
    v_customer RECORD;
    v_origin_state TEXT;
    v_gst_ctx RECORD;
BEGIN
    SELECT upper(btrim(COALESCE(country_code, 'IN')))
    INTO v_tenant_country
    FROM public.tenants
    WHERE id = p_tenant_id;

    SELECT e.tax_treatment, e.billing_country_code, e.billing_state
    INTO v_customer
    FROM public.entities e
    WHERE e.id = p_customer_id
      AND e.tenant_id = p_tenant_id;

    IF p_origin_location_id IS NOT NULL THEN
        SELECT tl.state INTO v_origin_state
        FROM public.tenant_locations tl
        WHERE tl.id = p_origin_location_id
          AND tl.tenant_id = p_tenant_id;
    END IF;

    SELECT * INTO v_gst_ctx
    FROM private.gst_resolve_supply_context(
        v_tenant_country,
        COALESCE(v_customer.tax_treatment, 'REGULAR_B2B'::public.tax_treatment_type),
        v_customer.billing_country_code,
        COALESCE(v_customer.billing_state, p_billing_state),
        COALESCE(p_shipping_state, v_origin_state),
        'SALE',
        'GOODS'
    )
    LIMIT 1;

    tax_supply_nature := v_gst_ctx.supply_nature;
    tax_mechanism := v_gst_ctx.tax_mechanism;
    customer_tax_treatment := v_customer.tax_treatment;
    customer_country_code := upper(btrim(COALESCE(v_customer.billing_country_code, 'IN')));
    rcm_applicable := (v_gst_ctx.tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism);
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION private.compute_sales_line_amounts(
    p_entry JSONB,
    p_tenant_id UUID,
    p_prices_tax_inclusive BOOLEAN,
    p_tax_supply_nature TEXT,
    p_tax_mechanism public.gst_tax_mechanism
)
RETURNS TABLE (
    item_id UUID,
    variant_id UUID,
    uom_code TEXT,
    uom_conversion_factor NUMERIC,
    quantity NUMERIC,
    unit_price NUMERIC,
    discount_percentage NUMERIC,
    discount_amount NUMERIC,
    tax_rate_percentage NUMERIC,
    tax_components_json JSONB,
    line_tax_amount NUMERIC,
    line_total_gross NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_variant_id UUID;
    v_item_id UUID;
    v_base_uom TEXT;
    v_requested_uom TEXT;
    v_uom_conversion NUMERIC(15, 6) := 1;
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_discount_pct NUMERIC(5, 2);
    v_discount_amt NUMERIC(15, 4);
    v_line_extension NUMERIC(15, 4);
    v_line_discount NUMERIC(15, 4);
    v_discount_per_unit NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(7, 4);
    v_tax_components JSONB := '[]'::jsonb;
    v_override_rate NUMERIC(7, 4);
BEGIN
    v_variant_id := NULLIF(p_entry ->> 'variant_id', '')::UUID;
    v_item_id := NULLIF(p_entry ->> 'item_id', '')::UUID;
    v_qty := NULLIF(p_entry ->> 'quantity', '')::NUMERIC;
    v_unit_price := COALESCE(NULLIF(p_entry ->> 'unit_price', '')::NUMERIC, 0);
    v_discount_pct := COALESCE(NULLIF(p_entry ->> 'discount_percentage', '')::NUMERIC, 0);
    v_discount_amt := COALESCE(NULLIF(p_entry ->> 'discount_amount', '')::NUMERIC, 0);
    v_requested_uom := NULLIF(upper(btrim(p_entry ->> 'uom_code')), '');
    v_override_rate := NULLIF(p_entry ->> 'tax_rate_percentage', '')::NUMERIC;

    IF v_variant_id IS NOT NULL THEN
        SELECT iv.item_id, i.base_unit_of_measure
        INTO v_item_id, v_base_uom
        FROM public.item_variants iv
        INNER JOIN public.items i ON i.id = iv.item_id AND i.tenant_id = iv.tenant_id
        WHERE iv.id = v_variant_id
          AND iv.tenant_id = p_tenant_id
          AND iv.is_active = TRUE;
    ELSIF v_item_id IS NOT NULL THEN
        SELECT i.base_unit_of_measure
        INTO v_base_uom
        FROM public.items i
        WHERE i.id = v_item_id
          AND i.tenant_id = p_tenant_id
          AND i.is_active = TRUE;
    END IF;

    IF v_item_id IS NULL THEN
        RAISE EXCEPTION 'item_id or variant_id is required on each line';
    END IF;

    IF v_qty IS NULL OR v_qty <= 0 THEN
        RAISE EXCEPTION 'quantity must be greater than zero';
    END IF;

    IF v_unit_price < 0 THEN
        RAISE EXCEPTION 'unit_price cannot be negative';
    END IF;

    v_base_uom := COALESCE(NULLIF(btrim(v_base_uom), ''), 'PCS');

    IF v_requested_uom IS NULL OR v_requested_uom = v_base_uom THEN
        uom_code := v_base_uom;
        uom_conversion_factor := 1;
    ELSE
        SELECT iu.conversion_factor
        INTO v_uom_conversion
        FROM public.item_uoms iu
        WHERE iu.item_id = v_item_id
          AND iu.tenant_id = p_tenant_id
          AND iu.uom_code = v_requested_uom
        LIMIT 1;

        IF NOT FOUND OR v_uom_conversion IS NULL OR v_uom_conversion <= 0 THEN
            RAISE EXCEPTION 'uom_code is not a valid alternate unit for this item';
        END IF;

        uom_code := v_requested_uom;
        uom_conversion_factor := v_uom_conversion;
    END IF;

    v_line_extension := v_qty * v_unit_price;

    IF v_discount_amt > 0 THEN
        v_line_discount := LEAST(v_discount_amt, v_line_extension);
        v_discount_pct := 0;
    ELSIF v_discount_pct > 0 THEN
        v_line_discount := LEAST(v_line_extension, v_line_extension * v_discount_pct / 100);
        v_discount_amt := 0;
    ELSE
        v_line_discount := 0;
    END IF;

    v_discount_per_unit := CASE
        WHEN v_qty > 0 THEN ROUND(v_line_discount / v_qty, 4)
        ELSE 0
    END;

    SELECT rate, tax_amount, taxable_base, tax_components
    INTO v_tax_rate, v_line_tax, v_line_gross, v_tax_components
    FROM private.resolve_line_tax(
        v_item_id,
        v_qty,
        v_unit_price,
        v_discount_per_unit,
        p_prices_tax_inclusive,
        p_tax_supply_nature,
        p_tax_mechanism
    )
    LIMIT 1;

    v_tax_rate := COALESCE(v_override_rate, v_tax_rate, 0);
    v_line_tax := COALESCE(v_line_tax, 0);
    v_line_gross := COALESCE(v_line_gross, GREATEST(v_line_extension - v_line_discount, 0));
    v_tax_components := COALESCE(v_tax_components, '[]'::jsonb);

    item_id := v_item_id;
    variant_id := v_variant_id;
    quantity := v_qty;
    unit_price := v_unit_price;
    discount_percentage := v_discount_pct;
    discount_amount := v_discount_amt;
    tax_rate_percentage := v_tax_rate;
    tax_components_json := v_tax_components;
    line_tax_amount := v_line_tax;
    line_total_gross := v_line_gross;
    RETURN NEXT;
END;
$$;

-- --------------------------------------------------------------------
-- 7. save_sales_order
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_sales_order(
    p_sales_order_id UUID,
    p_customer_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_shipping_location_id UUID DEFAULT NULL,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_customer RECORD;
    v_gst RECORD;
    v_so_id UUID;
    v_so_status public.sales_document_status;
    v_voucher_number TEXT;
    v_entry JSONB;
    v_line RECORD;
    v_line_count INTEGER := 0;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 4) := GREATEST(COALESCE(p_exchange_rate, 1), 0.0001);
    v_prices_tax_inclusive BOOLEAN := COALESCE(p_prices_tax_inclusive, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
    v_txn_discount_pct NUMERIC(5, 2) := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
    v_txn_discount_amt NUMERIC(15, 4) := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);
    v_total_net NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    IF p_created_by IS NULL OR p_customer_id IS NULL THEN
        RAISE EXCEPTION 'created_by and customer_id are required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one sales order line is required';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    IF v_customer.type NOT IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type) THEN
        RAISE EXCEPTION 'entity is not a customer';
    END IF;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, p_shipping_location_id
    );

    IF p_sales_order_id IS NOT NULL THEN
        SELECT id, commercial_status INTO v_so_id, v_so_status
        FROM public.sales_orders
        WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales order not found';
        END IF;

        IF v_so_status NOT IN ('DRAFT'::public.sales_document_status, 'PENDING_APPROVAL'::public.sales_document_status) THEN
            RAISE EXCEPTION 'this sales order cannot be edited';
        END IF;

        UPDATE public.sales_orders
        SET customer_id = p_customer_id,
            shipping_location_id = p_shipping_location_id,
            billing_state = p_billing_state,
            shipping_state = p_shipping_state,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            exchange_rate = v_exchange_rate,
            prices_tax_inclusive = v_prices_tax_inclusive,
            tax_supply_nature = v_gst.tax_supply_nature,
            tax_mechanism = v_gst.tax_mechanism,
            customer_tax_treatment = v_gst.customer_tax_treatment,
            customer_country_code = v_gst.customer_country_code,
            rcm_applicable = v_gst.rcm_applicable,
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            custom_fields = v_custom_fields,
            updated_at = NOW()
        WHERE id = p_sales_order_id;

        DELETE FROM public.sales_order_items
        WHERE sales_order_id = p_sales_order_id AND tenant_id = v_tenant_id;

        v_so_id := p_sales_order_id;
    ELSE
        v_voucher_number := public.generate_next_voucher_string(
            v_tenant_id, 'SALES_ORDER'::public.document_voucher_type, NULL, p_shipping_location_id
        );

        INSERT INTO public.sales_orders (
            tenant_id, customer_id, shipping_location_id, voucher_number,
            commercial_status, billing_state, shipping_state,
            payment_terms_days, currency_code, exchange_rate, prices_tax_inclusive,
            tax_supply_nature, tax_mechanism, customer_tax_treatment, customer_country_code,
            rcm_applicable, shipping_amount, shipping_tax_rate_pct, shipping_tax_amount,
            round_off_amount, additional_charges_amount,
            transaction_discount_percentage, transaction_discount_amount,
            custom_fields, created_by
        )
        VALUES (
            v_tenant_id, p_customer_id, p_shipping_location_id, v_voucher_number,
            'DRAFT'::public.sales_document_status, p_billing_state, p_shipping_state,
            v_payment_terms, v_currency_code, v_exchange_rate, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism, v_gst.customer_tax_treatment,
            v_gst.customer_country_code, v_gst.rcm_applicable,
            v_shipping_amount, v_shipping_tax_rate_pct, v_shipping_tax_amount,
            v_round_off_amount, v_additional_charges_amount,
            v_txn_discount_pct, v_txn_discount_amt,
            v_custom_fields, p_created_by
        )
        RETURNING id INTO v_so_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_order_items (
            tenant_id, sales_order_id, item_id, variant_id,
            uom_code, uom_conversion_factor, quantity_ordered,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_gross
        )
        VALUES (
            v_tenant_id, v_so_id, v_line.item_id, v_line.variant_id,
            v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
            v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
            v_line.tax_rate_percentage, v_line.tax_components_json,
            v_line.line_tax_amount, v_line.line_total_gross
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid sales order lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_orders
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        transaction_discount_amount = v_txn_discount,
        updated_at = NOW()
    WHERE id = v_so_id;

    RETURN v_so_id;
END;
$$;

-- --------------------------------------------------------------------
-- 8. save_sales_quotation
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_sales_quotation(
    p_sales_quotation_id UUID,
    p_customer_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_valid_until TIMESTAMPTZ,
    p_origin_location_id UUID DEFAULT NULL,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_customer RECORD;
    v_gst RECORD;
    v_quote_id UUID;
    v_quote_status public.sales_document_status;
    v_quote_number TEXT;
    v_entry JSONB;
    v_line RECORD;
    v_line_count INTEGER := 0;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 4) := GREATEST(COALESCE(p_exchange_rate, 1), 0.0001);
    v_prices_tax_inclusive BOOLEAN := COALESCE(p_prices_tax_inclusive, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
    v_txn_discount_pct NUMERIC(5, 2) := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
    v_txn_discount_amt NUMERIC(15, 4) := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);
    v_total_net NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales quotation edit permission required';
    END IF;

    IF p_created_by IS NULL OR p_customer_id IS NULL OR p_valid_until IS NULL THEN
        RAISE EXCEPTION 'created_by, customer_id, and valid_until are required';
    END IF;

    IF p_valid_until <= NOW() THEN
        RAISE EXCEPTION 'valid_until must be in the future';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one quotation line is required';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND OR v_customer.type NOT IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type) THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, p_origin_location_id
    );

    IF p_sales_quotation_id IS NOT NULL THEN
        SELECT id, commercial_status INTO v_quote_id, v_quote_status
        FROM public.sales_quotations
        WHERE id = p_sales_quotation_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales quotation not found';
        END IF;

        IF v_quote_status NOT IN ('DRAFT'::public.sales_document_status, 'PENDING_APPROVAL'::public.sales_document_status) THEN
            RAISE EXCEPTION 'this sales quotation cannot be edited';
        END IF;

        UPDATE public.sales_quotations
        SET customer_id = p_customer_id,
            origin_location_id = p_origin_location_id,
            valid_until = p_valid_until,
            billing_state = p_billing_state,
            shipping_state = p_shipping_state,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            exchange_rate = v_exchange_rate,
            prices_tax_inclusive = v_prices_tax_inclusive,
            tax_supply_nature = v_gst.tax_supply_nature,
            tax_mechanism = v_gst.tax_mechanism,
            customer_tax_treatment = v_gst.customer_tax_treatment,
            customer_country_code = v_gst.customer_country_code,
            rcm_applicable = v_gst.rcm_applicable,
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            custom_fields = v_custom_fields,
            updated_at = NOW()
        WHERE id = p_sales_quotation_id;

        DELETE FROM public.sales_quotation_items
        WHERE sales_quotation_id = p_sales_quotation_id AND tenant_id = v_tenant_id;

        v_quote_id := p_sales_quotation_id;
    ELSE
        v_quote_number := public.generate_next_voucher_string(
            v_tenant_id, 'SALES_QUOTATION'::public.document_voucher_type, NULL, p_origin_location_id
        );

        INSERT INTO public.sales_quotations (
            tenant_id, customer_id, origin_location_id, quotation_number,
            commercial_status, valid_until, billing_state, shipping_state,
            payment_terms_days, currency_code, exchange_rate, prices_tax_inclusive,
            tax_supply_nature, tax_mechanism, customer_tax_treatment, customer_country_code,
            rcm_applicable, shipping_amount, shipping_tax_rate_pct, shipping_tax_amount,
            round_off_amount, additional_charges_amount,
            transaction_discount_percentage, transaction_discount_amount,
            custom_fields, created_by
        )
        VALUES (
            v_tenant_id, p_customer_id, p_origin_location_id, v_quote_number,
            'DRAFT'::public.sales_document_status, p_valid_until, p_billing_state, p_shipping_state,
            v_payment_terms, v_currency_code, v_exchange_rate, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism, v_gst.customer_tax_treatment,
            v_gst.customer_country_code, v_gst.rcm_applicable,
            v_shipping_amount, v_shipping_tax_rate_pct, v_shipping_tax_amount,
            v_round_off_amount, v_additional_charges_amount,
            v_txn_discount_pct, v_txn_discount_amt,
            v_custom_fields, p_created_by
        )
        RETURNING id INTO v_quote_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_quotation_items (
            tenant_id, sales_quotation_id, item_id, variant_id,
            uom_code, uom_conversion_factor, quantity_quoted,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_gross
        )
        VALUES (
            v_tenant_id, v_quote_id, v_line.item_id, v_line.variant_id,
            v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
            v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
            v_line.tax_rate_percentage, v_line.tax_components_json,
            v_line.line_tax_amount, v_line.line_total_gross
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid quotation lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_quotations
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        transaction_discount_amount = v_txn_discount,
        updated_at = NOW()
    WHERE id = v_quote_id;

    RETURN v_quote_id;
END;
$$;

-- --------------------------------------------------------------------
-- 9. save_sales_invoice (draft only)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_sales_invoice(
    p_sales_invoice_id UUID,
    p_customer_id UUID,
    p_origin_location_id UUID,
    p_lines JSONB,
    p_created_by UUID,
    p_billing_state TEXT,
    p_shipping_state TEXT,
    p_source_order_id UUID DEFAULT NULL,
    p_source_quotation_id UUID DEFAULT NULL,
    p_payment_terms_days INTEGER DEFAULT NULL,
    p_custom_fields JSONB DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_prices_tax_inclusive BOOLEAN DEFAULT NULL,
    p_shipping_amount NUMERIC DEFAULT NULL,
    p_shipping_tax_rate_pct NUMERIC DEFAULT NULL,
    p_round_off_amount NUMERIC DEFAULT NULL,
    p_additional_charges_amount NUMERIC DEFAULT NULL,
    p_transaction_discount_percentage NUMERIC DEFAULT NULL,
    p_transaction_discount_amount NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_customer RECORD;
    v_gst RECORD;
    v_invoice_id UUID;
    v_invoice_status public.sales_document_status;
    v_invoice_number TEXT;
    v_entry JSONB;
    v_line RECORD;
    v_line_count INTEGER := 0;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_subtotal NUMERIC(15, 4) := 0;
    v_txn_discount NUMERIC(15, 4) := 0;
    v_payment_terms INTEGER := GREATEST(COALESCE(p_payment_terms_days, 0), 0);
    v_custom_fields JSONB := COALESCE(p_custom_fields, '{}'::jsonb);
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 4) := GREATEST(COALESCE(p_exchange_rate, 1), 0.0001);
    v_prices_tax_inclusive BOOLEAN := COALESCE(p_prices_tax_inclusive, FALSE);
    v_shipping_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_amount, 0), 0);
    v_shipping_tax_rate_pct NUMERIC(15, 4) := GREATEST(COALESCE(p_shipping_tax_rate_pct, 0), 0);
    v_shipping_tax_amount NUMERIC(15, 4) := ROUND(v_shipping_amount * v_shipping_tax_rate_pct / 100, 4);
    v_round_off_amount NUMERIC(15, 4) := COALESCE(p_round_off_amount, 0);
    v_additional_charges_amount NUMERIC(15, 4) := GREATEST(COALESCE(p_additional_charges_amount, 0), 0);
    v_txn_discount_pct NUMERIC(5, 2) := GREATEST(COALESCE(p_transaction_discount_percentage, 0), 0);
    v_txn_discount_amt NUMERIC(15, 4) := GREATEST(COALESCE(p_transaction_discount_amount, 0), 0);
    v_total_net NUMERIC(15, 4);
    v_source_order_line_id UUID;
    v_source_quotation_line_id UUID;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales invoice edit permission required';
    END IF;

    IF p_created_by IS NULL OR p_customer_id IS NULL OR p_origin_location_id IS NULL THEN
        RAISE EXCEPTION 'created_by, customer_id, and origin_location_id are required';
    END IF;

    IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
        RAISE EXCEPTION 'at least one invoice line is required';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.tenant_locations
        WHERE id = p_origin_location_id AND tenant_id = v_tenant_id AND is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'origin location not found';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    SELECT * INTO v_customer
    FROM public.entities
    WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE;

    IF NOT FOUND OR v_customer.type NOT IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type) THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT * INTO v_gst
    FROM private.resolve_sales_document_gst_context(
        v_tenant_id, p_customer_id, p_billing_state, p_shipping_state, p_origin_location_id
    );

    IF p_sales_invoice_id IS NOT NULL THEN
        SELECT id, commercial_status INTO v_invoice_id, v_invoice_status
        FROM public.sales_invoices
        WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'sales invoice not found';
        END IF;

        IF v_invoice_status <> 'DRAFT'::public.sales_document_status THEN
            RAISE EXCEPTION 'only draft sales invoices can be saved';
        END IF;

        UPDATE public.sales_invoices
        SET customer_id = p_customer_id,
            origin_location_id = p_origin_location_id,
            source_order_id = p_source_order_id,
            source_quotation_id = p_source_quotation_id,
            billing_state = p_billing_state,
            shipping_state = p_shipping_state,
            payment_terms_days = v_payment_terms,
            currency_code = v_currency_code,
            exchange_rate = v_exchange_rate,
            exchange_rate_snapshot = v_exchange_rate,
            prices_tax_inclusive = v_prices_tax_inclusive,
            tax_supply_nature = v_gst.tax_supply_nature,
            customer_country_code = v_gst.customer_country_code,
            rcm_applicable = v_gst.rcm_applicable,
            shipping_amount = v_shipping_amount,
            shipping_tax_rate_pct = v_shipping_tax_rate_pct,
            shipping_tax_amount = v_shipping_tax_amount,
            round_off_amount = v_round_off_amount,
            additional_charges_amount = v_additional_charges_amount,
            transaction_discount_percentage = v_txn_discount_pct,
            transaction_discount_amount = v_txn_discount_amt,
            custom_fields = v_custom_fields,
            updated_at = NOW()
        WHERE id = p_sales_invoice_id;

        DELETE FROM public.sales_invoice_items
        WHERE sales_invoice_id = p_sales_invoice_id AND tenant_id = v_tenant_id;

        v_invoice_id := p_sales_invoice_id;
    ELSE
        v_invoice_number := public.generate_next_voucher_string(
            v_tenant_id, 'SALES_INVOICE'::public.document_voucher_type, NULL, p_origin_location_id
        );

        INSERT INTO public.sales_invoices (
            tenant_id, customer_id, origin_location_id, source_order_id, source_quotation_id,
            invoice_number, commercial_status, billing_state, shipping_state,
            payment_terms_days, currency_code, exchange_rate, exchange_rate_snapshot,
            prices_tax_inclusive, tax_supply_nature, customer_country_code, rcm_applicable,
            shipping_amount, shipping_tax_rate_pct, shipping_tax_amount,
            round_off_amount, additional_charges_amount,
            transaction_discount_percentage, transaction_discount_amount,
            custom_fields, created_by
        )
        VALUES (
            v_tenant_id, p_customer_id, p_origin_location_id, p_source_order_id, p_source_quotation_id,
            v_invoice_number, 'DRAFT'::public.sales_document_status, p_billing_state, p_shipping_state,
            v_payment_terms, v_currency_code, v_exchange_rate, v_exchange_rate,
            v_prices_tax_inclusive, v_gst.tax_supply_nature, v_gst.customer_country_code, v_gst.rcm_applicable,
            v_shipping_amount, v_shipping_tax_rate_pct, v_shipping_tax_amount,
            v_round_off_amount, v_additional_charges_amount,
            v_txn_discount_pct, v_txn_discount_amt,
            v_custom_fields, p_created_by
        )
        RETURNING id INTO v_invoice_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        SELECT * INTO v_line
        FROM private.compute_sales_line_amounts(
            v_entry, v_tenant_id, v_prices_tax_inclusive,
            v_gst.tax_supply_nature, v_gst.tax_mechanism
        );

        v_source_order_line_id := NULLIF(v_entry ->> 'source_order_line_id', '')::UUID;
        v_source_quotation_line_id := NULLIF(v_entry ->> 'source_quotation_line_id', '')::UUID;

        v_subtotal := v_subtotal + v_line.line_total_gross;
        v_total_gross := v_total_gross + v_line.line_total_gross;
        v_total_tax := v_total_tax + v_line.line_tax_amount;

        INSERT INTO public.sales_invoice_items (
            tenant_id, sales_invoice_id, item_id, variant_id,
            source_order_line_id, source_quotation_line_id,
            uom_code, uom_conversion_factor, quantity_invoiced,
            unit_price_selling, discount_percentage, discount_amount,
            tax_rate_percentage, tax_components_json,
            line_tax_amount, line_total_net
        )
        VALUES (
            v_tenant_id, v_invoice_id, v_line.item_id, v_line.variant_id,
            v_source_order_line_id, v_source_quotation_line_id,
            v_line.uom_code, v_line.uom_conversion_factor, v_line.quantity,
            v_line.unit_price, v_line.discount_percentage, v_line.discount_amount,
            v_line.tax_rate_percentage, v_line.tax_components_json,
            v_line.line_tax_amount, v_line.line_total_gross + v_line.line_tax_amount
        );

        v_line_count := v_line_count + 1;
    END LOOP;

    IF v_line_count = 0 THEN
        RAISE EXCEPTION 'no valid invoice lines were saved';
    END IF;

    IF v_txn_discount_amt > 0 THEN
        v_txn_discount := LEAST(v_txn_discount_amt, v_subtotal);
    ELSIF v_txn_discount_pct > 0 THEN
        v_txn_discount := LEAST(v_subtotal, ROUND(v_subtotal * v_txn_discount_pct / 100, 4));
    END IF;

    v_total_gross := GREATEST(v_total_gross - v_txn_discount, 0);
    v_total_tax := v_total_tax + v_shipping_tax_amount;
    v_total_net := v_total_gross + v_total_tax + v_shipping_amount + v_additional_charges_amount + v_round_off_amount;

    UPDATE public.sales_invoices
    SET total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_net_amount = v_total_net,
        transaction_discount_amount = v_txn_discount,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN v_invoice_id;
END;
$$;

-- --------------------------------------------------------------------
-- 10. confirm_sales_order
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_sales_order(p_sales_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_so RECORD;
    v_line_count INTEGER;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status = 'DRAFT'::public.sales_document_status THEN
        IF private.so_approval_required(v_tenant_id, v_so.total_net_amount, v_user_id, p_sales_order_id) THEN
            RAISE EXCEPTION 'sales order approval is required before confirmation';
        END IF;
    ELSIF v_so.commercial_status = 'PENDING_APPROVAL'::public.sales_document_status THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.document_approval_requests dar
            WHERE dar.tenant_id = v_tenant_id
              AND dar.document_type = 'SALES_ORDER'
              AND dar.document_id = p_sales_order_id
              AND dar.status = 'APPROVED'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.document_approval_runs r
            WHERE r.tenant_id = v_tenant_id
              AND r.document_type = 'SALES_ORDER'
              AND r.document_id = p_sales_order_id
              AND r.status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'sales order must be approved before confirmation';
        END IF;
    ELSE
        RAISE EXCEPTION 'only draft or pending-approval sales orders can be confirmed';
    END IF;

    SELECT COUNT(*) INTO v_line_count
    FROM public.sales_order_items
    WHERE sales_order_id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF v_line_count < 1 THEN
        RAISE EXCEPTION 'sales order must have at least one line before confirmation';
    END IF;

    UPDATE public.sales_orders
    SET commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_sales_order_id;

    RETURN jsonb_build_object('sales_order_id', p_sales_order_id, 'commercial_status', 'APPROVED_ACTIVE');
END;
$$;

-- --------------------------------------------------------------------
-- 11. post_sales_invoice
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_sales_invoice(p_sales_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_invoice RECORD;
    v_inv_line RECORD;
    v_so_line RECORD;
    v_remaining NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales invoice post permission required';
    END IF;

    SELECT * INTO v_invoice
    FROM public.sales_invoices
    WHERE id = p_sales_invoice_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales invoice not found';
    END IF;

    IF v_invoice.commercial_status = 'DRAFT'::public.sales_document_status THEN
        IF private.invoice_approval_required(v_tenant_id, v_invoice.total_net_amount, v_user_id, p_sales_invoice_id) THEN
            RAISE EXCEPTION 'sales invoice approval is required before posting';
        END IF;
    ELSIF v_invoice.commercial_status = 'PENDING_APPROVAL'::public.sales_document_status THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.document_approval_requests dar
            WHERE dar.tenant_id = v_tenant_id
              AND dar.document_type = 'SALES_INVOICE'
              AND dar.document_id = p_sales_invoice_id
              AND dar.status = 'APPROVED'
        )
        AND NOT EXISTS (
            SELECT 1 FROM public.document_approval_runs r
            WHERE r.tenant_id = v_tenant_id
              AND r.document_type = 'SALES_INVOICE'
              AND r.document_id = p_sales_invoice_id
              AND r.status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'sales invoice must be approved before posting';
        END IF;
    ELSIF v_invoice.commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status THEN
        RETURN jsonb_build_object('sales_invoice_id', p_sales_invoice_id, 'already_posted', TRUE);
    ELSE
        RAISE EXCEPTION 'only draft or pending-approval sales invoices can be posted';
    END IF;

    UPDATE public.sales_invoices
    SET commercial_status = 'APPROVED_ACTIVE'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_sales_invoice_id;

    FOR v_inv_line IN
        SELECT sii.*
        FROM public.sales_invoice_items sii
        WHERE sii.sales_invoice_id = p_sales_invoice_id
          AND sii.tenant_id = v_tenant_id
          AND sii.source_order_line_id IS NOT NULL
    LOOP
        SELECT * INTO v_so_line
        FROM public.sales_order_items
        WHERE id = v_inv_line.source_order_line_id
          AND tenant_id = v_tenant_id;

        IF FOUND THEN
            v_remaining := v_so_line.quantity_ordered - v_so_line.quantity_invoiced;
            IF v_inv_line.quantity_invoiced > v_remaining THEN
                RAISE EXCEPTION 'invoice quantity exceeds remaining order quantity on line %', v_so_line.id;
            END IF;

            UPDATE public.sales_order_items
            SET quantity_invoiced = quantity_invoiced + v_inv_line.quantity_invoiced,
                updated_at = NOW()
            WHERE id = v_so_line.id;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'sales_invoice_id', p_sales_invoice_id,
        'commercial_status', 'APPROVED_ACTIVE',
        'ar_posted_at', (SELECT ar_posted_at FROM public.sales_invoices WHERE id = p_sales_invoice_id)
    );
END;
$$;

-- --------------------------------------------------------------------
-- 12. Conversion RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.convert_quotation_to_order(p_quotation_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_quote RECORD;
    v_so_id UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'sales order edit permission required';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_quote.converted_to_order_id IS NOT NULL THEN
        RETURN v_quote.converted_to_order_id;
    END IF;

    IF v_quote.commercial_status NOT IN ('DRAFT'::public.sales_document_status, 'APPROVED_ACTIVE'::public.sales_document_status) THEN
        RAISE EXCEPTION 'quotation cannot be converted in its current status';
    END IF;

    IF private.quote_approval_required(v_tenant_id, v_quote.total_net_amount, v_user_id, p_quotation_id)
       AND v_quote.commercial_status = 'DRAFT'::public.sales_document_status
    THEN
        RAISE EXCEPTION 'quotation approval is required before conversion';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', sqi.item_id,
        'variant_id', sqi.variant_id,
        'quantity', sqi.quantity_quoted,
        'unit_price', sqi.unit_price_selling,
        'discount_percentage', sqi.discount_percentage,
        'discount_amount', sqi.discount_amount,
        'uom_code', sqi.uom_code,
        'tax_rate_percentage', sqi.tax_rate_percentage
    )), '[]'::jsonb)
    INTO v_lines
    FROM public.sales_quotation_items sqi
    WHERE sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = v_tenant_id;

    v_so_id := public.save_sales_order(
        NULL,
        v_quote.customer_id,
        v_lines,
        v_user_id,
        v_quote.billing_state,
        v_quote.shipping_state,
        v_quote.origin_location_id,
        v_quote.payment_terms_days,
        v_quote.custom_fields,
        v_quote.currency_code,
        v_quote.exchange_rate,
        v_quote.prices_tax_inclusive,
        v_quote.shipping_amount,
        v_quote.shipping_tax_rate_pct,
        v_quote.round_off_amount,
        v_quote.additional_charges_amount,
        v_quote.transaction_discount_percentage,
        v_quote.transaction_discount_amount
    );

    UPDATE public.sales_orders
    SET source_quotation_id = p_quotation_id,
        updated_at = NOW()
    WHERE id = v_so_id;

    UPDATE public.sales_order_items soi
    SET source_quotation_line_id = sqi.id,
        updated_at = NOW()
    FROM public.sales_quotation_items sqi
    WHERE soi.sales_order_id = v_so_id
      AND soi.tenant_id = v_tenant_id
      AND sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = v_tenant_id
      AND soi.item_id = sqi.item_id
      AND soi.variant_id IS NOT DISTINCT FROM sqi.variant_id
      AND soi.quantity_ordered = sqi.quantity_quoted;

    UPDATE public.sales_quotations
    SET converted_to_order_id = v_so_id,
        commercial_status = 'FULLY_COMPLETED'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    RETURN v_so_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_quotation_to_invoice(
    p_quotation_id UUID,
    p_origin_location_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_quote RECORD;
    v_invoice_id UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_quote
    FROM public.sales_quotations
    WHERE id = p_quotation_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales quotation not found';
    END IF;

    IF v_quote.converted_to_invoice_id IS NOT NULL THEN
        RETURN v_quote.converted_to_invoice_id;
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', sqi.item_id,
        'variant_id', sqi.variant_id,
        'quantity', sqi.quantity_quoted,
        'unit_price', sqi.unit_price_selling,
        'discount_percentage', sqi.discount_percentage,
        'discount_amount', sqi.discount_amount,
        'uom_code', sqi.uom_code,
        'tax_rate_percentage', sqi.tax_rate_percentage,
        'source_quotation_line_id', sqi.id
    )), '[]'::jsonb)
    INTO v_lines
    FROM public.sales_quotation_items sqi
    WHERE sqi.sales_quotation_id = p_quotation_id
      AND sqi.tenant_id = v_tenant_id;

    v_invoice_id := public.save_sales_invoice(
        NULL,
        v_quote.customer_id,
        COALESCE(p_origin_location_id, v_quote.origin_location_id),
        v_lines,
        v_user_id,
        v_quote.billing_state,
        v_quote.shipping_state,
        NULL,
        p_quotation_id,
        v_quote.payment_terms_days,
        v_quote.custom_fields,
        v_quote.currency_code,
        v_quote.exchange_rate,
        v_quote.prices_tax_inclusive,
        v_quote.shipping_amount,
        v_quote.shipping_tax_rate_pct,
        v_quote.round_off_amount,
        v_quote.additional_charges_amount,
        v_quote.transaction_discount_percentage,
        v_quote.transaction_discount_amount
    );

    UPDATE public.sales_quotations
    SET converted_to_invoice_id = v_invoice_id,
        commercial_status = 'FULLY_COMPLETED'::public.sales_document_status,
        updated_at = NOW()
    WHERE id = p_quotation_id;

    RETURN v_invoice_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_order_to_invoice(
    p_sales_order_id UUID,
    p_origin_location_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
    v_so RECORD;
    v_invoice_id UUID;
    v_lines JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := private.current_tenant_id();
    v_user_id := auth.uid();

    IF v_tenant_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    SELECT * INTO v_so
    FROM public.sales_orders
    WHERE id = p_sales_order_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales order not found';
    END IF;

    IF v_so.commercial_status NOT IN ('APPROVED_ACTIVE'::public.sales_document_status, 'PARTIALLY_SHIPPED'::public.sales_document_status) THEN
        RAISE EXCEPTION 'sales order must be confirmed before invoicing';
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', soi.item_id,
        'variant_id', soi.variant_id,
        'quantity', soi.quantity_ordered - soi.quantity_invoiced,
        'unit_price', soi.unit_price_selling,
        'discount_percentage', soi.discount_percentage,
        'discount_amount', soi.discount_amount,
        'uom_code', soi.uom_code,
        'tax_rate_percentage', soi.tax_rate_percentage,
        'source_order_line_id', soi.id
    )), '[]'::jsonb)
    INTO v_lines
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = p_sales_order_id
      AND soi.tenant_id = v_tenant_id
      AND soi.quantity_ordered > soi.quantity_invoiced;

    IF jsonb_array_length(v_lines) = 0 THEN
        RAISE EXCEPTION 'no uninvoiced lines remain on this sales order';
    END IF;

    v_invoice_id := public.save_sales_invoice(
        NULL,
        v_so.customer_id,
        p_origin_location_id,
        v_lines,
        v_user_id,
        v_so.billing_state,
        v_so.shipping_state,
        p_sales_order_id,
        v_so.source_quotation_id,
        v_so.payment_terms_days,
        v_so.custom_fields,
        v_so.currency_code,
        v_so.exchange_rate,
        v_so.prices_tax_inclusive,
        v_so.shipping_amount,
        v_so.shipping_tax_rate_pct,
        v_so.round_off_amount,
        v_so.additional_charges_amount,
        v_so.transaction_discount_percentage,
        v_so.transaction_discount_amount
    );

    RETURN v_invoice_id;
END;
$$;

-- --------------------------------------------------------------------
-- 13. Customer payment RPCs
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_customer_payment(
    p_customer_id UUID,
    p_amount_received NUMERIC,
    p_payment_method public.gateway_provider_type,
    p_created_by UUID,
    p_reference_number TEXT DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC DEFAULT NULL,
    p_received_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_payment_id UUID;
    v_payment_number TEXT;
    v_currency_code VARCHAR(3);
    v_exchange_rate NUMERIC(15, 6) := GREATEST(COALESCE(p_exchange_rate, 1), 0.000001);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'customer payment permission required';
    END IF;

    IF p_customer_id IS NULL OR p_created_by IS NULL THEN
        RAISE EXCEPTION 'customer_id and created_by are required';
    END IF;

    IF p_amount_received IS NULL OR p_amount_received <= 0 THEN
        RAISE EXCEPTION 'amount_received must be greater than zero';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.entities
        WHERE id = p_customer_id AND tenant_id = v_tenant_id AND is_active = TRUE
          AND type IN ('CUSTOMER'::public.entity_commercial_type, 'MUTUAL_PARTNER'::public.entity_commercial_type)
    ) THEN
        RAISE EXCEPTION 'customer not found';
    END IF;

    SELECT upper(btrim(COALESCE(
        p_currency_code,
        (SELECT t.base_currency FROM public.tenants t WHERE t.id = v_tenant_id),
        'INR'
    ))) INTO v_currency_code;

    v_payment_number := public.generate_next_voucher_string(
        v_tenant_id, 'CUSTOMER_PAYMENT'::public.document_voucher_type, NULL, NULL
    );

    INSERT INTO public.customer_payments (
        tenant_id, customer_id, payment_number, amount_received,
        payment_method, currency_code, exchange_rate_at_receipt,
        reference_number, received_at, created_by
    )
    VALUES (
        v_tenant_id, p_customer_id, v_payment_number, p_amount_received,
        p_payment_method, v_currency_code, v_exchange_rate,
        p_reference_number, COALESCE(p_received_at, NOW()), p_created_by
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_customer_payment_to_invoice(
    p_payment_id UUID,
    p_invoice_id UUID,
    p_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_payment RECORD;
    v_invoice RECORD;
    v_applied_total NUMERIC(15, 4);
    v_application_id UUID;
    v_remaining_on_payment NUMERIC(15, 4);
    v_remaining_on_invoice NUMERIC(15, 4);
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant context missing from session';
    END IF;

    IF NOT private.can_edit_sales_orders() THEN
        RAISE EXCEPTION 'customer payment application permission required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'amount must be greater than zero';
    END IF;

    SELECT * INTO v_payment
    FROM public.customer_payments
    WHERE id = p_payment_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'customer payment not found';
    END IF;

    SELECT * INTO v_invoice
    FROM public.sales_invoices
    WHERE id = p_invoice_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'sales invoice not found';
    END IF;

    IF v_invoice.commercial_status <> 'APPROVED_ACTIVE'::public.sales_document_status THEN
        RAISE EXCEPTION 'only posted sales invoices can receive payment applications';
    END IF;

    IF v_payment.customer_id <> v_invoice.customer_id THEN
        RAISE EXCEPTION 'payment and invoice must belong to the same customer';
    END IF;

    SELECT COALESCE(SUM(pa.amount_applied), 0)
    INTO v_applied_total
    FROM public.payment_applications pa
    WHERE pa.customer_payment_id = p_payment_id
      AND pa.tenant_id = v_tenant_id;

    v_remaining_on_payment := v_payment.amount_received - v_applied_total;
    v_remaining_on_invoice := v_invoice.total_net_amount - v_invoice.total_paid_amount;

    IF p_amount > v_remaining_on_payment THEN
        RAISE EXCEPTION 'amount exceeds unapplied payment balance';
    END IF;

    IF p_amount > v_remaining_on_invoice THEN
        RAISE EXCEPTION 'amount exceeds outstanding invoice balance';
    END IF;

    INSERT INTO public.payment_applications (
        tenant_id, customer_payment_id, sales_invoice_id, amount_applied
    )
    VALUES (
        v_tenant_id, p_payment_id, p_invoice_id, p_amount
    )
    RETURNING id INTO v_application_id;

    RETURN v_application_id;
END;
$$;

-- --------------------------------------------------------------------
-- 14. Grants
-- --------------------------------------------------------------------
REVOKE ALL ON FUNCTION private.can_edit_sales_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.can_edit_sales_orders() TO authenticated;

REVOKE ALL ON FUNCTION public.save_sales_order(UUID, UUID, JSONB, UUID, TEXT, TEXT, UUID, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_sales_order(UUID, UUID, JSONB, UUID, TEXT, TEXT, UUID, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.save_sales_quotation(UUID, UUID, JSONB, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_sales_quotation(UUID, UUID, JSONB, UUID, TEXT, TEXT, TIMESTAMPTZ, UUID, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.save_sales_invoice(UUID, UUID, UUID, JSONB, UUID, TEXT, TEXT, UUID, UUID, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_sales_invoice(UUID, UUID, UUID, JSONB, UUID, TEXT, TEXT, UUID, UUID, INTEGER, JSONB, VARCHAR, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.confirm_sales_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_sales_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.post_sales_invoice(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_sales_invoice(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.convert_quotation_to_order(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_quotation_to_order(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.convert_quotation_to_invoice(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_quotation_to_invoice(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.convert_order_to_invoice(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.convert_order_to_invoice(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.save_customer_payment(UUID, NUMERIC, public.gateway_provider_type, UUID, TEXT, VARCHAR, NUMERIC, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_customer_payment(UUID, NUMERIC, public.gateway_provider_type, UUID, TEXT, VARCHAR, NUMERIC, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.apply_customer_payment_to_invoice(UUID, UUID, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_customer_payment_to_invoice(UUID, UUID, NUMERIC) TO authenticated;
