-- ====================================================================
-- AIB SMART ERP - MILESTONE 8: FINANCIAL ACCOUNTING & LEDGER AUTOMATION
-- Migration: 20260527170000_create_financial_accounting_and_ledger_automation.sql
-- ====================================================================
--
-- --------------------------------------------------------------------
-- ARCHITECTURAL DOCUMENTATION (downstream developer alignment)
-- --------------------------------------------------------------------
--
-- FLEXIBLE TAX CODE REGISTRIES (tax_rate_registry):
--   Date-bound statutory components (CGST_9, SGST_9, IGST_18, etc.)
--   legal_compliance_code maps to HSN/SAC return grouping tokens.
--
-- ACCOUNTING PERIOD GATES (workspace_control_registry FINANCIAL_SETTINGS):
--   accounting_period_closing_date  -> blocks GL entry mutations on/before close
--   allow_manager_backposting     -> permits override when document_approvals exist
--
-- SHIPPING-STATE NEXUS TAX SPLIT (sales_invoices AFTER INSERT):
--   tax_treatment_applied = 'CGST_SGST' -> 50/50 credit to CGST + SGST liability
--   tax_treatment_applied = 'IGST'       -> full credit to IGST liability
--   Balancing debit to 1390-OUTPUT-TAX-RECEIVABLE
--
-- DOCUMENT-LEVEL EXCHANGE RATE SNAPSHOTS:
--   sales_invoices.exchange_rate_snapshot     -> rate stamped at invoice booking
--   customer_payments.exchange_rate_at_receipt -> rate at payment execution
--   currency_exchange_rates registry for daily spot + order-linked fixed contracts
--
-- REAL-TIME FOREX VARIANCE (payment_applications AFTER INSERT):
--   delta_rate = receipt_rate - invoice_rate
--   variance   = amount_applied * delta_rate / invoice_rate
--   Posts to 6900-FOREX-VARIANCE with AR/cash balancing line
--
-- COGS DOUBLE-ENTRY (sales_shipment_items AFTER INSERT):
--   Debit  5000-COGS
--   Credit 1400-INVENTORY
--   Amount = quantity_shipped * item_valuations.current_average_cost
--
-- STANDARD COA ACCOUNT CODES (tenant must seed accounts table):
--   5000-COGS, 1400-INVENTORY, 1200-AR, 1390-OUTPUT-TAX-RECEIVABLE,
--   2110-IGST-LIABILITY, 2111-CGST-LIABILITY, 2112-SGST-LIABILITY, 6900-FOREX-VARIANCE
--
-- ====================================================================

-- --------------------------------------------------------------------
-- 1. GLOBAL ENUMS
-- --------------------------------------------------------------------
ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'GENERAL_LEDGER';

CREATE TYPE account_type_class AS ENUM (
    'ASSET',
    'LIABILITY',
    'EQUITY',
    'REVENUE',
    'EXPENSE'
);

CREATE TYPE tax_split_type AS ENUM (
    'INTRA_STATE',
    'INTER_STATE',
    'EXEMPT_EXPORT'
);

-- --------------------------------------------------------------------
-- 2. DOCUMENT-LEVEL EXCHANGE RATE SNAPSHOTS (compliance ALTERs)
-- --------------------------------------------------------------------
ALTER TABLE public.sales_invoices
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE public.sales_invoices
    ADD COLUMN IF NOT EXISTS exchange_rate_snapshot NUMERIC(15, 6) NOT NULL DEFAULT 1.000000;

ALTER TABLE public.customer_payments
    ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'USD';

ALTER TABLE public.customer_payments
    ADD COLUMN IF NOT EXISTS exchange_rate_at_receipt NUMERIC(15, 6) NOT NULL DEFAULT 1.000000;

-- --------------------------------------------------------------------
-- 3. accounts — Unified Chart of Accounts
-- --------------------------------------------------------------------
CREATE TABLE public.accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    account_code    TEXT NOT NULL,
    account_name    TEXT NOT NULL,
    classification  account_type_class NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accounts_tenant_code_unique
        UNIQUE (tenant_id, account_code)
);

