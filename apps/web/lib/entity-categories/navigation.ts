import { CUSTOMERS_HREF, SUPPLIERS_HREF } from "@/lib/entities/entity-navigation";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import {
  buildModuleHref,
  moduleDrawerCreateHref,
  moduleDrawerEditHref,
  moduleDrawerPeekHref,
} from "@/lib/layout/module-drawer-url";

export const CUSTOMER_CATEGORIES_HREF = `${CUSTOMERS_HREF}/categories`;
export const SUPPLIER_CATEGORIES_HREF = `${SUPPLIERS_HREF}/categories`;

export function customerCategoriesHref(): string {
  return CUSTOMER_CATEGORIES_HREF;
}

export function supplierCategoriesHref(): string {
  return SUPPLIER_CATEGORIES_HREF;
}

export function entityCategoriesHref(workspace: EntityCategoryWorkspace): string {
  return workspace === "customer" ? CUSTOMER_CATEGORIES_HREF : SUPPLIER_CATEGORIES_HREF;
}

export function entityCategoryNewHref(workspace: EntityCategoryWorkspace): string {
  return moduleDrawerCreateHref(entityCategoriesHref(workspace));
}

export function entityCategoryPeekHref(
  workspace: EntityCategoryWorkspace,
  categoryId: string
): string {
  return moduleDrawerPeekHref(entityCategoriesHref(workspace), categoryId);
}

export function entityCategoryEditHref(
  workspace: EntityCategoryWorkspace,
  categoryId: string
): string {
  return moduleDrawerEditHref(entityCategoriesHref(workspace), categoryId);
}

export function entityCategoryListReturnHref(
  workspace: EntityCategoryWorkspace,
  categoryId?: string | null
): string {
  return buildModuleHref(entityCategoriesHref(workspace), { recordId: categoryId ?? null });
}
