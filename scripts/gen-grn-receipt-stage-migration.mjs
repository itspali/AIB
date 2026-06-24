import fs from "fs";

const src = fs.readFileSync(
  "supabase/migrations/20260623150000_grn_promo_qc_routing.sql",
  "utf8"
);
const start = src.indexOf("CREATE OR REPLACE FUNCTION public.post_goods_receipt(");
const end = src.indexOf("$$;", start) + 3;
if (start < 0 || end < 3) {
  console.error("post_goods_receipt not found");
  process.exit(1);
}
let fn = src.slice(start, end) + "\n";
fn = fn.replace(
  /p_landed_charges JSONB DEFAULT '\[\]'::jsonb\r?\n\)/,
  `p_landed_charges JSONB DEFAULT '[]'::jsonb,
    p_receipt_stage TEXT DEFAULT 'FINAL',
    p_is_po_fulfilling BOOLEAN DEFAULT TRUE,
    p_parent_grn_id UUID DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL,
    p_staging_location_id UUID DEFAULT NULL
)`
);
fn = fn.replace(
  /INSERT INTO public\.goods_receipts \([\s\S]*?\) RETURNING id INTO v_gr_id;/,
  `INSERT INTO public.goods_receipts (
        tenant_id, destination_location_id, purchase_order_id, voucher_number, created_by,
        is_qc_pending,
        tax_supply_nature, tax_mechanism,
        bill_of_entry_number, bill_of_entry_date, port_code,
        exchange_rate, assessable_value, customs_duty_amount, import_igst_amount,
        receipt_stage, is_po_fulfilling, parent_grn_id, shipment_id, staging_location_id
    ) VALUES (
        v_tenant_id, p_destination_location_id, p_purchase_order_id, v_voucher_number, p_created_by,
        FALSE,
        CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po.tax_supply_nature ELSE NULL END,
        CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po.tax_mechanism ELSE NULL END,
        NULLIF(btrim(p_bill_of_entry_number), ''),
        p_bill_of_entry_date,
        NULLIF(btrim(p_port_code), ''),
        v_exchange_rate,
        GREATEST(COALESCE(p_assessable_value, 0), 0),
        v_customs_duty_header,
        v_import_igst_header,
        COALESCE(NULLIF(upper(btrim(p_receipt_stage)), ''), 'FINAL'),
        COALESCE(p_is_po_fulfilling, TRUE),
        p_parent_grn_id,
        p_shipment_id,
        p_staging_location_id
    ) RETURNING id INTO v_gr_id;`
);
fn = fn.replace(
  /IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN\n            UPDATE public\.purchase_order_items SET\n                quantity_received = quantity_received \+ v_qty, updated_at = NOW\(\)\n            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;/,
  `IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL AND COALESCE(p_is_po_fulfilling, TRUE) THEN
            UPDATE public.purchase_order_items SET
                quantity_received = quantity_received + v_qty, updated_at = NOW()
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;`
);
fn = fn.replace(
  /    IF p_purchase_order_id IS NOT NULL THEN\n        INSERT INTO public\.purchase_order_grn_mappings/,
  `    IF p_purchase_order_id IS NOT NULL AND COALESCE(p_is_po_fulfilling, TRUE) THEN
        INSERT INTO public.purchase_order_grn_mappings`
);
fn = fn.replace(
  /    ELSE\n        v_steps := private\.append_posting_step\(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL\);\n    END IF;\n\n    INSERT INTO public\.document_posting_runs/,
  `    ELSIF p_purchase_order_id IS NOT NULL THEN
        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'skipped', 'non-PO-fulfilling receipt');
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL);
    END IF;

    INSERT INTO public.document_posting_runs`
);

const header = `-- GRN receipt stage foundation + PO-fulfillment guard on post_goods_receipt

ALTER TABLE public.goods_receipts
    ADD COLUMN IF NOT EXISTS receipt_stage TEXT NOT NULL DEFAULT 'FINAL',
    ADD COLUMN IF NOT EXISTS is_po_fulfilling BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS parent_grn_id UUID REFERENCES public.goods_receipts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS shipment_id UUID,
    ADD COLUMN IF NOT EXISTS staging_location_id UUID REFERENCES public.tenant_locations(id) ON DELETE SET NULL;

ALTER TABLE public.goods_receipts
    DROP CONSTRAINT IF EXISTS goods_receipts_receipt_stage_chk;

ALTER TABLE public.goods_receipts
    ADD CONSTRAINT goods_receipts_receipt_stage_chk
    CHECK (receipt_stage IN ('COMMERCIAL', 'CUSTOMS', 'FINAL', 'GIT_CLEARANCE'));

DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB);

`;

const footer = `
REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID) TO authenticated;
`;

fs.writeFileSync(
  "supabase/migrations/20260802110000_grn_receipt_stage_foundation.sql",
  header + fn + footer
);
console.log("written");
