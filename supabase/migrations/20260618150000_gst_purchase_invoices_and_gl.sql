-- ====================================================================
-- Purchase invoices, input tax GL (import + domestic + RCM)
-- Migration: 20260618150000_gst_purchase_invoices_and_gl.sql
-- ====================================================================

CREATE OR REPLACE FUNCTION public.save_purchase_invoice(
    p_purchase_invoice_id UUID,
    p_supplier_id UUID,
    p_billing_location_id UUID,
    p_invoice_number_vendor TEXT,
    p_lines JSONB,
    p_created_by UUID,
    p_purchase_order_id UUID DEFAULT NULL,
    p_currency_code VARCHAR(3) DEFAULT NULL,
    p_exchange_rate NUMERIC(15, 6) DEFAULT NULL,
    p_bill_of_entry_number TEXT DEFAULT NULL,
    p_bill_of_entry_date DATE DEFAULT NULL,
    p_port_code VARCHAR(10) DEFAULT NULL,
    p_custom_fields JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_tenant_id UUID;
    v_tenant_country TEXT;
    v_supplier RECORD;
    v_location RECORD;
    v_po RECORD;
    v_gst_ctx RECORD;
    v_invoice_id UUID;
    v_voucher TEXT;
    v_entry JSONB;
    v_item_id UUID;
    v_variant_id UUID;
    v_po_item_id UUID;
    v_qty NUMERIC(15, 4);
    v_unit_price NUMERIC(15, 4);
    v_line_gross NUMERIC(15, 4);
    v_line_tax NUMERIC(15, 4);
    v_tax_rate NUMERIC(15, 4);
    v_tax_components JSONB;
    v_total_gross NUMERIC(15, 4) := 0;
    v_total_tax NUMERIC(15, 4) := 0;
    v_supply_nature TEXT;
    v_mechanism public.gst_tax_mechanism;
BEGIN
    v_tenant_id := private.current_tenant_id();
    IF v_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant context missing from session'; END IF;
    IF p_supplier_id IS NULL OR p_billing_location_id IS NULL THEN RAISE EXCEPTION 'supplier and billing location are required'; END IF;
    IF p_invoice_number_vendor IS NULL OR btrim(p_invoice_number_vendor) = '' THEN RAISE EXCEPTION 'vendor invoice number is required'; END IF;
    IF p_lines IS NULL OR jsonb_array_length(p_lines) = 0 THEN RAISE EXCEPTION 'at least one bill line is required'; END IF;

    SELECT upper(btrim(COALESCE(country_code, 'IN'))) INTO v_tenant_country FROM public.tenants WHERE id = v_tenant_id;

    SELECT id, type, tax_treatment, billing_country_code, billing_state
    INTO v_supplier FROM public.entities
    WHERE id = p_supplier_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'supplier not found'; END IF;

    SELECT id, state INTO v_location FROM public.tenant_locations
    WHERE id = p_billing_location_id AND tenant_id = v_tenant_id AND is_active = TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'billing location not found'; END IF;

    IF p_purchase_order_id IS NOT NULL THEN
        SELECT tax_supply_nature, tax_mechanism, supplier_tax_treatment, supplier_country_code
        INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        v_supply_nature := v_po.tax_supply_nature;
        v_mechanism := v_po.tax_mechanism;
    ELSE
        SELECT * INTO v_gst_ctx FROM private.gst_resolve_supply_context(
            v_tenant_country, v_supplier.tax_treatment, v_supplier.billing_country_code,
            v_supplier.billing_state, v_location.state, 'PURCHASE', 'GOODS'
        ) LIMIT 1;
        v_supply_nature := v_gst_ctx.supply_nature;
        v_mechanism := v_gst_ctx.tax_mechanism;
    END IF;

    IF p_purchase_invoice_id IS NOT NULL THEN
        SELECT id INTO v_invoice_id FROM public.purchase_invoices
        WHERE id = p_purchase_invoice_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase invoice not found'; END IF;
        DELETE FROM public.purchase_invoice_items
        WHERE purchase_invoice_id = p_purchase_invoice_id AND tenant_id = v_tenant_id;
    ELSE
        v_voucher := public.generate_next_voucher_string(
            v_tenant_id, 'PURCHASE_INVOICE'::public.document_voucher_type, NULL, p_billing_location_id
        );
        INSERT INTO public.purchase_invoices (
            tenant_id, supplier_id, purchase_order_id, invoice_number_vendor, system_voucher_number,
            tax_treatment, tax_supply_nature, tax_mechanism,
            supplier_tax_treatment, supplier_country_code,
            billing_location_id, currency_code, exchange_rate,
            bill_of_entry_number, bill_of_entry_date, port_code,
            place_of_supply, rcm_applicable, custom_fields, created_by
        ) VALUES (
            v_tenant_id, p_supplier_id, p_purchase_order_id, btrim(p_invoice_number_vendor), v_voucher,
            v_supplier.tax_treatment, v_supply_nature, v_mechanism,
            v_supplier.tax_treatment, upper(btrim(v_supplier.billing_country_code)),
            p_billing_location_id,
            upper(btrim(COALESCE(p_currency_code, (SELECT base_currency FROM public.tenants WHERE id = v_tenant_id), 'INR'))),
            GREATEST(COALESCE(p_exchange_rate, 1), 0.000001),
            NULLIF(btrim(p_bill_of_entry_number), ''), p_bill_of_entry_date, NULLIF(btrim(p_port_code), ''),
            v_location.state,
            (v_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism),
            COALESCE(p_custom_fields, '{}'::jsonb), p_created_by
        ) RETURNING id INTO v_invoice_id;
    END IF;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_variant_id := NULLIF(v_entry ->> 'variant_id', '')::UUID;
        v_po_item_id := NULLIF(v_entry ->> 'purchase_order_item_id', '')::UUID;
        v_qty := NULLIF(v_entry ->> 'quantity_billed', '')::NUMERIC;
        v_unit_price := COALESCE(NULLIF(v_entry ->> 'unit_price_billed', '')::NUMERIC, 0);
        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'invalid bill line'; END IF;

        SELECT iv.item_id INTO v_item_id FROM public.item_variants iv
        WHERE iv.id = v_variant_id AND iv.tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'variant not found'; END IF;

        SELECT rate, tax_amount, taxable_base, tax_components
        INTO v_tax_rate, v_line_tax, v_line_gross, v_tax_components
        FROM private.resolve_line_tax(
            v_item_id, v_qty, v_unit_price, 0, FALSE, v_supply_nature, v_mechanism
        ) LIMIT 1;

        v_total_gross := v_total_gross + COALESCE(v_line_gross, v_qty * v_unit_price);
        v_total_tax := v_total_tax + COALESCE(v_line_tax, 0);

        INSERT INTO public.purchase_invoice_items (
            tenant_id, purchase_invoice_id, item_id, variant_id,
            purchase_order_item_id, quantity_billed, unit_price_billed,
            line_tax_computed, tax_components_json, reverse_charge
        ) VALUES (
            v_tenant_id, v_invoice_id, v_item_id, v_variant_id,
            v_po_item_id, v_qty, v_unit_price,
            COALESCE(v_line_tax, 0), COALESCE(v_tax_components, '[]'::jsonb),
            (v_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism)
        );
    END LOOP;

    UPDATE public.purchase_invoices SET
        total_gross_amount = v_total_gross,
        total_tax_amount = v_total_tax,
        total_liability_amount = v_total_gross + v_total_tax,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN v_invoice_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_purchase_invoice(UUID, UUID, UUID, TEXT, JSONB, UUID, UUID, VARCHAR, NUMERIC, TEXT, DATE, VARCHAR, JSONB) TO authenticated;

-- Input tax GL on purchase invoice insert
CREATE OR REPLACE FUNCTION public.purchase_invoices_post_input_tax()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_header_id UUID;
    v_voucher TEXT;
    v_half_tax NUMERIC(15, 4);
    v_components JSONB;
    v_cgst NUMERIC(15, 4) := 0;
    v_sgst NUMERIC(15, 4) := 0;
    v_igst NUMERIC(15, 4) := 0;
    v_entry JSONB;
BEGIN
    IF NEW.total_tax_amount <= 0 THEN RETURN NEW; END IF;

    v_voucher := 'GL-AP-TAX-' || NEW.system_voucher_number;
    v_header_id := private.create_gl_voucher(
        NEW.tenant_id, v_voucher, NOW(), 'PURCHASE_INVOICE', NEW.id,
        'Input tax on purchase invoice ' || NEW.invoice_number_vendor
    );

    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2100-AP', NEW.total_liability_amount, 0.0000);

    IF NEW.tax_mechanism = 'IMPORT_IGST'::public.gst_tax_mechanism THEN
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1380-INPUT-IGST', NEW.total_tax_amount, 0.0000);
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2120-IMPORT-IGST-PAYABLE', 0.0000, NEW.total_tax_amount);
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2100-AP', 0.0000, NEW.total_gross_amount);
        RETURN NEW;
    END IF;

    IF NEW.tax_mechanism = 'REVERSE_CHARGE'::public.gst_tax_mechanism THEN
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1380-INPUT-IGST', NEW.total_tax_amount, 0.0000);
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2115-RCM-LIABILITY', 0.0000, NEW.total_tax_amount);
        PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2100-AP', 0.0000, NEW.total_gross_amount);
        RETURN NEW;
    END IF;

    SELECT COALESCE(jsonb_agg(pii.tax_components_json), '[]'::jsonb)
    INTO v_components
    FROM public.purchase_invoice_items pii
    WHERE pii.purchase_invoice_id = NEW.id AND pii.tenant_id = NEW.tenant_id;

    FOR v_entry IN SELECT value FROM jsonb_array_elements(v_components)
    LOOP
        IF upper(v_entry ->> 'name') LIKE 'CGST%' THEN
            v_cgst := v_cgst + COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
        ELSIF upper(v_entry ->> 'name') LIKE 'SGST%' THEN
            v_sgst := v_sgst + COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
        ELSIF upper(v_entry ->> 'name') LIKE 'IGST%' THEN
            v_igst := v_igst + COALESCE((v_entry ->> 'amount')::NUMERIC, 0);
        END IF;
    END LOOP;

    IF v_cgst + v_sgst + v_igst = 0 THEN
        IF NEW.tax_supply_nature = 'INTRASTATE' THEN
            v_half_tax := NEW.total_tax_amount / 2;
            v_cgst := v_half_tax;
            v_sgst := NEW.total_tax_amount - v_half_tax;
        ELSE
            v_igst := NEW.total_tax_amount;
        END IF;
    END IF;

    IF v_cgst > 0 THEN PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1381-INPUT-CGST', v_cgst, 0.0000); END IF;
    IF v_sgst > 0 THEN PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1382-INPUT-SGST', v_sgst, 0.0000); END IF;
    IF v_igst > 0 THEN PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1380-INPUT-IGST', v_igst, 0.0000); END IF;
    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '2100-AP', 0.0000, NEW.total_gross_amount);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS purchase_invoices_post_input_tax ON public.purchase_invoices;
