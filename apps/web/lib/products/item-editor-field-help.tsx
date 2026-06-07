import {
  VARIANT_STRATEGY_CHOICES,
  VARIANT_STRATEGY_FIELD_INTRO,
} from "@/lib/products/variant-strategy";

/** Plain-language hints for item editor field info icons. */
export const ITEM_EDITOR_FIELD_HELP = {
  itemName:
    "The name shown on orders, bills, and your shop. Example: Standard service package.",
  sku: "Your internal product code. Different sizes or colors get their own codes later.",
  productCodeMultiSku:
    "Stable code for the product. Sellable SKUs are added under Variants.",
  category:
    "Links size/color options and tax ideas from your category list. Pick a category or leave uncategorized.",
  description:
    "Notes for your team or website. Does not change tax or stock. Optional internal notes are fine.",
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
    "Government product or service classification code on GST bills. Goods use HSN; services use SAC.",
  hsnExample: "Example: 8471 for goods or 998314 for services.",
  taxRuleSelect:
    "Pick the GST rate for this item, or choose No tax rule until you have decided.",
  variantStrategySelect: "Choose how many sellable SKUs this product has.",
  supplyChainRoleSelect: "What this item is used for in reports and purchasing.",
  sellingRate:
    "Default sell price for all variants. Override on a variant row or in price book entries. Example: 0.00.",
  mrp:
    "Maximum retail price (MRP) printed on the label. Optional; used as a default for new variants. Example: 0.00.",
  reorderPoint:
    "Default reorder for all sellable variants and stocked locations. Override per SKU and location in Reach → Locations. Example: 0.",
  purchaseRate:
    "Default buy quote for all variants. Override per variant in the Suppliers grid. Example: 0.00.",
  salesUnit: "Unit shown by default on sales (piece, box, kg, etc.).",
  purchaseUnit: "Unit shown by default on purchases.",
  preferredSupplier:
    "Optional default vendor for catalog buy price. Add more suppliers per variant under Suppliers.",
  purchaseConversionDefined:
    "This conversion is already set under Units of measure.",
  purchaseConversionFactor: (baseUom: string, purchaseUom: string) =>
    `How many ${baseUom} are in one ${purchaseUom}. You can also set this under Units of measure. Example: 1.`,
  costingMethod:
    "How stock value is calculated when you receive or sell (oldest-first, average, or fixed plan cost).",
  standardCost:
    "Planned cost per unit when you use Standard costing. Example: 0.00.",
  trackingMode:
    "Track stock by batch, by serial number, or do not track batches at all.",
  gtin: "Optional UPC/EAN from the package. If blank, scanning may use SKU per workspace settings. Example: 8901234567890.",
  gtinMultiSku:
    "This product has more than one variant. Set GTIN on each variant in the Variants stage.",
  valuationMethod: "Set in company settings. Shown here for reference.",
  volume: "Calculated from length × width × height (cm³). Shown as info when all three sides are set.",
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
    "Turn on to set costing, batch tracking, and stock value. Leave off when sold as a set.",
  trackInventoryLocked:
    "Cannot change because this item already has stock movements.",
  composition:
    "On = customers buy one offer made from other items. Stock and tax apply to each component, not this parent.",
} as const;

export const COMPOSITION_FIELD_HELP = {
  linesTitle: "Composition lines",
  linesBody:
    "Mandatory lines are always included. Optional add-ons can be skipped on quotes. Complimentary lines still appear separately for tax codes.",
} as const;

export const CATALOG_FIELD_HELP = {
  skuMask:
    "Pattern for auto product codes. Use {BASE} and names like {Size} for each variant. Example: {BASE}-{Option1}-{Option2}.",
  customFields: "Extra details you define (shelf spot, internal code, etc.).",
  customFieldKey: "Short label for this detail (e.g. shelf_spot).",
  customFieldValue: "Value stored for that label.",
  tags: "Labels to search and filter this item.",
  newTag: "Type a new tag name, then click Add tag.",
  storefront:
    "Control whether this product appears on each sales channel and how it is priced there.",
  channelVisible:
    "When off, this product is hidden on that channel. Other channels are unaffected.",
  displayName: (channelName: string) =>
    `Customer-facing title on ${channelName} only. Leave blank to show the product name from Essentials.`,
  priceBook: "Special price list for that shop. Blank = company default prices.",
  priceBookSelect: "Pick a price book for this channel, or use the tenant default.",
} as const;

export const MEDIA_FIELD_HELP = {
  imageScope: "Add photos for the whole product or for one variant.",
  storefront: "Show this image on your website.",
  digitalCatalog: "Include in PDF or email catalogs.",
  internalDocs: "Show on printed purchase and sales papers.",
} as const;

export const VARIANT_FIELD_HELP = {
  variantSkuMask: (mask: string) => `Code pattern: ${mask}`,
  sellPrice:
    "Leave empty to use the product default selling price. Enter an amount to override.",
  buyPrice: "Preferred supplier quote for this variant. Manage all vendors under Suppliers.",
  active: "Off = keep history, but do not sell or stock this variant.",
  gtin: "Optional GTIN (UPC/EAN) for this variant. Example: 8901234567890.",
  weight: "For shipping quotes only. Does not change stock count.",
  useCase:
    "The same variant can be bought for production and sold as a spare when the product is marked purchasable and salable.",
  categoryAttribute: (key: string) =>
    `Value for "${key}" from the category template. Used per variant when that attribute is in your “Varies by” list.`,
} as const;

export const SUPPLY_FIELD_HELP = {
  section:
    "Catalog quotes from vendors. Multiple suppliers per variant are allowed; preferred is used on lists and purchase orders.",
  variantAll: "Applies to every variant unless a variant-specific row exists.",
  supplierSelect: "Choose which supplier this row applies to.",
  purchaseRate: "Catalog buy price from this vendor. Example: 0.00.",
  partNumber: "Supplier’s part or catalog number for this SKU. Optional.",
  preferred: "One preferred supplier per variant (or per product when variant is “All variants”).",
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