CREATE UNIQUE INDEX accounts_tenant_id_id_unique
    ON public.accounts (tenant_id, id);

-- --------------------------------------------------------------------
-- 4. tax_rate_registry
-- --------------------------------------------------------------------
CREATE TABLE public.tax_rate_registry (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    tax_component_name      TEXT NOT NULL,
    tax_percentage          NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    active_from_date        TIMESTAMPTZ NOT NULL,
    active_to_date          TIMESTAMPTZ,
    legal_compliance_code   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_rate_registry_tenant_component_from_unique
        UNIQUE (tenant_id, tax_component_name, active_from_date),
    CONSTRAINT tax_rate_registry_percentage_non_negative_chk
        CHECK (tax_percentage >= 0),
    CONSTRAINT tax_rate_registry_date_range_chk
        CHECK (active_to_date IS NULL OR active_to_date > active_from_date)
);

CREATE UNIQUE INDEX tax_rate_registry_tenant_id_id_unique
    ON public.tax_rate_registry (tenant_id, id);

-- --------------------------------------------------------------------
-- 5. currency_exchange_rates
-- --------------------------------------------------------------------
CREATE TABLE public.currency_exchange_rates (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id                   UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    from_currency               VARCHAR(3) NOT NULL,
    to_currency                 VARCHAR(3) NOT NULL,
    conversion_rate             NUMERIC(15, 6) NOT NULL,
    rate_timestamp              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_custom_contract_fixed    BOOLEAN NOT NULL DEFAULT FALSE,
    linked_sales_order_id       UUID REFERENCES public.sales_orders (id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT currency_exchange_rates_rate_positive_chk
        CHECK (conversion_rate > 0)
);

CREATE UNIQUE INDEX currency_exchange_rates_tenant_id_id_unique
    ON public.currency_exchange_rates (tenant_id, id);

ALTER TABLE public.currency_exchange_rates
    ADD CONSTRAINT currency_exchange_rates_order_tenant_fk
    FOREIGN KEY (tenant_id, linked_sales_order_id)
    REFERENCES public.sales_orders (tenant_id, id)
    ON DELETE SET NULL;

-- --------------------------------------------------------------------
-- 6. general_ledger_headers & general_ledger_entries
-- --------------------------------------------------------------------
CREATE TABLE public.general_ledger_headers (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    voucher_number          TEXT NOT NULL,
    posting_date            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_document_type    TEXT NOT NULL,
    source_document_id      UUID NOT NULL,
    narration               TEXT,
    is_manager_backpost     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT general_ledger_headers_tenant_voucher_unique
        UNIQUE (tenant_id, voucher_number)
);

CREATE UNIQUE INDEX general_ledger_headers_tenant_id_id_unique
    ON public.general_ledger_headers (tenant_id, id);

CREATE TABLE public.general_ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES public.tenants (id) ON DELETE RESTRICT,
    gl_header_id    UUID NOT NULL REFERENCES public.general_ledger_headers (id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES public.accounts (id) ON DELETE RESTRICT,
    debit_amount    NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    credit_amount   NUMERIC(15, 4) NOT NULL DEFAULT 0.0000,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT general_ledger_entries_balanced_line_chk
        CHECK (
            (debit_amount > 0 AND credit_amount = 0)
            OR (credit_amount > 0 AND debit_amount = 0)
        ),
    CONSTRAINT general_ledger_entries_amounts_non_negative_chk
        CHECK (debit_amount >= 0 AND credit_amount >= 0)
);

CREATE UNIQUE INDEX general_ledger_entries_tenant_id_id_unique
    ON public.general_ledger_entries (tenant_id, id);

ALTER TABLE public.general_ledger_entries
    ADD CONSTRAINT general_ledger_entries_header_tenant_fk
    FOREIGN KEY (tenant_id, gl_header_id)
    REFERENCES public.general_ledger_headers (tenant_id, id)
    ON DELETE CASCADE;

ALTER TABLE public.general_ledger_entries
    ADD CONSTRAINT general_ledger_entries_account_tenant_fk
    FOREIGN KEY (tenant_id, account_id)
    REFERENCES public.accounts (tenant_id, id)
    ON DELETE RESTRICT;

CREATE INDEX general_ledger_entries_header_idx
    ON public.general_ledger_entries (gl_header_id);

-- --------------------------------------------------------------------
-- 7. FINANCIAL CONTROL HELPERS
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.get_financial_setting_timestamptz(
    p_tenant_id UUID,
    p_flag_key TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_value TIMESTAMPTZ;
BEGIN
    SELECT (configuration_metadata ->> p_flag_key)::timestamptz
    INTO v_value
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = 'FINANCIAL_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION private.get_financial_control_flag(
    p_tenant_id UUID,
    p_flag_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_value BOOLEAN;
BEGIN
    SELECT (configuration_metadata ->> p_flag_key)::boolean
    INTO v_value
    FROM public.workspace_control_registry
    WHERE tenant_id = p_tenant_id
      AND scope_level = 'TENANT_GLOBAL'
      AND registry_key = 'FINANCIAL_SETTINGS'
      AND target_reference_id IS NULL
    ORDER BY updated_at DESC
    LIMIT 1;

    RETURN COALESCE(v_value, FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION private.resolve_account_id(
    p_tenant_id UUID,
    p_account_code TEXT
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_account_id UUID;
BEGIN
    SELECT id
    INTO v_account_id
    FROM public.accounts
    WHERE tenant_id = p_tenant_id
      AND account_code = p_account_code
      AND is_active = TRUE
    LIMIT 1;

    IF v_account_id IS NULL THEN
        RAISE EXCEPTION 'active account % not found for tenant %', p_account_code, p_tenant_id;
    END IF;

    RETURN v_account_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.create_gl_voucher(
    p_tenant_id UUID,
    p_voucher_number TEXT,
    p_posting_date TIMESTAMPTZ,
    p_source_document_type TEXT,
    p_source_document_id UUID,
    p_narration TEXT,
    p_is_manager_backpost BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_header_id UUID;
BEGIN
    INSERT INTO public.general_ledger_headers (
        tenant_id, voucher_number, posting_date,
        source_document_type, source_document_id, narration, is_manager_backpost
    )
    VALUES (
        p_tenant_id, p_voucher_number, p_posting_date,
        p_source_document_type, p_source_document_id, p_narration, p_is_manager_backpost
    )
    RETURNING id INTO v_header_id;

    RETURN v_header_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.post_gl_line(
    p_tenant_id UUID,
    p_gl_header_id UUID,
    p_account_code TEXT,
    p_debit NUMERIC(15, 4),
    p_credit NUMERIC(15, 4)
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
    INSERT INTO public.general_ledger_entries (
        tenant_id, gl_header_id, account_id, debit_amount, credit_amount
    )
    VALUES (
        p_tenant_id,
        p_gl_header_id,
        private.resolve_account_id(p_tenant_id, p_account_code),
        p_debit,
        p_credit
    );
END;
$$;

-- --------------------------------------------------------------------
-- 8. PERIOD LOCKOUT — BEFORE INSERT OR UPDATE OR DELETE on GL entries
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.general_ledger_entries_period_lockout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_header_id UUID;
    v_posting_date TIMESTAMPTZ;
    v_closing_date TIMESTAMPTZ;
    v_allow_backpost BOOLEAN;
    v_is_backpost BOOLEAN;
    v_has_approval BOOLEAN;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_tenant_id := OLD.tenant_id;
        v_header_id := OLD.gl_header_id;
    ELSE
        v_tenant_id := NEW.tenant_id;
        v_header_id := NEW.gl_header_id;
    END IF;

    SELECT posting_date, is_manager_backpost
    INTO v_posting_date, v_is_backpost
    FROM public.general_ledger_headers
    WHERE id = v_header_id;

    v_closing_date := private.get_financial_setting_timestamptz(
        v_tenant_id, 'accounting_period_closing_date'
    );

    IF v_closing_date IS NULL OR v_posting_date > v_closing_date THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    v_allow_backpost := private.get_financial_control_flag(
        v_tenant_id, 'allow_manager_backposting'
    );

    SELECT EXISTS (
        SELECT 1
        FROM public.document_approvals da
        WHERE da.tenant_id = v_tenant_id
          AND da.document_type IN ('GL_BACKPOST', 'GENERAL_LEDGER')
          AND da.document_id = v_header_id
    )
    INTO v_has_approval;

    IF v_allow_backpost AND (v_is_backpost OR v_has_approval) THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    RAISE EXCEPTION
        'accounting period locked: posting_date % is on or before closing_date %',
        v_posting_date, v_closing_date;
END;
$$;

CREATE TRIGGER general_ledger_entries_period_lockout
    BEFORE INSERT OR UPDATE OR DELETE ON public.general_ledger_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.general_ledger_entries_period_lockout();

-- --------------------------------------------------------------------
-- 9. TRIGGER 1 — Outbound COGS double-entry (sales_shipment_items)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_shipment_items_post_gl_cogs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_order_item public.sales_order_items%ROWTYPE;
    v_package public.sales_shipment_packages%ROWTYPE;
    v_shipment public.sales_shipments%ROWTYPE;
    v_unit_cost NUMERIC(15, 4);
    v_cogs_amount NUMERIC(15, 4);
    v_header_id UUID;
    v_voucher TEXT;
BEGIN
    SELECT *
    INTO v_order_item
    FROM public.sales_order_items
    WHERE id = NEW.sales_order_item_id;

    SELECT *
    INTO v_package
    FROM public.sales_shipment_packages
    WHERE id = NEW.sales_shipment_package_id;

    SELECT *
    INTO v_shipment
    FROM public.sales_shipments
    WHERE id = v_package.sales_shipment_id;

    v_unit_cost := private.get_item_average_cost(
        NEW.tenant_id,
        v_shipment.origin_location_id,
        v_order_item.item_id,
        v_order_item.variant_id
    );

    v_cogs_amount := NEW.quantity_shipped * v_unit_cost;

    IF v_cogs_amount <= 0 THEN
        RETURN NEW;
    END IF;

    v_voucher := 'GL-COGS-' || left(replace(NEW.id::text, '-', ''), 12);

    v_header_id := private.create_gl_voucher(
        NEW.tenant_id,
        v_voucher,
        NOW(),
        'SALES_SHIPMENT_ITEM',
        NEW.id,
        'COGS recognition for shipment ' || v_shipment.tracking_number
    );

    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '5000-COGS', v_cogs_amount, 0.0000);
    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1400-INVENTORY', 0.0000, v_cogs_amount);

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_shipment_items_post_gl_cogs
    AFTER INSERT ON public.sales_shipment_items
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_shipment_items_post_gl_cogs();

-- --------------------------------------------------------------------
-- 10. TRIGGER 2 — State nexus tax split (sales_invoices)
-- --------------------------------------------------------------------
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
    IF NEW.total_tax_amount <= 0 THEN
        RETURN NEW;
    END IF;

    v_voucher := 'GL-TAX-' || NEW.invoice_number;

    v_header_id := private.create_gl_voucher(
        NEW.tenant_id,
        v_voucher,
        NOW(),
        'SALES_INVOICE',
        NEW.id,
        'Output tax liability for invoice ' || NEW.invoice_number
    );

    PERFORM private.post_gl_line(
        NEW.tenant_id, v_header_id, '1390-OUTPUT-TAX-RECEIVABLE',
        NEW.total_tax_amount, 0.0000
    );

    IF NEW.tax_treatment_applied = 'CGST_SGST' THEN
        v_half_tax := NEW.total_tax_amount / 2.0000;

        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '2111-CGST-LIABILITY', 0.0000, v_half_tax
        );
        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '2112-SGST-LIABILITY', 0.0000,
            NEW.total_tax_amount - v_half_tax
        );
    ELSE
        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '2110-IGST-LIABILITY', 0.0000, NEW.total_tax_amount
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER sales_invoices_post_gl_tax_split
    AFTER INSERT ON public.sales_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.sales_invoices_post_gl_tax_split();

-- --------------------------------------------------------------------
-- 11. TRIGGER 3 — Realized forex variance (payment_applications)
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_applications_post_forex_variance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_invoice public.sales_invoices%ROWTYPE;
    v_payment public.customer_payments%ROWTYPE;
    v_invoice_rate NUMERIC(15, 6);
    v_payment_rate NUMERIC(15, 6);
    v_delta_rate NUMERIC(15, 6);
    v_variance NUMERIC(15, 4);
    v_header_id UUID;
    v_voucher TEXT;
BEGIN
    SELECT *
    INTO v_invoice
    FROM public.sales_invoices
    WHERE id = NEW.sales_invoice_id;

    SELECT cp.*
    INTO v_payment
    FROM public.customer_payments cp
    WHERE cp.id = NEW.customer_payment_id;

    v_invoice_rate := v_invoice.exchange_rate_snapshot;
    v_payment_rate := v_payment.exchange_rate_at_receipt;

    IF v_invoice_rate = v_payment_rate OR v_invoice_rate = 0 THEN
        RETURN NEW;
    END IF;

    v_delta_rate := v_payment_rate - v_invoice_rate;
    v_variance := NEW.amount_applied * v_delta_rate / v_invoice_rate;

    IF abs(v_variance) < 0.0001 THEN
        RETURN NEW;
    END IF;

    v_voucher := 'GL-FX-' || left(replace(NEW.id::text, '-', ''), 12);

    v_header_id := private.create_gl_voucher(
        NEW.tenant_id,
        v_voucher,
        NOW(),
        'PAYMENT_APPLICATION',
        NEW.id,
        'Forex variance on payment application to invoice ' || v_invoice.invoice_number
    );

    IF v_variance > 0 THEN
        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '6900-FOREX-VARIANCE', v_variance, 0.0000
        );
        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '1200-AR', 0.0000, v_variance
        );
    ELSE
        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '1200-AR', abs(v_variance), 0.0000
        );
        PERFORM private.post_gl_line(
            NEW.tenant_id, v_header_id, '6900-FOREX-VARIANCE', 0.0000, abs(v_variance)
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER payment_applications_post_forex_variance
    AFTER INSERT ON public.payment_applications
    FOR EACH ROW
    EXECUTE FUNCTION public.payment_applications_post_forex_variance();

-- --------------------------------------------------------------------
-- 12. updated_at TRIGGERS
-- --------------------------------------------------------------------
CREATE TRIGGER accounts_set_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tax_rate_registry_set_updated_at
    BEFORE UPDATE ON public.tax_rate_registry
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER general_ledger_headers_set_updated_at
    BEFORE UPDATE ON public.general_ledger_headers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- --------------------------------------------------------------------
-- 13. ROW-LEVEL SECURITY
-- --------------------------------------------------------------------
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rate_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_ledger_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY accounts_tenant_isolation
    ON public.accounts FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY tax_rate_registry_tenant_isolation
    ON public.tax_rate_registry FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY currency_exchange_rates_tenant_isolation
    ON public.currency_exchange_rates FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY general_ledger_headers_tenant_isolation
    ON public.general_ledger_headers FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

CREATE POLICY general_ledger_entries_tenant_isolation
    ON public.general_ledger_entries FOR ALL TO authenticated
    USING (tenant_id = private.current_tenant_id())
    WITH CHECK (tenant_id = private.current_tenant_id());

-- --------------------------------------------------------------------
-- 14. GRANTS
-- --------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION private.get_financial_setting_timestamptz(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_financial_control_flag(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION private.resolve_account_id(UUID, TEXT) TO authenticated;
