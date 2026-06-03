import {
  buildModuleHref,
  moduleDrawerCreateHref,
  moduleDrawerEditHref,
  moduleDrawerPeekHref,
} from "@/lib/layout/module-drawer-url";

export const CATEGORIES_HREF = "/inventory/categories";

export function categoryNewHref(): string {
  return moduleDrawerCreateHref(CATEGORIES_HREF);
}

export function categoryPeekHref(categoryId: string): string {
  return moduleDrawerPeekHref(CATEGORIES_HREF, categoryId);
}

export function categoryEditHref(categoryId: string): string {
  return moduleDrawerEditHref(CATEGORIES_HREF, categoryId);
}

export function categoryListReturnHref(categoryId?: string | null): string {
  return buildModuleHref(CATEGORIES_HREF, { recordId: categoryId ?? null });
}
