import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveProductMediaSignedUrls } from "@/lib/products/media";
import { pickPrimaryImageStoragePath } from "@/lib/products/primary-image";

const VARIANT_ITEM_EMBED = "items!item_variants_item_tenant_fk";
const PO_HEADER_EMBED = "purchase_orders!purchase_order_items_po_tenant_fk";

export type PoSupplierItemInsights = {
  item_name: string;
  variant_sku: string;
  barcode: string | null;
  unit_of_measure: string;
  image_url: string | null;
  standard_cost: string | null;
  supplier_name: string;
  catalog: {
    supplier_price: string | null;
    supplier_part_number: string | null;
    minimum_order_quantity: string | null;
    lead_time_days: number | null;
    is_preferred: boolean;
    has_catalog_entry: boolean;
  };
  stock: {
    location_name: string;
    location_code: string;
    quantity_on_hand: string;
    average_cost: string;
    reorder_point: string | null;
    below_reorder: boolean;
    tracks_inventory: boolean;
  } | null;
  last_purchase: {
    purchase_order_id: string;
    voucher_number: string;
    unit_price: string;
    quantity_ordered: string;
    ordered_at: string;
  } | null;
  open_purchase: {
    open_quantity: string;
    order_count: number;
  };
  alternative_suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    supplier_price: string;
    is_preferred: boolean;
  }>;
};

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

function extractStandardCost(customFields: Record<string, unknown> | null | undefined): string | null {
  const raw = customFields?.standard_cost;
  if (raw == null || String(raw).trim() === "") return null;
  return String(raw).trim();
}

function extractReorderPoint(customFields: Record<string, unknown> | null | undefined): string | null {
  if (!customFields) return null;
  const raw = customFields.reorder_point ?? customFields.reorder_point_qty;
  if (raw == null) return null;
  const text = String(raw).trim();
  return text || null;
}

function extractPurchaseUom(
  customFields: Record<string, unknown> | null | undefined,
  baseUnit: string
): string {
  const raw = customFields?._default_purchase_uom ?? customFields?.default_purchase_uom;
  const text = raw != null ? String(raw).trim() : "";
  return text || baseUnit;
}

type SupplierCatalogRow = {
  supplier_price: number | string;
  supplier_part_number: string | null;
  minimum_order_quantity: number | string;
  lead_time_days: number | null;
  is_preferred: boolean;
  variant_id: string | null;
};

function pickSupplierCatalogRow(
  rows: SupplierCatalogRow[],
  variantId: string
): SupplierCatalogRow | null {
  if (!rows.length) return null;
  return rows.find((row) => row.variant_id === variantId) ?? rows.find((row) => row.variant_id == null) ?? null;
}

export function compareLinePriceToCatalog(
  lineUnitPrice: string,
  catalogPrice: string | null
): { delta: number | null; label: string | null } {
  if (catalogPrice == null || catalogPrice.trim() === "") {
    return { delta: null, label: null };
  }
  const line = Number(lineUnitPrice);
  const catalog = Number(catalogPrice);
  if (!Number.isFinite(line) || !Number.isFinite(catalog) || catalog === 0) {
    return { delta: null, label: null };
  }
  const pct = ((line - catalog) / catalog) * 100;
  if (Math.abs(pct) < 0.05) {
    return { delta: 0, label: "Matches catalog" };
  }
  const sign = pct > 0 ? "+" : "";
  return { delta: pct, label: `${sign}${pct.toFixed(1)}% vs catalog` };
}

