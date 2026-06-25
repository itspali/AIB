import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import { itemStatusLabel } from "@/lib/products/item-model";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";

export type ItemsRecordStatusTone = "active" | "inactive" | "warning";

export type ItemsRecordDetailView = {
  itemId: string | null;
  name: string;
  sku: string;
  skuDisplay: string;
  imageUrl: string | null;
  selling: string;
  mrp: string;
  purchase: string;
  classification: string;
  category: string;
  tax: string;
  uom: string;
  hsn: string;
  stock: string;
  status: string;
  statusTone: ItemsRecordStatusTone;
  purchasable: boolean;
  salable: boolean;
  returnable: boolean;
  supplier: string | null;
  description: string | null;
  updatedAt: string;
  updatedLabel: string;
};

function formatOptionalCurrency(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "—";
  return formatCurrency(parsed);
}

function resolveImageUrl(
  detail: ProductDetailSnapshot | null,
  row: ProductListRow | null
): string | null {
  const primary =
    detail?.media.find((asset) => asset.is_primary)?.preview_url ??
    detail?.media.find((asset) => asset.is_primary)?.storage_url ??
    detail?.media[0]?.preview_url ??
    detail?.media[0]?.storage_url;
  if (primary) return primary;
  return row?.image_url ?? null;
}

function resolveSku(detail: ProductDetailSnapshot | null, row: ProductListRow | null): string {
  if (detail?.sku?.trim()) return detail.sku.trim();
  if (row?.default_sku?.trim()) return row.default_sku.trim();
  if (row?.id) return row.id.slice(0, 8).toUpperCase();
  return "—";
}

function resolveStatus(
  detail: ProductDetailSnapshot | null,
  row: ProductListRow | null
): { label: string; tone: ItemsRecordStatusTone } {
  if (detail?.needs_review) {
    return { label: "Needs review", tone: "warning" };
  }
  if (detail?.status) {
    const label = itemStatusLabel(detail.status);
    const tone: ItemsRecordStatusTone =
      detail.status === "ACTIVE" ? "active" : detail.status === "DRAFT" ? "warning" : "inactive";
    return { label, tone };
  }
  if (row?.variant_id && row.variant_is_active === false) {
    return { label: "Variant inactive", tone: "inactive" };
  }
  return row?.is_active
    ? { label: "Active", tone: "active" }
    : { label: "Inactive", tone: "inactive" };
}

function formatRelativeUpdated(iso: string | null | undefined): string {
  if (!iso) return "Recently updated";
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "Recently updated";
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Updated ${days}d ago`;
  return `Updated ${formatDate(iso)}`;
}

export function buildItemsRecordDetailView(
  detail: ProductDetailSnapshot | null,
  row: ProductListRow | null
): ItemsRecordDetailView {
  const sku = resolveSku(detail, row);
  const status = resolveStatus(detail, row);
  const updatedAt = detail?.updated_at ?? row?.updated_at ?? "";

  return {
    itemId: detail?.id ?? row?.id ?? null,
    name: detail?.name ?? row?.name ?? "—",
    sku,
    skuDisplay: sku === "—" ? sku : sku.startsWith("#") ? sku : `#${sku}`,
    imageUrl: resolveImageUrl(detail, row),
    selling: formatOptionalCurrency(detail?.selling_price ?? row?.selling_price),
    mrp: formatOptionalCurrency(detail?.mrp ?? row?.mrp),
    purchase: formatOptionalCurrency(detail?.purchase_price ?? row?.purchase_price),
    classification: detail
      ? classificationLabel(detail.classification)
      : row
        ? classificationLabel(row.classification)
        : "—",
    category: detail?.category_name ?? row?.category_name ?? "—",
    tax: detail
      ? taxCategoryLabel(detail.default_tax_category)
      : row
        ? taxCategoryLabel(row.default_tax_category)
        : "—",
    uom: detail?.base_unit_of_measure ?? row?.base_unit_of_measure ?? "—",
    hsn: detail?.hsn_sac_code ?? row?.hsn_sac_code ?? "—",
    stock: row?.stock_on_hand?.trim() ? row.stock_on_hand : "—",
    status: status.label,
    statusTone: status.tone,
    purchasable: detail?.is_purchasable ?? row?.is_purchasable ?? false,
    salable: detail?.is_salable ?? row?.is_salable ?? false,
    returnable: detail?.is_returnable ?? row?.is_returnable ?? false,
    supplier: detail?.supplier_name ?? row?.supplier_name ?? null,
    description: detail?.description ?? row?.description ?? null,
    updatedAt,
    updatedLabel: formatRelativeUpdated(updatedAt),
  };
}
