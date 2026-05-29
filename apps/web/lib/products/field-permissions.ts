import {
  PRODUCT_LIST_COLUMN_IDS,
  type ProductListColumnId,
} from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import type { UserRole } from "@/lib/user/types";

export type ProductFieldKey = ProductListColumnId;

export type ProductFieldAccessOverride = Partial<Record<ProductFieldKey, boolean>>;

export type TenantProductFieldsAccess = Partial<Record<UserRole, ProductFieldAccessOverride>>;

export type ProductFieldPermissions = {
  role: UserRole;
  allowedFields: ProductFieldKey[];
};

export const PRODUCT_FIELD_KEYS: readonly ProductFieldKey[] = PRODUCT_LIST_COLUMN_IDS;

const USER_ROLES: readonly UserRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

const STAFF_DENIED_FIELDS = new Set<ProductFieldKey>([
  "purchase_price",
  "selling_price",
  "supplier_name",
]);

export function getDefaultFieldAccess(role: UserRole, field: ProductFieldKey): boolean {
  if (role === "OWNER" || role === "ADMIN" || role === "MANAGER") return true;
  return !STAFF_DENIED_FIELDS.has(field);
}

export function parseTenantProductFieldsAccess(
  raw: unknown
): TenantProductFieldsAccess | null {
  if (!raw || typeof raw !== "object") return null;

  const parsed = raw as Record<string, unknown>;
  const result: TenantProductFieldsAccess = {};

  for (const role of USER_ROLES) {
    const roleRaw = parsed[role];
    if (!roleRaw || typeof roleRaw !== "object") continue;

    const roleOverrides: ProductFieldAccessOverride = {};
    for (const field of PRODUCT_FIELD_KEYS) {
      const value = (roleRaw as Record<string, unknown>)[field];
      if (typeof value === "boolean") {
        roleOverrides[field] = value;
      }
    }

    if (Object.keys(roleOverrides).length > 0) {
      result[role] = roleOverrides;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function mergeProductFieldPermissions(
  role: UserRole,
  tenantOverride?: TenantProductFieldsAccess | null
): ProductFieldPermissions {
  const roleOverride = tenantOverride?.[role];
  const allowedFields: ProductFieldKey[] = [];

  for (const field of PRODUCT_FIELD_KEYS) {
    const tenantValue = roleOverride?.[field];
    const allowed =
      typeof tenantValue === "boolean" ? tenantValue : getDefaultFieldAccess(role, field);
    if (allowed) allowedFields.push(field);
  }

  return { role, allowedFields };
}

export function buildDefaultProductFieldsAccessMatrix(): TenantProductFieldsAccess {
  const matrix: TenantProductFieldsAccess = {};
  for (const role of USER_ROLES) {
    const roleAccess: ProductFieldAccessOverride = {};
    for (const field of PRODUCT_FIELD_KEYS) {
      roleAccess[field] = getDefaultFieldAccess(role, field);
    }
    matrix[role] = roleAccess;
  }
  return matrix;
}

export function filterAllowedColumnIds<T extends string>(
  ids: readonly T[],
  allowedFields: readonly string[]
): T[] {
  const allowed = new Set(allowedFields);
  return ids.filter((id) => allowed.has(id));
}

const ROW_FIELD_MAP: Partial<Record<ProductFieldKey, keyof ProductListRow>> = {
  image: "image_url",
  name: "name",
  default_sku: "default_sku",
  barcode: "barcode",
  classification: "classification",
  category_name: "category_name",
  description: "description",
  base_unit_of_measure: "base_unit_of_measure",
  hsn_sac_code: "hsn_sac_code",
  has_variants: "has_variants",
  default_tax_category: "default_tax_category",
  is_active: "is_active",
  is_purchasable: "is_purchasable",
  is_salable: "is_salable",
  is_returnable: "is_returnable",
  selling_price: "selling_price",
  purchase_price: "purchase_price",
  supplier_name: "supplier_name",
  stock_on_hand: "stock_on_hand",
  created_at: "created_at",
  updated_at: "updated_at",
};

export function redactProductListRow(
  row: ProductListRow,
  allowedFields: readonly string[]
): ProductListRow {
  const allowed = new Set(allowedFields);
  const next: ProductListRow = { ...row };

  for (const [columnId, rowKey] of Object.entries(ROW_FIELD_MAP) as Array<
    [ProductFieldKey, keyof ProductListRow]
  >) {
    if (allowed.has(columnId)) continue;

    const current = next[rowKey];
    if (typeof current === "boolean") {
      (next[rowKey] as boolean) = false;
    } else if (typeof current === "string" || current === null) {
      (next[rowKey] as string | null) = null;
    }
  }

  if (!allowed.has("image")) {
    next.image_url = null;
  }

  return next;
}

export function redactProductListRows(
  rows: ProductListRow[],
  allowedFields: readonly string[]
): ProductListRow[] {
  return rows.map((row) => redactProductListRow(row, allowedFields));
}

export function isProductFieldAllowed(
  field: string,
  permissions: ProductFieldPermissions
): boolean {
  return permissions.allowedFields.includes(field as ProductFieldKey);
}
