import fs from "fs";

const src = fs.readFileSync(
  "supabase/migrations/20260802110000_grn_receipt_stage_foundation.sql",
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
  /p_landed_charges JSONB DEFAULT '\[\]'::jsonb\n\)/,
  `p_landed_charges JSONB DEFAULT '[]'::jsonb,
    p_receipt_stage TEXT DEFAULT 'FINAL',
    p_is_po_fulfilling BOOLEAN DEFAULT TRUE,
    p_parent_grn_id UUID DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL,
    p_staging_location_id UUID DEFAULT NULL
)`
);

fn = fn.replace(
  /    v_alloc_unit NUMERIC\(15, 4\);\nBEGIN/,
  `    v_alloc_unit NUMERIC(15, 4);
    v_receipt_stage TEXT;
    v_allow_staging_mismatch BOOLEAN;
    v_require_boe_policy TEXT;
    v_receipt_strategy TEXT;
    v_po_fulfillment_stage TEXT;
    v_shipment_staging UUID;
    v_boe_required BOOLEAN;
    v_destination_allowed BOOLEAN := FALSE;
BEGIN`
);

fn = fn.replace(
  /    v_absorb_sunk := private\.get_procurement_control_flag\(v_tenant_id, 'absorb_sunk_logistics_overhead'\);\n\n    IF p_landed_charges/,
  `    v_absorb_sunk := private.get_procurement_control_flag(v_tenant_id, 'absorb_sunk_logistics_overhead');

    v_allow_staging_mismatch := private.get_import_logistics_control_flag(
        v_tenant_id, 'allow_staging_receipt_location_mismatch', FALSE
    );
    v_require_boe_policy := COALESCE(
        private.get_import_logistics_control_text(v_tenant_id, 'require_boe_on_first_receipt', 'ALWAYS'),
        'ALWAYS'
    );
    v_receipt_strategy := COALESCE(
        private.get_import_logistics_control_text(v_tenant_id, 'import_receipt_document_strategy', 'SINGLE_FINAL_ONLY'),
        'SINGLE_FINAL_ONLY'
    );
    v_receipt_stage := COALESCE(NULLIF(upper(btrim(p_receipt_stage)), ''), 'FINAL');

    IF v_receipt_strategy = 'SINGLE_FINAL_ONLY' AND v_receipt_stage <> 'FINAL' THEN
        RAISE EXCEPTION 'tenant import policy only allows FINAL receipt stage';
    END IF;

    IF p_landed_charges`
);

fn = fn.replace(
  /        IF v_po\.destination_location_id <> p_destination_location_id THEN\n            RAISE EXCEPTION 'destination location must match purchase order destination';\n        END IF;\n        IF v_po\.tax_supply_nature = 'IMPORT_GOODS' THEN\n            IF p_bill_of_entry_number IS NULL OR btrim\(p_bill_of_entry_number\) = '' THEN\n                RAISE EXCEPTION 'bill of entry number is required for import goods receipt';\n            END IF;\n            IF p_bill_of_entry_date IS NULL THEN\n                RAISE EXCEPTION 'bill of entry date is required for import goods receipt';\n            END IF;\n        END IF;/,
  `        v_po_fulfillment_stage := COALESCE(
            NULLIF(upper(btrim(v_po.po_fulfillment_stage_override)), ''),
            private.get_import_logistics_control_text(v_tenant_id, 'po_fulfillment_stage', 'COMMERCIAL'),
            'COMMERCIAL'
        );

        v_destination_allowed := (p_destination_location_id = v_po.destination_location_id);

        IF NOT v_destination_allowed AND v_po.receipt_location_id IS NOT NULL THEN
            v_destination_allowed := (p_destination_location_id = v_po.receipt_location_id);
        END IF;

        IF NOT v_destination_allowed AND v_po.ultimate_destination_location_id IS NOT NULL THEN
            v_destination_allowed := (p_destination_location_id = v_po.ultimate_destination_location_id);
        END IF;

        IF NOT v_destination_allowed AND p_staging_location_id IS NOT NULL THEN
            v_destination_allowed := (p_destination_location_id = p_staging_location_id);
        END IF;

        IF NOT v_destination_allowed AND v_allow_staging_mismatch THEN
            v_destination_allowed := TRUE;
        END IF;

        IF NOT v_destination_allowed THEN
            RAISE EXCEPTION 'destination location must match purchase order receipt or destination site';
        END IF;

        IF p_shipment_id IS NOT NULL AND to_regclass('public.import_shipments') IS NOT NULL THEN
            SELECT staging_location_id INTO v_shipment_staging
            FROM public.import_shipments
            WHERE id = p_shipment_id AND tenant_id = v_tenant_id;
            IF FOUND AND v_shipment_staging IS NOT NULL
               AND p_destination_location_id IS DISTINCT FROM v_shipment_staging
               AND NOT v_allow_staging_mismatch
               AND v_receipt_stage IN ('COMMERCIAL', 'CUSTOMS')
            THEN
                RAISE EXCEPTION 'destination must match shipment staging location';
            END IF;
        END IF;

        v_boe_required := FALSE;
        IF v_po.tax_supply_nature = 'IMPORT_GOODS' AND v_receipt_stage <> 'GIT_CLEARANCE' THEN
            IF v_receipt_stage = 'COMMERCIAL' THEN
                v_boe_required := v_require_boe_policy = 'ALWAYS'
                    AND NOT private.get_import_logistics_control_flag(
                        v_tenant_id, 'allow_commercial_receipt_before_customs', FALSE
                    );
            ELSIF v_receipt_stage = 'FINAL' THEN
                v_boe_required := v_require_boe_policy IN ('ALWAYS', 'ON_FINAL_RECEIPT_ONLY');
            ELSIF v_receipt_stage = 'CUSTOMS' THEN
                v_boe_required := v_require_boe_policy = 'ALWAYS';
            END IF;
        END IF;

        IF v_boe_required THEN
            IF p_bill_of_entry_number IS NULL OR btrim(p_bill_of_entry_number) = '' THEN
                RAISE EXCEPTION 'bill of entry number is required for import goods receipt';
            END IF;
            IF p_bill_of_entry_date IS NULL THEN
                RAISE EXCEPTION 'bill of entry date is required for import goods receipt';
            END IF;
        END IF;`
);

