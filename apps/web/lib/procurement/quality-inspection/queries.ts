import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildDocumentListPage,
  resolveDocumentListPaging,
  type DocumentListFetchOptions,
  type DocumentListPage,
} from "@/lib/documents/list-page";
import type {
  QcInspectionQueueRow,
  QcTestParameterDef,
  QcTestTemplate,
} from "@/lib/procurement/quality-inspection/types";

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return String(parsed);
}

function resolveJoin<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type QcQueueDbRow = {
  id: string;
  quantity_on_hand: number | string;
  goods_receipt_id: string;
  goods_receipt_item_id: string;
  item_id: string;
  variant_id: string | null;
  location_id: string;
  goods_receipt_items: {
    id: string;
    quantity_received: number | string;
    quantity_accepted: number | string;
    quantity_rejected: number | string;
    route_to_qc: boolean | null;
    is_promotional: boolean | null;
    items: { name: string } | { name: string }[] | null;
    item_variants: { sku: string } | { sku: string }[] | null;
    goods_receipts: {
      id: string;
      voucher_number: string;
      purchase_order_id: string | null;
      received_at: string;
      destination_location:
        | { id: string; name: string; code: string }
        | { id: string; name: string; code: string }[]
        | null;
      purchase_order:
        | { voucher_number: string }
        | { voucher_number: string }[]
        | null;
    } | {
      id: string;
      voucher_number: string;
      purchase_order_id: string | null;
      received_at: string;
      destination_location:
        | { id: string; name: string; code: string }
        | { id: string; name: string; code: string }[]
        | null;
      purchase_order:
        | { voucher_number: string }
        | { voucher_number: string }[]
        | null;
    }[];
  } | {
    id: string;
    quantity_received: number | string;
    quantity_accepted: number | string;
    quantity_rejected: number | string;
    route_to_qc: boolean | null;
    is_promotional: boolean | null;
    items: { name: string } | { name: string }[] | null;
    item_variants: { sku: string } | { sku: string }[] | null;
    goods_receipts: {
      id: string;
      voucher_number: string;
      purchase_order_id: string | null;
      received_at: string;
      destination_location:
        | { id: string; name: string; code: string }
        | { id: string; name: string; code: string }[]
        | null;
      purchase_order:
        | { voucher_number: string }
        | { voucher_number: string }[]
        | null;
    };
  } | null;
};

const QC_QUEUE_SELECT = `
  id,
  quantity_on_hand,
  goods_receipt_id,
  goods_receipt_item_id,
  item_id,
  variant_id,
  location_id,
  goods_receipt_items!inner (
    id,
    quantity_received,
    quantity_accepted,
    quantity_rejected,
    route_to_qc,
    is_promotional,
    items!goods_receipt_items_item_tenant_fk (name),
    item_variants!goods_receipt_items_variant_tenant_fk (sku),
    goods_receipts!inner (
      id,
      voucher_number,
      purchase_order_id,
      received_at,
      destination_location:tenant_locations!goods_receipts_location_tenant_fk (id, name, code),
      purchase_order:purchase_orders!goods_receipts_po_tenant_fk (voucher_number)
    )
  )
`;

function mapQcQueueRow(row: QcQueueDbRow): QcInspectionQueueRow | null {
  const line = resolveJoin(row.goods_receipt_items);
  if (!line) return null;
  const gr = resolveJoin(line.goods_receipts);
  if (!gr) return null;
  const item = resolveJoin(line.items);
  const variant = resolveJoin(line.item_variants);
  const location = resolveJoin(gr.destination_location);
  const po = resolveJoin(gr.purchase_order);

  return {
    id: row.goods_receipt_item_id,
    qc_balance_id: row.id,
    goods_receipt_id: row.goods_receipt_id,
    grn_number: gr.voucher_number,
    purchase_order_id: gr.purchase_order_id,
    purchase_order_number: po?.voucher_number ?? null,
    destination_location_id: location?.id ?? row.location_id,
    destination_location_name: location?.name ?? "—",
    destination_location_code: location?.code ?? "",
    item_id: row.item_id,
    item_name: item?.name ?? "—",
    variant_id: row.variant_id ?? "",
    variant_sku: variant?.sku ?? "—",
    quantity_on_hold: formatDecimal(row.quantity_on_hand),
    quantity_received: formatDecimal(line.quantity_received),
    quantity_accepted: formatDecimal(line.quantity_accepted),
    quantity_rejected: formatDecimal(line.quantity_rejected),
    route_to_qc: line.route_to_qc ?? false,
    is_promotional: line.is_promotional ?? false,
    received_at: gr.received_at,
  };
}

export type QcQueueFetchFilters = {
  locationId?: string | null;
};

