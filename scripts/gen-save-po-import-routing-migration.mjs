import fs from "fs";

const src = fs.readFileSync(
  "supabase/migrations/20260620200000_procurement_promo_engine.sql",
  "utf8"
);
const start = src.indexOf("CREATE OR REPLACE FUNCTION public.save_purchase_order(");
const end = src.indexOf("$$;", start) + 3;
if (start < 0 || end < 3) {
  console.error("save_purchase_order not found");
  process.exit(1);
}

let fn = src.slice(start, end);

fn = fn.replace(
  /p_transaction_discount_type TEXT DEFAULT NULL\n\)/,
  `p_transaction_discount_type TEXT DEFAULT NULL,
    p_receipt_location_id UUID DEFAULT NULL,
    p_ultimate_destination_location_id UUID DEFAULT NULL,
    p_po_fulfillment_stage_override TEXT DEFAULT NULL
)`
);

fn = fn.replace(
  /v_existing_destination_id UUID;/,
  `v_existing_destination_id UUID;
    v_receipt_location_id UUID := p_receipt_location_id;
    v_ultimate_destination_location_id UUID := COALESCE(
        p_ultimate_destination_location_id,
        p_destination_location_id
    );
    v_po_fulfillment_stage_override TEXT := NULLIF(upper(btrim(COALESCE(p_po_fulfillment_stage_override, ''))), '');`
);

const validationBlock = `
    IF v_po_fulfillment_stage_override IS NOT NULL
       AND v_po_fulfillment_stage_override NOT IN ('COMMERCIAL', 'FINAL') THEN
        RAISE EXCEPTION 'po_fulfillment_stage_override must be COMMERCIAL or FINAL';
    END IF;

    IF v_receipt_location_id IS NOT NULL
       AND NOT private.user_can_access_po_destination(v_receipt_location_id) THEN
        RAISE EXCEPTION 'receipt location is outside your procurement scope';
    END IF;

    IF v_ultimate_destination_location_id IS NOT NULL
       AND NOT private.user_can_access_po_destination(v_ultimate_destination_location_id) THEN
        RAISE EXCEPTION 'ultimate destination location is outside your procurement scope';
    END IF;
`;

fn = fn.replace(
  /IF NOT private\.user_can_access_po_destination\(p_destination_location_id\) THEN\n        RAISE EXCEPTION 'destination location is outside your procurement scope';\n    END IF;/,
  `IF NOT private.user_can_access_po_destination(p_destination_location_id) THEN
        RAISE EXCEPTION 'destination location is outside your procurement scope';
    END IF;
${validationBlock}`
);

fn = fn.replace(
  /transaction_discount_type = v_txn_discount_type,\n            updated_at = NOW\(\)/,
  `transaction_discount_type = v_txn_discount_type,
            receipt_location_id = v_receipt_location_id,
            ultimate_destination_location_id = v_ultimate_destination_location_id,
            po_fulfillment_stage_override = v_po_fulfillment_stage_override,
            updated_at = NOW()`
);

fn = fn.replace(
  /transaction_discount_type,\n            created_by\n        \)/,
  `transaction_discount_type,
            receipt_location_id,
            ultimate_destination_location_id,
            po_fulfillment_stage_override,
            created_by
        )`
);

fn = fn.replace(
  /v_txn_discount_type,\n            p_created_by\n        \)/,
  `v_txn_discount_type,
            v_receipt_location_id,
            v_ultimate_destination_location_id,
            v_po_fulfillment_stage_override,
            p_created_by
        )`
);

const dropSig = `DROP FUNCTION IF EXISTS public.save_purchase_order(UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT);

`;

const out = `-- Patch save_purchase_order for import receipt routing fields.

${dropSig}${fn};

GRANT EXECUTE ON FUNCTION public.save_purchase_order(
    UUID, UUID, UUID, JSONB, UUID, INTEGER, JSONB, VARCHAR, BOOLEAN,
    NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, NUMERIC, NUMERIC, TEXT,
    UUID, UUID, TEXT
) TO authenticated;
`;

fs.writeFileSync(
  "supabase/migrations/20260802145000_save_purchase_order_import_routing.sql",
  out
);
console.log("Wrote save_purchase_order import routing migration");
