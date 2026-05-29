import {
  PRODUCT_FORM_SECTIONS,
  PRODUCT_SECTION_IDS,
  type ProductSectionId,
  type ProductSectionNavItem,
} from "@/lib/products/section-nav";

const STORAGE_KEY = "aib-product-drawer-section-order";

export function getDefaultProductSectionOrder(): ProductSectionId[] {
  return PRODUCT_FORM_SECTIONS.map((section) => section.id);
}

function isSectionId(value: string): value is ProductSectionId {
  return (Object.values(PRODUCT_SECTION_IDS) as string[]).includes(value);
}

export function loadProductSectionOrder(): ProductSectionId[] {
  const defaults = getDefaultProductSectionOrder();
  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw) as string[];
    const order = parsed.filter(isSectionId);
    const orderSet = new Set(order);

    for (const id of defaults) {
      if (!orderSet.has(id)) order.push(id);
    }

    return order;
  } catch {
    return defaults;
  }
}

export function saveProductSectionOrder(order: ProductSectionId[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
  } catch {
    /* ignore quota errors */
  }
}

export function sortSectionsByOrder(
  sections: ProductSectionNavItem[],
  order: ProductSectionId[]
): ProductSectionNavItem[] {
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...sections].sort(
    (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999)
  );
}

export function reorderVisibleSections(
  fullOrder: ProductSectionId[],
  visibleIds: ProductSectionId[],
  fromId: ProductSectionId,
  toId: ProductSectionId
): ProductSectionId[] {
  if (fromId === toId) return fullOrder;

  const visibleSet = new Set(visibleIds);
  const reorderedVisible = fullOrder.filter((id) => visibleSet.has(id));
  const fromIdx = reorderedVisible.indexOf(fromId);
  const toIdx = reorderedVisible.indexOf(toId);
  if (fromIdx < 0 || toIdx < 0) return fullOrder;

  reorderedVisible.splice(fromIdx, 1);
  reorderedVisible.splice(toIdx, 0, fromId);

  let visibleIdx = 0;
  return fullOrder.map((id) => {
    if (!visibleSet.has(id)) return id;
    return reorderedVisible[visibleIdx++]!;
  });
}

export function sectionFlexOrder(
  sectionId: ProductSectionId,
  order: ProductSectionId[],
  visibleIds: ProductSectionId[]
): number {
  const visibleOrder = order.filter((id) => visibleIds.includes(id));
  const index = visibleOrder.indexOf(sectionId);
  return index >= 0 ? index : 999;
}
