export const PRODUCT_SECTION_IDS = {
  essentials: "product-section-essentials",
  commerce: "product-section-commerce",
  advanced: "product-section-advanced",
} as const;

export type ProductSectionId = (typeof PRODUCT_SECTION_IDS)[keyof typeof PRODUCT_SECTION_IDS];

export type ProductSectionNavItem = {
  id: ProductSectionId;
  label: string;
  shortLabel?: string;
  advanced?: boolean;
};

export const PRODUCT_FORM_SECTIONS: ProductSectionNavItem[] = [
  {
    id: PRODUCT_SECTION_IDS.essentials,
    label: "Essential Attributes",
    shortLabel: "Essentials",
  },
  {
    id: PRODUCT_SECTION_IDS.commerce,
    label: "Commerce & Costing",
    shortLabel: "Commerce",
  },
  {
    id: PRODUCT_SECTION_IDS.advanced,
    label: "Advanced Parameters",
    shortLabel: "Advanced",
    advanced: true,
  },
];