export async function fetchSupplierItemInsights(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    supplier_id: string;
    variant_id: string;
    destination_location_id: string;
    exclude_purchase_order_id?: string | null;
  }
): Promise<PoSupplierItemInsights | null> {
  const supplierId = input.supplier_id.trim();
  const variantId = input.variant_id.trim();
  const locationId = input.destination_location_id.trim();
  if (!supplierId || !variantId || !locationId) return null;

  const { data: variantRow, error: variantError } = await supabase
    .from("item_variants")
    .select(
      `
      id,
      sku,
      barcode,
      item_id,
      is_master,
      ${VARIANT_ITEM_EMBED}!inner (
        name,
        base_unit_of_measure,
        track_inventory,
        custom_fields
      )
    `
    )
    .eq("tenant_id", tenantId)
    .eq("id", variantId)
    .eq("is_active", true)
    .maybeSingle();

  if (variantError) throw new Error(variantError.message);
  if (!variantRow) return null;

  const item = resolveJoin(
    (variantRow as { items: unknown }).items as
      | {
          name: string;
          base_unit_of_measure: string;
          track_inventory: boolean;
          custom_fields: Record<string, unknown> | null;
        }
      | {
          name: string;
          base_unit_of_measure: string;
          track_inventory: boolean;
          custom_fields: Record<string, unknown> | null;
        }[]
      | null
  );
  const itemId = variantRow.item_id as string;
  const customFields = item?.custom_fields ?? null;

  const [
    supplierResult,
    catalogResult,
    valuationResult,
    mediaResult,
    variantSiblingsResult,
    lastPurchaseResult,
    openPurchaseResult,
    alternativesResult,
  ] = await Promise.all([
    supabase.from("entities").select("name").eq("tenant_id", tenantId).eq("id", supplierId).maybeSingle(),
    supabase
      .from("supplier_items")
      .select(
        "supplier_price, supplier_part_number, minimum_order_quantity, lead_time_days, is_preferred, variant_id"
      )
      .eq("tenant_id", tenantId)
      .eq("supplier_id", supplierId)
      .eq("item_id", itemId)
      .or(`variant_id.eq.${variantId},variant_id.is.null`),
    supabase
      .from("item_valuations")
      .select(
        `
        total_quantity_on_hand,
        current_average_cost,
        tenant_locations!item_valuations_location_tenant_fk (name, code)
      `
      )
      .eq("tenant_id", tenantId)
      .eq("variant_id", variantId)
      .eq("location_id", locationId)
      .maybeSingle(),
    supabase
      .from("item_media")
      .select("item_id, variant_id, storage_url, sort_order, is_primary")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId),
    supabase
      .from("item_variants")
      .select("id, is_master")
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId)
      .eq("is_active", true),
    supabase
      .from("purchase_order_items")
      .select(
        `
        unit_price_contractual,
        quantity_ordered,
        created_at,
        ${PO_HEADER_EMBED}!inner (
          id,
          voucher_number,
          supplier_id,
          document_status
        )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("variant_id", variantId)
      .eq("purchase_orders.supplier_id", supplierId)
      .not("purchase_orders.document_status", "eq", "CANCELLED")
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("purchase_order_items")
      .select(
        `
        quantity_ordered,
        quantity_received,
        ${PO_HEADER_EMBED}!inner (
          id,
          supplier_id,
          document_status
        )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("variant_id", variantId)
      .eq("purchase_orders.supplier_id", supplierId)
      .in("purchase_orders.document_status", ["DRAFT", "ISSUED_ACTIVE", "PARTIALLY_FULFILLED"]),
    supabase
      .from("supplier_items")
      .select(
        `
        supplier_id,
        supplier_price,
        is_preferred,
        variant_id,
        entities!supplier_items_supplier_id_fkey ( name )
      `
      )
      .eq("tenant_id", tenantId)
      .eq("item_id", itemId)
      .neq("supplier_id", supplierId)
      .or(`variant_id.eq.${variantId},variant_id.is.null`)
      .order("is_preferred", { ascending: false }),
  ]);

  if (supplierResult.error) throw new Error(supplierResult.error.message);
  if (catalogResult.error) throw new Error(catalogResult.error.message);
  if (valuationResult.error) throw new Error(valuationResult.error.message);
  if (mediaResult.error) throw new Error(mediaResult.error.message);
  if (variantSiblingsResult.error) throw new Error(variantSiblingsResult.error.message);
  if (lastPurchaseResult.error) throw new Error(lastPurchaseResult.error.message);
  if (openPurchaseResult.error) throw new Error(openPurchaseResult.error.message);
  if (alternativesResult.error) throw new Error(alternativesResult.error.message);

  const catalogRow = pickSupplierCatalogRow(
    (catalogResult.data ?? []) as SupplierCatalogRow[],
    variantId
  );

  let imageUrl: string | null = null;
  const mediaRows = (mediaResult.data ?? []) as Array<{
    item_id: string;
    variant_id: string | null;
    storage_url: string;
    sort_order: number;
    is_primary: boolean;
  }>;
  const variantSiblings = (variantSiblingsResult.data ?? []) as Array<{ id: string; is_master: boolean | null }>;
  const storagePath = pickPrimaryImageStoragePath(mediaRows, variantId, variantSiblings);
  if (storagePath) {
    const signed = await resolveProductMediaSignedUrls(supabase, [storagePath]);
    imageUrl = signed.get(storagePath) ?? null;
  }

  const valuation = valuationResult.data as
    | {
        total_quantity_on_hand: number | string;
        current_average_cost: number | string;
        tenant_locations: { name: string; code: string } | { name: string; code: string }[] | null;
      }
    | null;
  const location = valuation ? resolveJoin(valuation.tenant_locations) : null;
  const onHand = valuation ? formatDecimal(valuation.total_quantity_on_hand, "0") : "0";
  const reorderPoint = extractReorderPoint(customFields);
  const onHandNum = Number(onHand);
  const reorderNum = reorderPoint != null ? Number(reorderPoint) : null;
  const belowReorder =
    reorderNum != null &&
    Number.isFinite(reorderNum) &&
    Number.isFinite(onHandNum) &&
    onHandNum <= reorderNum;

  const lastRow = lastPurchaseResult.data?.[0] as
    | {
        unit_price_contractual: number | string;
        quantity_ordered: number | string;
        created_at: string;
        purchase_orders: { id: string; voucher_number: string } | { id: string; voucher_number: string }[];
      }
    | undefined;
  const lastPo = lastRow ? resolveJoin(lastRow.purchase_orders) : null;

  const openRows = (openPurchaseResult.data ?? []) as Array<{
    quantity_ordered: number | string;
    quantity_received: number | string;
    purchase_orders: { id: string } | { id: string }[];
  }>;
  const excludePoId = input.exclude_purchase_order_id?.trim() || null;
  const openOrderIds = new Set<string>();
  let openQty = 0;
  for (const row of openRows) {
    const po = resolveJoin(row.purchase_orders);
    if (!po?.id || (excludePoId && po.id === excludePoId)) continue;
    openOrderIds.add(po.id);
    const ordered = Number(formatDecimal(row.quantity_ordered, "0"));
    const received = Number(formatDecimal(row.quantity_received, "0"));
    openQty += Math.max(0, ordered - received);
  }

  const alternativeMap = new Map<
    string,
    { supplier_id: string; supplier_name: string; supplier_price: string; is_preferred: boolean }
  >();
  for (const row of alternativesResult.data ?? []) {
    const typed = row as {
      supplier_id: string;
      supplier_price: number | string;
      is_preferred: boolean;
      variant_id: string | null;
      entities: { name: string } | { name: string }[] | null;
    };
    if (typed.variant_id != null && typed.variant_id !== variantId) continue;
    if (alternativeMap.has(typed.supplier_id)) continue;
    const entity = resolveJoin(typed.entities);
    alternativeMap.set(typed.supplier_id, {
      supplier_id: typed.supplier_id,
      supplier_name: entity?.name ?? "",
      supplier_price: formatDecimal(typed.supplier_price),
      is_preferred: typed.is_preferred,
    });
  }

  return {
    item_name: item?.name ?? "",
    variant_sku: String(variantRow.sku ?? ""),
    barcode: (variantRow.barcode as string | null) ?? null,
    unit_of_measure: extractPurchaseUom(customFields, item?.base_unit_of_measure ?? ""),
    image_url: imageUrl,
    standard_cost: extractStandardCost(customFields),
    supplier_name: (supplierResult.data?.name as string | undefined) ?? "",
    catalog: {
      supplier_price: catalogRow ? formatDecimal(catalogRow.supplier_price) : null,
      supplier_part_number: catalogRow?.supplier_part_number ?? null,
      minimum_order_quantity: catalogRow
        ? formatDecimal(catalogRow.minimum_order_quantity, "1")
        : null,
      lead_time_days: catalogRow?.lead_time_days ?? null,
      is_preferred: catalogRow?.is_preferred ?? false,
      has_catalog_entry: catalogRow != null,
    },
    stock: item?.track_inventory
      ? {
          location_name: location?.name ?? "",
          location_code: location?.code ?? "",
          quantity_on_hand: onHand,
          average_cost: valuation ? formatDecimal(valuation.current_average_cost, "0") : "0",
          reorder_point: reorderPoint,
          below_reorder: belowReorder,
          tracks_inventory: true,
        }
      : null,
    last_purchase: lastPo
      ? {
          purchase_order_id: lastPo.id,
          voucher_number: lastPo.voucher_number,
          unit_price: formatDecimal(lastRow!.unit_price_contractual),
          quantity_ordered: formatDecimal(lastRow!.quantity_ordered),
          ordered_at: lastRow!.created_at,
        }
      : null,
    open_purchase: {
      open_quantity: formatDecimal(openQty),
      order_count: openOrderIds.size,
    },
    alternative_suppliers: [...alternativeMap.values()].slice(0, 4),
  };
}
