import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";
import { itemStatusLabel } from "@/lib/products/item-model";
import { isProductListRowInactive } from "@/lib/products/list-row-key";

export type ItemLifecycleStatusTone = "active" | "inactive" | "warning";

export type ItemLifecycleStatus = {
  label: string;
  tone: ItemLifecycleStatusTone;
};

export function resolveItemListRowLifecycleStatus(
  row: ProductListRow,
  showVariants: boolean
): ItemLifecycleStatus {
  if (!row.is_active) {
    return { label: "Inactive", tone: "inactive" };
  }
  if (showVariants && row.variant_id && row.variant_is_active === false) {
    return { label: "Variant inactive", tone: "inactive" };
  }
  return { label: "Active", tone: "active" };
}

export function resolveItemDetailLifecycleStatus(
  detail: ProductDetailSnapshot | null,
  row: ProductListRow | null
): ItemLifecycleStatus {
  if (detail?.needs_review) {
    return { label: "Needs review", tone: "warning" };
  }
  if (detail?.status) {
    const label = itemStatusLabel(detail.status);
    const tone: ItemLifecycleStatusTone =
      detail.status === "ACTIVE" ? "active" : detail.status === "DRAFT" ? "warning" : "inactive";
    return { label, tone };
  }
  if (row) {
    return resolveItemListRowLifecycleStatus(row, Boolean(row.variant_id));
  }
  if (detail) {
    if (!detail.is_active) {
      return { label: "Inactive", tone: "inactive" };
    }
    if (detail.variant_id && detail.variant_is_active === false) {
      return { label: "Variant inactive", tone: "inactive" };
    }
    return { label: "Active", tone: "active" };
  }
  return { label: "Active", tone: "active" };
}

/** Whether the list row should use muted/inactive presentation. */
export function isItemListRowLifecycleInactive(
  row: ProductListRow,
  showVariants: boolean
): boolean {
  return isProductListRowInactive(row, showVariants);
}