fn = fn.replace(
  /            v_open_qty := v_po_item\.quantity_ordered - v_po_item\.quantity_received;\n            IF v_qty > v_open_qty THEN RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity'; END IF;/,
  `            IF COALESCE(p_is_po_fulfilling, TRUE) THEN
                v_open_qty := v_po_item.quantity_ordered - v_po_item.quantity_received;
                IF v_qty > v_open_qty THEN
                    RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity';
                END IF;
            END IF;`
);

fn = fn.replace(
  /        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL THEN\n            UPDATE public\.purchase_order_items SET\n                quantity_received = quantity_received \+ v_qty, updated_at = NOW\(\)\n            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;/,
  `        IF p_purchase_order_id IS NOT NULL AND v_po_item_id IS NOT NULL AND COALESCE(p_is_po_fulfilling, TRUE) THEN
            UPDATE public.purchase_order_items SET
                quantity_received = quantity_received + v_qty, updated_at = NOW()
            WHERE id = v_po_item_id AND tenant_id = v_tenant_id;`
);

fn = fn.replace(
  /    IF p_purchase_order_id IS NOT NULL THEN\n        INSERT INTO public\.purchase_order_grn_mappings \(tenant_id, purchase_order_id, goods_receipt_id, mapped_by\)\n        VALUES \(v_tenant_id, p_purchase_order_id, v_gr_id, p_created_by\)\n        ON CONFLICT \(purchase_order_id, goods_receipt_id\) DO NOTHING;\n\n        UPDATE public\.purchase_orders po SET document_status = CASE/,
  `    IF p_purchase_order_id IS NOT NULL AND COALESCE(p_is_po_fulfilling, TRUE) THEN
        INSERT INTO public.purchase_order_grn_mappings (tenant_id, purchase_order_id, goods_receipt_id, mapped_by)
        VALUES (v_tenant_id, p_purchase_order_id, v_gr_id, p_created_by)
        ON CONFLICT (purchase_order_id, goods_receipt_id) DO NOTHING;

        UPDATE public.purchase_orders po SET document_status = CASE`
);

fn = fn.replace(
  /        v_steps := private\.append_posting_step\(v_steps, 'grn_po_fulfillment_updated', 'success', NULL\);\n    ELSE\n        v_steps := private\.append_posting_step\(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL\);\n    END IF;\n\n    INSERT INTO public\.document_posting_runs/,
  `        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'success', NULL);
    ELSIF p_purchase_order_id IS NOT NULL THEN
        INSERT INTO public.purchase_order_grn_mappings (tenant_id, purchase_order_id, goods_receipt_id, mapped_by)
        VALUES (v_tenant_id, p_purchase_order_id, v_gr_id, p_created_by)
        ON CONFLICT (purchase_order_id, goods_receipt_id) DO NOTHING;
        v_steps := private.append_posting_step(
            v_steps, 'grn_po_fulfillment_updated', 'skipped', 'non-PO-fulfilling receipt'
        );
    ELSE
        v_steps := private.append_posting_step(v_steps, 'grn_po_fulfillment_updated', 'skipped', NULL);
    END IF;

    INSERT INTO public.document_posting_runs`
);

const header = `-- Import logistics receipt choreography on post_goods_receipt

DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB);
DROP FUNCTION IF EXISTS public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID);

`;

const footer = `
REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TEXT, BOOLEAN, UUID, UUID, UUID) TO authenticated;
`;

fs.writeFileSync(
  "supabase/migrations/20260802150000_post_goods_receipt_import_choreography.sql",
  header + fn + footer
);
console.log("written 20260802150000_post_goods_receipt_import_choreography.sql");
