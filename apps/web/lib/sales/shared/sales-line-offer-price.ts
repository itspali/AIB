import { resolvePoLinePickerOfferUnitPrice } from "@/lib/procurement/purchase-orders/supplier-price";

/** Sales offer unit price from picker / catalog selling rate. */
export function resolveSalesLinePickerOfferUnitPrice(
  sellingPrice: string | null | undefined
): string {
  return resolvePoLinePickerOfferUnitPrice(sellingPrice);
}
