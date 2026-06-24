import fs from "fs";

const src = fs.readFileSync(
  "supabase/migrations/20260612210000_wave6_git_subcontract.sql",
  "utf8"
);
const start = src.indexOf("CREATE OR REPLACE FUNCTION public.post_goods_in_transit(");
const end = src.indexOf("$$;", start) + 3;
if (start < 0 || end < 3) {
  console.error("post_goods_in_transit not found");
  process.exit(1);
}
let fn = src.slice(start, end) + "\n";

fn = fn.replace(
  /p_notes TEXT DEFAULT NULL\n\)/,
  `p_notes TEXT DEFAULT NULL,
    p_shipment_id UUID DEFAULT NULL
)`
);

fn = fn.replace(
  /    v_line_count INTEGER := 0;\nBEGIN/,
  `    v_line_count INTEGER := 0;
    v_po public.purchase_orders%ROWTYPE;
BEGIN`
);

fn = fn.replace(
  /    IF p_purchase_order_id IS NOT NULL THEN\n        IF NOT EXISTS \(\n            SELECT 1 FROM public\.purchase_orders\n            WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id\n        \) THEN\n            RAISE EXCEPTION 'purchase order not found';\n        END IF;\n    END IF;\n\n    SELECT COALESCE\(/,
  `    IF p_purchase_order_id IS NOT NULL THEN
        SELECT * INTO v_po FROM public.purchase_orders
        WHERE id = p_purchase_order_id AND tenant_id = v_tenant_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'purchase order not found'; END IF;
        IF v_po.tax_supply_nature IS DISTINCT FROM 'IMPORT_GOODS'::public.tax_supply_nature THEN
            RAISE EXCEPTION 'goods in transit is only available for import purchase orders';
        END IF;
    ELSIF p_shipment_id IS NULL THEN
        RAISE EXCEPTION 'import GIT requires a purchase order or shipment reference';
    END IF;

    IF p_shipment_id IS NOT NULL AND to_regclass('public.import_shipments') IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.import_shipments
            WHERE id = p_shipment_id AND tenant_id = v_tenant_id
        ) THEN
            RAISE EXCEPTION 'import shipment not found';
        END IF;
    END IF;

    v_voucher_number := public.generate_next_voucher_string(
        v_tenant_id, 'GOODS_IN_TRANSIT'::public.document_voucher_type, NULL, p_git_holding_location_id
    );

    /* legacy seq removed */
    SELECT COALESCE(`
);

fn = fn.replace(
  /    v_voucher_number := public\.generate_next_voucher_string\([\s\S]*?SELECT COALESCE\(\n        MAX\(\n            CASE\n                WHEN voucher_number ~ '\^GIT-\[0-9\]\+\$'\n                THEN substring\(voucher_number from 5\)::INTEGER\n                ELSE NULL\n            END\n        \),\n        0\n    \) \+ 1\n    INTO v_next_seq\n    FROM public\.goods_in_transit_vouchers\n    WHERE tenant_id = v_tenant_id;\n\n    v_voucher_number := 'GIT-' \|\| lpad\(v_next_seq::TEXT, 5, '0'\);\n\n    INSERT INTO public\.goods_in_transit_vouchers \(\n        tenant_id, voucher_number, status,\n        source_location_id, git_holding_location_id, destination_location_id,\n        purchase_order_id, notes, created_by, posted_at\n    \)\n    VALUES \(\n        v_tenant_id, v_voucher_number, 'POSTED',\n        p_source_location_id, p_git_holding_location_id, NULL,\n        p_purchase_order_id, NULLIF\(btrim\(p_notes\), ''\), p_created_by, NOW\(\)\n    \)/,
  `    INSERT INTO public.goods_in_transit_vouchers (
        tenant_id, voucher_number, status,
        source_location_id, git_holding_location_id, destination_location_id,
        purchase_order_id, shipment_id, notes, created_by, posted_at
    )
    VALUES (
        v_tenant_id, v_voucher_number, 'POSTED',
        p_source_location_id, p_git_holding_location_id, NULL,
        p_purchase_order_id, p_shipment_id, NULLIF(btrim(p_notes), ''), p_created_by, NOW()
    )`
);

const header = `-- Import-only GIT posting guards + shipment linkage + location-scoped numbering

ALTER TYPE public.document_voucher_type ADD VALUE IF NOT EXISTS 'GOODS_IN_TRANSIT';

ALTER TABLE public.goods_in_transit_vouchers
    ADD COLUMN IF NOT EXISTS shipment_id UUID;

DROP FUNCTION IF EXISTS public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT);

`;

const footer = `
REVOKE ALL ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_goods_in_transit(UUID, UUID, JSONB, UUID, UUID, TEXT, UUID) TO authenticated;
`;

fs.writeFileSync(
  "supabase/migrations/20260802160000_git_shipment_import_guards.sql",
  header + fn + footer
);
console.log("written 20260802160000_git_shipment_import_guards.sql");
