import type { ShippingCarrierProvider } from "@/lib/fulfillment/shipping/types";

const LABELS: Record<ShippingCarrierProvider, string> = {
  FEDEX: "FedEx",
  DHL: "DHL",
  UPS: "UPS",
  BLUE_DART: "Blue Dart",
  CUSTOM_FLEET: "Custom fleet",
};

export function shippingCarrierLabel(value: ShippingCarrierProvider): string {
  return LABELS[value] ?? value;
}

export const SHIPPING_CARRIER_OPTIONS: ShippingCarrierProvider[] = [
  "FEDEX",
  "DHL",
  "UPS",
  "BLUE_DART",
  "CUSTOM_FLEET",
];