export async function fetchQcInspectionQueuePage(
  supabase: SupabaseClient,
  tenantId: string,
  options?: DocumentListFetchOptions & QcQueueFetchFilters
): Promise<DocumentListPage<QcInspectionQueueRow>> {
  const { offset, limit } = resolveDocumentListPaging(options);

  let countQuery = supabase
    .from("qc_inventory_balances")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gt("quantity_on_hand", 0);

  let dataQuery = supabase
    .from("qc_inventory_balances")
    .select(QC_QUEUE_SELECT)
    .eq("tenant_id", tenantId)
    .gt("quantity_on_hand", 0)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (options?.locationId) {
    countQuery = countQuery.eq("location_id", options.locationId);
    dataQuery = dataQuery.eq("location_id", options.locationId);
  }

  const [{ count, error: countError }, { data, error }] = await Promise.all([
    countQuery,
    dataQuery,
  ]);

  if (countError) throw new Error(countError.message);
  if (error) throw new Error(error.message);

  const rows = (data ?? [])
    .map((row) => mapQcQueueRow(row as unknown as QcQueueDbRow))
    .filter((row): row is QcInspectionQueueRow => row != null);

  return buildDocumentListPage(rows, count ?? rows.length, offset, limit);
}

export async function fetchQcInspectionQueueRowByLineId(
  supabase: SupabaseClient,
  tenantId: string,
  goodsReceiptItemId: string
): Promise<QcInspectionQueueRow | null> {
  const { data, error } = await supabase
    .from("qc_inventory_balances")
    .select(QC_QUEUE_SELECT)
    .eq("tenant_id", tenantId)
    .eq("goods_receipt_item_id", goodsReceiptItemId)
    .gt("quantity_on_hand", 0)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapQcQueueRow(data as unknown as QcQueueDbRow);
}

function mapParameterRow(row: {
  id: string;
  name: string;
  parameter_type: string;
  min_value: number | string | null;
  max_value: number | string | null;
  expected_text: string | null;
  choice_options: unknown;
  is_mandatory: boolean;
  sort_order: number;
}): QcTestParameterDef {
  const choices = Array.isArray(row.choice_options)
    ? row.choice_options.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id: row.id,
    name: row.name,
    parameter_type: row.parameter_type as QcTestParameterDef["parameter_type"],
    min_value: row.min_value != null ? formatDecimal(row.min_value) : null,
    max_value: row.max_value != null ? formatDecimal(row.max_value) : null,
    expected_text: row.expected_text,
    choice_options: choices,
    is_mandatory: row.is_mandatory,
    sort_order: row.sort_order,
  };
}

export async function fetchQcTestTemplateForItem(
  supabase: SupabaseClient,
  tenantId: string,
  itemId: string
): Promise<QcTestTemplate | null> {
  const { data: itemRow, error: itemError } = await supabase
    .from("items")
    .select("id, category_id")
    .eq("tenant_id", tenantId)
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) throw new Error(itemError.message);
  if (!itemRow) return null;

  const { data: itemTemplate } = await supabase
    .from("qc_test_templates")
    .select("id, name, description, scope_type, scope_reference_id")
    .eq("tenant_id", tenantId)
    .eq("scope_type", "ITEM")
    .eq("scope_reference_id", itemId)
    .eq("is_active", true)
    .maybeSingle();

  let templateHeader = itemTemplate;

  if (!templateHeader && itemRow.category_id) {
    const { data: categories } = await supabase
      .from("item_categories")
      .select("id, parent_id")
      .eq("tenant_id", tenantId);

    const byId = new Map((categories ?? []).map((row) => [row.id as string, row.parent_id as string | null]));
    let currentId: string | null = itemRow.category_id as string;

    while (currentId && !templateHeader) {
      const { data: categoryTemplate } = await supabase
        .from("qc_test_templates")
        .select("id, name, description, scope_type, scope_reference_id")
        .eq("tenant_id", tenantId)
        .eq("scope_type", "CATEGORY")
        .eq("scope_reference_id", currentId)
        .eq("is_active", true)
        .maybeSingle();

      if (categoryTemplate) {
        templateHeader = categoryTemplate;
        break;
      }
      currentId = byId.get(currentId) ?? null;
    }
  }

  if (!templateHeader) return null;

  const { data: parameters, error: paramError } = await supabase
    .from("qc_test_parameters")
    .select(
      "id, name, parameter_type, min_value, max_value, expected_text, choice_options, is_mandatory, sort_order"
    )
    .eq("tenant_id", tenantId)
    .eq("template_id", templateHeader.id)
    .order("sort_order", { ascending: true });

  if (paramError) throw new Error(paramError.message);

  return {
    id: templateHeader.id,
    name: templateHeader.name,
    description: templateHeader.description,
    scope_type: templateHeader.scope_type as QcTestTemplate["scope_type"],
    scope_reference_id: templateHeader.scope_reference_id,
    parameters: (parameters ?? []).map(mapParameterRow),
  };
}