CREATE TRIGGER purchase_invoices_post_input_tax
    AFTER INSERT ON public.purchase_invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.purchase_invoices_post_input_tax();

-- Capitalize import IGST into inventory on GRN when import goods
CREATE OR REPLACE FUNCTION public.goods_receipts_post_import_igst_capitalization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
    v_header_id UUID;
    v_import_igst NUMERIC(15, 4);
BEGIN
    IF NEW.tax_supply_nature IS DISTINCT FROM 'IMPORT_GOODS' THEN RETURN NEW; END IF;
    v_import_igst := COALESCE(NEW.import_igst_amount, 0);
    IF v_import_igst <= 0 THEN RETURN NEW; END IF;

    v_header_id := private.create_gl_voucher(
        NEW.tenant_id,
        'GL-GRN-IGST-' || NEW.voucher_number,
        NOW(),
        'GOODS_RECEIPT_NOTE',
        NEW.id,
        'Capitalize import IGST for GRN ' || NEW.voucher_number
    );

    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1400-INVENTORY', v_import_igst, 0.0000);
    PERFORM private.post_gl_line(NEW.tenant_id, v_header_id, '1380-INPUT-IGST', 0.0000, v_import_igst);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goods_receipts_post_import_igst_capitalization ON public.goods_receipts;
CREATE TRIGGER goods_receipts_post_import_igst_capitalization
    AFTER INSERT ON public.goods_receipts
    FOR EACH ROW
    EXECUTE FUNCTION public.goods_receipts_post_import_igst_capitalization();
