import {
  VARIANT_STRATEGY_CHOICES,
  VARIANT_STRATEGY_FIELD_INTRO,
} from "@/lib/products/variant-strategy";

/** Plain-language hints for item editor field info icons. */
export const ITEM_EDITOR_FIELD_HELP = {
  itemName: "The name shown on orders, bills, and your shop.",
  sku: "Your internal product code. Different sizes or colors get their own codes later.",
  category: "Links size/color options and tax ideas from your category list.",
  description: "Notes for your team or website. Does not change tax or stock.",
  itemType:
    "Goods = physical products you can stock. Service = work with no stock. Digital = downloads or licenses.",
  classification:
    "What this item is used for in reports (raw material, finished product, supply, etc.). Does not turn stock on or off.",
  taxCategoryTaxable:
    "This item is taxed. Choose a GST rate below and enter the government product code.",
  taxCategoryNonTaxable:
    "GST rate and product code only matter when you pick Taxable as the category.",
  taxRule:
    "GST % for this item (for example 18%). Bills will use the right split for your state vs other states.",
  taxRuleNoRules:
    "No tax rates yet. Go to Settings → Tax Settings and add rates like GST 18%.",
  hsnRequired:
    "Required for taxable items. Use the government code you put on GST invoices for this product.",
  hsnIntro:
    "Government product code on GST bills. Goods use HSN numbers; services use SAC codes.",
  sellingRate: "Usual price per unit when you sell, if no special price list applies.",
  purchaseRate: "Usual cost per unit when you buy from a supplier.",
  salesUnit: "Unit shown by default on sales (piece, box, kg, etc.).",
  purchaseUnit: "Unit shown by default on purchases.",
  preferredSupplier:
    "Optional. Pick a supplier only if you want a default buy price on their record.",
  purchaseConversionDefined:
    "This conversion is already set under Units of measure.",
  purchaseConversionFactor: (baseUom: string, purchaseUom: string) =>
    `How many ${baseUom} are in one ${purchaseUom}. You can also set this under Units of measure.`,
  costingMethod:
    "How stock value is calculated when you receive or sell (oldest-first, average, or fixed plan cost).",
  standardCost: "Planned cost per unit when you use Standard costing.",
  trackingMode:
    "Track stock by batch, by serial number, or do not track batches at all.",
  gtin: "Optional UPC/EAN from the package. If blank, scanning may use SKU per workspace settings.",
  valuationMethod: "Set in company settings. Shown here for reference.",
  volume: "Package size for shipping quotes. Optional if you enter length, width, and height.",
  lengthCm: "Package length in centimeters.",
  widthCm: "Package width in centimeters.",
  heightCm: "Package height in centimeters.",
  conversionFactor:
    "How many base units equal one of this unit. Example: 1 box = 12 pieces → enter 12.",
  weightShipping: "Used for shipping quotes only. Does not change how stock is counted.",
  lockedField: "Cannot change because this item already has sales or purchases.",
  alternateUnits:
    "Other units you buy or sell in (box, dozen). Enter how many base units each one equals.",
  baseUnitPhysical: "Main unit for counting stock (piece, kg, etc.).",
  baseUnitNonPhysical: "Main unit on orders and bills.",
  usingBaseUnit: (uom: string) => `Using the base unit (${uom}).`,
  purchaseUnitFromAlternates: (factor: string, baseUom: string, purchaseUom: string) =>
    `Uses ${factor} ${baseUom} per ${purchaseUom} from your alternate units list.`,
  purchaseUnitDefault: "Unit used by default when you buy, if the order does not specify one.",
} as const;

export const ITEM_EDITOR_TOGGLE_HELP = {
  active: "Off hides this item from new sales and purchases.",
  needsReview: "Turn off after you have checked the details.",
  salable: "On = customers can order this. Off = not for sale.",
  returnable: "On = this item can be returned after a sale.",
  purchasable: "On = you can buy this on purchase orders.",
  trackInventory: "On = the system tracks how many you have in stock.",
  trackInventoryOff:
    "Turn on to set costing, batch tracking, kits, and stock value.",
  trackInventoryLocked:
    "Cannot change because this item already has stock movements.",
  bundle: "On = sold as a set made from other items, not from its own stock.",
} as const;

export const CATALOG_FIELD_HELP = {
  skuMask:
    "Pattern for auto product codes. Use {BASE} and names like {Size} for each version.",
  customFields: "Extra details you define (shelf spot, internal code, etc.).",
  tags: "Labels to search and filter this item.",
  storefront: "Pick which online shops can show this item.",
  channelVisible: "Off = hidden on that shop, even if it is for sale elsewhere.",
  displayName: "Different name on that shop only. Leave blank to use the item name.",
  priceBook: "Special price list for that shop. Blank = company default prices.",
} as const;

export const MEDIA_FIELD_HELP = {
  imageScope: "Add photos for the whole product or for one size/color version.",
  storefront: "Show this image on your website.",
  digitalCatalog: "Include in PDF or email catalogs.",
  internalDocs: "Show on printed purchase and sales papers.",
} as const;

export const VARIANT_FIELD_HELP = {
  variantSkuMask: (mask: string) => `Code pattern: ${mask}`,
  price: "Leave empty to use the main selling price on the item.",
  active: "Off = keep old records, but do not sell or stock this version.",
  gtin: "Optional GTIN (UPC/EAN) for this size or color.",
  weight: "For shipping quotes only. Does not change stock count.",
  categoryAttribute: (key: string) =>
    `Value for "${key}" from the category template. Used per version when that attribute is in your chosen “Varies by” axes.`,
} as const;

export function VariantStrategyFieldHelp() {
  return (
    <>
      <p>{VARIANT_STRATEGY_FIELD_INTRO}</p>
      <ul className="list-none space-y-1.5 pl-0">
        {VARIANT_STRATEGY_CHOICES.map((choice) => (
          <li key={choice.value}>
            <strong>{choice.label}</strong>
            {" — "}
            {choice.description}
          </li>
        ))}
      </ul>
    </>
  );
}
