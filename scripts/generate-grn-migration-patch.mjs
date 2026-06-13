import fs from "fs";

const text = fs.readFileSync("supabase/migrations/20260620200000_procurement_promo_engine.sql", "utf8");
const start = text.indexOf("CREATE OR REPLACE FUNCTION public.post_goods_receipt(");
const end = text.indexOf(
  "REVOKE ALL ON FUNCTION public.post_goods_receipt(UUID, UUID, JSONB, UUID, TEXT, DATE, VARCHAR, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB)",
  start
);
let fn = text.slice(start, end).replace(/\r\n/g, "\n");

fn = fn.replace(
  "    v_restate_total NUMERIC(15, 4) := 0;\nBEGIN",
  `    v_restate_total NUMERIC(15, 4) := 0;
    v_qty_accepted NUMERIC(15, 4);
    v_qty_rejected NUMERIC(15, 4);
    v_route_to_qc BOOLEAN;
    v_allow_qc_override BOOLEAN;
    v_any_qc_line BOOLEAN := FALSE;
    v_line_override BOOLEAN;
    v_has_override_key BOOLEAN;
BEGIN`
);

fn = fn.replace(
  "    v_qc_required := private.get_procurement_control_flag(v_tenant_id, 'is_qc_required_before_stocking');",
  `    v_qc_required := private.get_procurement_control_flag(v_tenant_id, 'is_qc_required_before_stocking');
    v_allow_qc_override := private.get_procurement_control_flag(v_tenant_id, 'allow_qc_line_override');`
);

fn = fn.replace("        v_qc_required,", "        FALSE,");

const lineLoopOld = `        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'invalid receipt line';
        END IF;

        IF v_unit_cost <= 0`;

const lineLoopNew = `        v_qty := NULLIF(v_entry ->> 'quantity_received', '')::NUMERIC;
        v_qty_accepted := COALESCE(NULLIF(v_entry ->> 'quantity_accepted', '')::NUMERIC, v_qty);
        v_qty_rejected := COALESCE(NULLIF(v_entry ->> 'quantity_rejected', '')::NUMERIC, 0);
        v_unit_cost := COALESCE(NULLIF(v_entry ->> 'raw_unit_cost', '')::NUMERIC, 0);
        v_is_promotional := COALESCE((v_entry ->> 'is_promotional')::BOOLEAN, FALSE);

        IF v_variant_id IS NULL OR v_qty IS NULL OR v_qty <= 0 THEN
            RAISE EXCEPTION 'invalid receipt line';
        END IF;

        IF v_qty_accepted < 0 OR v_qty_rejected < 0 THEN
            RAISE EXCEPTION 'accepted and rejected quantities must be zero or greater';
        END IF;

        IF ABS((v_qty_accepted + v_qty_rejected) - v_qty) > 0.0001 THEN
            RAISE EXCEPTION 'accepted plus rejected must equal quantity received';
        END IF;

        IF v_unit_cost <= 0`;

if (!fn.includes(lineLoopOld)) {
  console.error("line loop old not found");
  process.exit(1);
}
fn = fn.replace(lineLoopOld, lineLoopNew);

const routeAnchor = `            IF v_qty > v_open_qty THEN RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity'; END IF;
        END IF;

        v_line_value := v_qty * GREATEST(v_unit_cost, 0);`;

const routeReplacement = `            IF v_qty > v_open_qty THEN RAISE EXCEPTION 'quantity_received exceeds open purchase order quantity'; END IF;
        END IF;

        v_has_override_key := (v_entry ? 'route_to_qc');
        v_line_override := COALESCE((v_entry ->> 'route_to_qc')::BOOLEAN, FALSE);
        v_route_to_qc := private.resolve_grn_line_route_to_qc(
            v_tenant_id,
            v_item_id,
            v_line_override,
            v_has_override_key AND v_allow_qc_override
        );
        IF v_is_promotional OR v_qty_accepted <= 0 THEN
            v_route_to_qc := FALSE;
        END IF;
        IF v_route_to_qc THEN
            v_any_qc_line := TRUE;
        END IF;

        v_line_value := v_qty * GREATEST(v_unit_cost, 0);`;

if (!fn.includes(routeAnchor)) {
  console.error("route anchor not found");
  process.exit(1);
}
fn = fn.replace(routeAnchor, routeReplacement);

fn = fn.replace(
  `            is_promotional, linked_parent_line_id, entitlement_id
        ) VALUES (
            v_tenant_id, v_gr_id, v_po_item_id, v_item_id, v_variant_id,
            v_qty, v_qty, 0,`,
  `            is_promotional, linked_parent_line_id, entitlement_id, route_to_qc
        ) VALUES (
            v_tenant_id, v_gr_id, v_po_item_id, v_item_id, v_variant_id,
            v_qty, v_qty_accepted, v_qty_rejected,`
);

fn = fn.replace(
  `            CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po_item.linked_parent_line_id ELSE NULLIF(v_entry ->> 'linked_parent_line_id', '')::UUID END,
            v_entitlement_id
        ) RETURNING id INTO v_gr_item_id;`,
  `            CASE WHEN p_purchase_order_id IS NOT NULL THEN v_po_item.linked_parent_line_id ELSE NULLIF(v_entry ->> 'linked_parent_line_id', '')::UUID END,
            v_entitlement_id,
            v_route_to_qc
        ) RETURNING id INTO v_gr_item_id;`
);

fn = fn.replace(
  "    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid receipt lines were posted'; END IF;",
  `    IF v_line_count = 0 THEN RAISE EXCEPTION 'no valid receipt lines were posted'; END IF;

    UPDATE public.goods_receipts
    SET is_qc_pending = v_any_qc_line,
        updated_at = NOW()
    WHERE id = v_gr_id;`
);

fn = fn.replace(
  "    IF v_qc_required THEN\n        v_steps := private.append_posting_step(v_steps, 'grn_qc_quarantine_applied', 'success', NULL);",
  "    IF v_any_qc_line THEN\n        v_steps := private.append_posting_step(v_steps, 'grn_qc_quarantine_applied', 'success', NULL);"
);

fs.writeFileSync("supabase/migrations/_generated_post_goods_receipt.sql", fn);
console.log("written", fn.length);
