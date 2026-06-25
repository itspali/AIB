import type { SupabaseClient } from "@supabase/supabase-js";

export type GrnSubcontractBomPreviewLine = {
  parent_item_id: string;
  parent_item_name: string;
  parent_variant_sku: string;
  accepted_qty: number;
  component_item_id: string;
  component_item_name: string;
  component_variant_id: string | null;
  component_variant_sku: string | null;
  quantity_per: number;
  required_qty: number;
  wip_on_hand: number;
  sufficient: boolean;
};

export type GrnSubcontractPreview = {
  is_subcontract_job: boolean;
  wip_location_id: string | null;
  wip_location_name: string | null;
  bom_lines: GrnSubcontractBomPreviewLine[];
  has_insufficient_wip: boolean;
};

type PreviewLineInput = {
  variant_id: string;
  item_id: string;
  quantity_accepted: number;
  is_promotional?: boolean;
};

function formatDecimal(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isMissingColumnError(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("column") && normalized.includes("does not exist");
}

async function fetchPurchaseOrderSubcontractMeta(
  supabase: SupabaseClient,
  tenantId: string,
  purchaseOrderId: string
): Promise<{ id: string; supplier_id: string; is_subcontract_job: boolean } | null> {
  const withFlag = await supabase
    .from("purchase_orders")
    .select("id, is_subcontract_job, supplier_id")
    .eq("tenant_id", tenantId)
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (!withFlag.error) {
    if (!withFlag.data) return null;
    return {
      id: withFlag.data.id as string,
      supplier_id: withFlag.data.supplier_id as string,
      is_subcontract_job: withFlag.data.is_subcontract_job === true,
    };
  }

  if (!isMissingColumnError(withFlag.error.message)) {
    throw new Error(withFlag.error.message);
  }

  const withoutFlag = await supabase
    .from("purchase_orders")
    .select("id, supplier_id")
    .eq("tenant_id", tenantId)
    .eq("id", purchaseOrderId)
    .maybeSingle();

  if (withoutFlag.error) throw new Error(withoutFlag.error.message);
  if (!withoutFlag.data) return null;

  return {
    id: withoutFlag.data.id as string,
    supplier_id: withoutFlag.data.supplier_id as string,
    is_subcontract_job: false,
  };
}

export async function fetchGrnSubcontractPreview(
  supabase: SupabaseClient,
  tenantId: string,
  input: {
    purchaseOrderId: string | null;
    supplierId: string | null;
    lines: PreviewLineInput[];
  }
): Promise<GrnSubcontractPreview | null> {
  if (!input.purchaseOrderId?.trim()) return null;

  const poRow = await fetchPurchaseOrderSubcontractMeta(
    supabase,
    tenantId,
    input.purchaseOrderId
  );

  if (!poRow?.is_subcontract_job) {
    return {
      is_subcontract_job: false,
      wip_location_id: null,
      wip_location_name: null,
      bom_lines: [],
      has_insufficient_wip: false,
    };
  }

  const supplierId = input.supplierId ?? poRow.supplier_id;
  if (!supplierId) return null;

  const { data: wipLink } = await supabase
    .from("vendor_job_work_locations")
    .select("location_id, tenant_locations(name)")
    .eq("tenant_id", tenantId)
    .eq("supplier_id", supplierId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const wipLocationId = (wipLink?.location_id as string | undefined) ?? null;
  const wipLocationEmbed = wipLink?.tenant_locations as { name?: string } | { name?: string }[] | null;
  const wipLocationName = Array.isArray(wipLocationEmbed)
    ? wipLocationEmbed[0]?.name ?? null
    : wipLocationEmbed?.name ?? null;

  const fgLines = input.lines.filter(
    (line) => line.variant_id && line.quantity_accepted > 0 && !line.is_promotional
  );
  if (!fgLines.length || !wipLocationId) {
    return {
      is_subcontract_job: true,
      wip_location_id: wipLocationId,
      wip_location_name: wipLocationName,
      bom_lines: [],
      has_insufficient_wip: false,
    };
  }

  const parentItemIds = [...new Set(fgLines.map((line) => line.item_id))];
  const { data: bomRows, error: bomError } = await supabase
    .from("subcontract_bom_lines")
    .select("parent_item_id, component_item_id, quantity_per")
    .eq("tenant_id", tenantId)
    .in("parent_item_id", parentItemIds);

  if (bomError) throw new Error(bomError.message);

  const componentItemIds = [...new Set((bomRows ?? []).map((row) => row.component_item_id as string))];
  const allItemIds = [...new Set([...parentItemIds, ...componentItemIds])];

  const [{ data: itemRows }, { data: variantRows }] = await Promise.all([
    allItemIds.length
      ? supabase.from("items").select("id, name").eq("tenant_id", tenantId).in("id", allItemIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    componentItemIds.length
      ? supabase
          .from("item_variants")
          .select("id, item_id, sku")
          .eq("tenant_id", tenantId)
          .in("item_id", componentItemIds)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; item_id: string; sku: string }> }),
  ]);

  const itemNameById = new Map((itemRows ?? []).map((row) => [row.id, row.name]));
  const firstVariantByItem = new Map<string, { id: string; sku: string }>();
  for (const row of variantRows ?? []) {
    if (!firstVariantByItem.has(row.item_id)) {
      firstVariantByItem.set(row.item_id, { id: row.id, sku: row.sku });
    }
  }

  const fgVariantSkus = [...new Set(fgLines.map((line) => line.variant_id))];
  const { data: fgVariantRows } = fgVariantSkus.length
    ? await supabase
        .from("item_variants")
        .select("id, item_id, sku")
        .eq("tenant_id", tenantId)
        .in("id", fgVariantSkus)
    : { data: [] };

  const fgSkuByVariant = new Map(
    (fgVariantRows ?? []).map((row) => [row.item_id, row.sku as string])
  );

  const demandByComponentVariant = new Map<
    string,
    {
      component_item_id: string;
      component_variant_id: string | null;
      required_qty: number;
      preview: Omit<GrnSubcontractBomPreviewLine, "wip_on_hand" | "sufficient">;
    }
  >();

  for (const fgLine of fgLines) {
    const parentBom = (bomRows ?? []).filter((row) => row.parent_item_id === fgLine.item_id);
    for (const bom of parentBom) {
      const qtyPer = formatDecimal(bom.quantity_per);
      const requiredQty = Math.round(qtyPer * fgLine.quantity_accepted * 10000) / 10000;
      if (requiredQty <= 0) continue;

      const componentVariant = firstVariantByItem.get(bom.component_item_id as string) ?? null;
      const key = componentVariant?.id ?? `item:${bom.component_item_id}`;

      const previewLine = {
        parent_item_id: fgLine.item_id,
        parent_item_name: itemNameById.get(fgLine.item_id) ?? "",
        parent_variant_sku: fgSkuByVariant.get(fgLine.item_id) ?? fgLine.variant_id,
        accepted_qty: fgLine.quantity_accepted,
        component_item_id: bom.component_item_id as string,
        component_item_name: itemNameById.get(bom.component_item_id as string) ?? "",
        component_variant_id: componentVariant?.id ?? null,
        component_variant_sku: componentVariant?.sku ?? null,
        quantity_per: qtyPer,
        required_qty: requiredQty,
      };

      const existing = demandByComponentVariant.get(key);
      if (existing) {
        existing.required_qty += requiredQty;
        existing.preview.required_qty = existing.required_qty;
      } else {
        demandByComponentVariant.set(key, {
          component_item_id: bom.component_item_id as string,
          component_variant_id: componentVariant?.id ?? null,
          required_qty: requiredQty,
          preview: previewLine,
        });
      }
    }
  }

  const componentVariantIds = [...demandByComponentVariant.values()]
    .map((row) => row.component_variant_id)
    .filter((id): id is string => Boolean(id));

  const onHandByVariant = new Map<string, number>();
  if (componentVariantIds.length) {
    const { data: balanceRows, error: balanceError } = await supabase
      .from("item_valuations")
      .select("variant_id, total_quantity_on_hand")
      .eq("tenant_id", tenantId)
      .eq("location_id", wipLocationId)
      .in("variant_id", componentVariantIds);

    if (balanceError) throw new Error(balanceError.message);
    for (const row of balanceRows ?? []) {
      onHandByVariant.set(row.variant_id as string, formatDecimal(row.total_quantity_on_hand));
    }
  }

  const bom_lines: GrnSubcontractBomPreviewLine[] = [...demandByComponentVariant.values()].map(
    (row) => {
      const wipOnHand = row.component_variant_id
        ? onHandByVariant.get(row.component_variant_id) ?? 0
        : 0;
      return {
        ...row.preview,
        required_qty: row.required_qty,
        wip_on_hand: wipOnHand,
        sufficient: wipOnHand + 0.0001 >= row.required_qty,
      };
    }
  );

  bom_lines.sort((a, b) =>
    `${a.parent_item_name}:${a.component_item_name}`.localeCompare(
      `${b.parent_item_name}:${b.component_item_name}`
    )
  );

  return {
    is_subcontract_job: true,
    wip_location_id: wipLocationId,
    wip_location_name: wipLocationName,
    bom_lines,
    has_insufficient_wip: bom_lines.some((line) => !line.sufficient),
  };
}

export function aggregateSubcontractConsumptionQty(
  acceptedQty: number,
  quantityPer: number
): number {
  return Math.round(acceptedQty * quantityPer * 10000) / 10000;
}

export function shouldSkipSubcontractBackflush(isSubcontractJob: boolean): boolean {
  return !isSubcontractJob;
}
