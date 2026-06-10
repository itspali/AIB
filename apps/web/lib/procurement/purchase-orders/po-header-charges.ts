export type PoShippingTaxType = "percent" | "amount";

export type PoHeaderChargesFields = {
  shipping_amount: string;
  shipping_tax_rate_pct: string;
  shipping_tax_amount: string;
  shipping_tax_type?: PoShippingTaxType;
  round_off_amount: string;
  additional_charges_amount: string;
};

function parseAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyPoHeaderCharges(): PoHeaderChargesFields {
  return {
    shipping_amount: "0",
    shipping_tax_rate_pct: "0",
    shipping_tax_amount: "0",
    shipping_tax_type: "percent",
    round_off_amount: "0",
    additional_charges_amount: "0",
  };
}

export function resolvePoShippingTaxType(
  charges: PoHeaderChargesFields
): PoShippingTaxType {
  if (charges.shipping_tax_type === "percent" || charges.shipping_tax_type === "amount") {
    return charges.shipping_tax_type;
  }
  if (parseAmount(charges.shipping_tax_amount) > 0 && parseAmount(charges.shipping_tax_rate_pct) <= 0) {
    return "amount";
  }
  return "percent";
}

export function resolvePoShippingTaxAmount(charges: PoHeaderChargesFields): number {
  const shipping = parseAmount(charges.shipping_amount);
  if (shipping <= 0) return 0;

  if (resolvePoShippingTaxType(charges) === "amount") {
    return Math.max(0, parseAmount(charges.shipping_tax_amount));
  }

  const rate = parseAmount(charges.shipping_tax_rate_pct);
  if (rate <= 0) return 0;
  return (shipping * rate) / 100;
}

export function resolvePoShippingTaxInputValue(charges: PoHeaderChargesFields): string {
  return resolvePoShippingTaxType(charges) === "amount"
    ? charges.shipping_tax_amount
    : charges.shipping_tax_rate_pct;
}

export type PoHeaderChargesSnapshot = {
  shippingAmount: number;
  shippingTaxAmount: number;
  roundOffAmount: number;
  additionalChargesAmount: number;
  documentChargesTotal: number;
};

export function resolvePoHeaderChargesSnapshot(
  charges: PoHeaderChargesFields
): PoHeaderChargesSnapshot {
  const shippingAmount = parseAmount(charges.shipping_amount);
  const shippingTaxAmount = resolvePoShippingTaxAmount(charges);
  const roundOffAmount = parseAmount(charges.round_off_amount);
  const additionalChargesAmount = parseAmount(charges.additional_charges_amount);

  return {
    shippingAmount,
    shippingTaxAmount,
    roundOffAmount,
    additionalChargesAmount,
    documentChargesTotal:
      shippingAmount + shippingTaxAmount + roundOffAmount + additionalChargesAmount,
  };
}

export function normalizePoHeaderChargesForSave(
  charges: PoHeaderChargesFields
): {
  shipping_amount: number;
  shipping_tax_rate_pct: number;
  shipping_tax_amount: number;
  shipping_tax_type: PoShippingTaxType;
  round_off_amount: number;
  additional_charges_amount: number;
} {
  const type = resolvePoShippingTaxType(charges);
  const shippingAmount = Math.max(0, parseAmount(charges.shipping_amount));
  const roundOffAmount = parseAmount(charges.round_off_amount);
  const additionalChargesAmount = Math.max(0, parseAmount(charges.additional_charges_amount));

  if (type === "amount") {
    return {
      shipping_amount: shippingAmount,
      shipping_tax_rate_pct: 0,
      shipping_tax_amount: Math.max(0, parseAmount(charges.shipping_tax_amount)),
      shipping_tax_type: "amount",
      round_off_amount: roundOffAmount,
      additional_charges_amount: additionalChargesAmount,
    };
  }

  return {
    shipping_amount: shippingAmount,
    shipping_tax_rate_pct: Math.max(0, parseAmount(charges.shipping_tax_rate_pct)),
    shipping_tax_amount: resolvePoShippingTaxAmount({ ...charges, shipping_tax_type: "percent" }),
    shipping_tax_type: "percent",
    round_off_amount: roundOffAmount,
    additional_charges_amount: additionalChargesAmount,
  };
}
