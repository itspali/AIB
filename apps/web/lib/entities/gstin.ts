import type { EntityFormValues, TaxTreatmentType } from "@/lib/entities/types";

export type GstinLookupResult = {
  gstin: string;
  pan: string;
  stateCode: string;
  stateName: string | null;
  legalName: string | null;
  tradeName: string | null;
  status: string | null;
  taxpayerType: string | null;
  billingAddressLine1: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingZipPostal: string | null;
  billingCountryCode: string;
  taxTreatment: TaxTreatmentType | null;
  source: "remote" | "local";
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CODEPOINT_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PIN_PATTERN = /\b(\d{6})\b/;

/** GST state codes (reverse of India Compliance STATE_NUMBERS) + special jurisdictions. */
export const GST_STATE_CODE_TO_NAME: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep Islands",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "96": "Other Countries",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

export function normalizeGstin(value: string): string {
  return value.trim().toUpperCase();
}

export function isGstinFormat(value: string): boolean {
  return GSTIN_PATTERN.test(normalizeGstin(value));
}

/** Mod-36 check digit validation (GSTN algorithm). */
export function isGstinCheckDigitValid(gstin: string): boolean {
  const normalized = normalizeGstin(gstin);
  if (normalized.length !== 15) return false;

  let factor = 1;
  let total = 0;
  const mod = CODEPOINT_CHARS.length;

  for (const char of normalized.slice(0, -1)) {
    const codePoint = CODEPOINT_CHARS.indexOf(char);
    if (codePoint < 0) return false;
    let digit = factor * codePoint;
    digit = Math.floor(digit / mod) + (digit % mod);
    total += digit;
    factor = factor === 1 ? 2 : 1;
  }

  const expected = CODEPOINT_CHARS[(mod - (total % mod)) % mod];
  return normalized.at(-1) === expected;
}

export function validateGstin(value: string): string | null {
  const normalized = normalizeGstin(value);
  if (!normalized) return "GSTIN is required";
  if (normalized.length !== 15) return "GSTIN must be 15 characters";
  if (!GSTIN_PATTERN.test(normalized)) return "Enter a valid GSTIN format";
  if (!isGstinCheckDigitValid(normalized)) return "GSTIN check digit is invalid";
  return null;
}

export function extractPanFromGstin(gstin: string): string {
  return normalizeGstin(gstin).slice(2, 12);
}

export function resolveStateNameFromGstin(gstin: string): string | null {
  const stateCode = normalizeGstin(gstin).slice(0, 2);
  return GST_STATE_CODE_TO_NAME[stateCode] ?? null;
}

export function parseGstinLocally(gstin: string): GstinLookupResult {
  const normalized = normalizeGstin(gstin);
  const stateCode = normalized.slice(0, 2);

  return {
    gstin: normalized,
    pan: extractPanFromGstin(normalized),
    stateCode,
    stateName: GST_STATE_CODE_TO_NAME[stateCode] ?? null,
    legalName: null,
    tradeName: null,
    status: null,
    taxpayerType: null,
    billingAddressLine1: null,
    billingCity: null,
    billingState: GST_STATE_CODE_TO_NAME[stateCode] ?? null,
    billingZipPostal: null,
    billingCountryCode: "IN",
    taxTreatment: null,
    source: "local",
  };
}

export function mapTaxpayerTypeToEntityTreatment(
  taxpayerType: string | null | undefined
): TaxTreatmentType | null {
  if (!taxpayerType) return null;
  const normalized = taxpayerType.trim().toLowerCase();

  if (normalized.includes("composition")) return "COMPOSITION";
  if (normalized.includes("sez")) return "SEZ_DEVELOPER";
  if (normalized.includes("overseas") || normalized.includes("nri")) return "OVERSEAS_EXPORT";
  if (normalized.includes("deemed")) return "DEEMED_EXPORT";
  if (normalized.includes("regular") || normalized.includes("normal")) return "REGULAR_B2B";

  return "REGULAR_B2B";
}

function joinAddressParts(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function extractPinCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.match(PIN_PATTERN);
  return match?.[1] ?? null;
}

type GstPortalAddress = {
  bno?: string;
  bnm?: string;
  flno?: string;
  st?: string;
  loc?: string;
  dst?: string;
  city?: string;
  stcd?: string;
  pncd?: string;
};

/** Map official GSTN / GSP search payload shape to lookup result. */
export function mapGstPortalPayload(
  payload: Record<string, unknown>,
  fallback: GstinLookupResult
): GstinLookupResult {
  const pradr = payload.pradr as { addr?: GstPortalAddress; ntr?: string } | undefined;
  const addr = pradr?.addr;
  const line1 = joinAddressParts([addr?.bno, addr?.flno, addr?.bnm, addr?.st, addr?.loc]);
  const city = addr?.dst?.trim() || addr?.city?.trim() || null;
  const state = addr?.stcd?.trim() || fallback.billingState;
  const pin = addr?.pncd?.trim() || extractPinCode(line1);
  const legalName = typeof payload.lgnm === "string" ? payload.lgnm.trim() : null;
  const tradeName =
    typeof payload.tradeNam === "string" ? payload.tradeNam.trim() : null;
  const taxpayerType = typeof payload.dty === "string" ? payload.dty.trim() : null;

  return {
    ...fallback,
    legalName,
    tradeName,
    status: typeof payload.sts === "string" ? payload.sts.trim() : null,
    taxpayerType,
    billingAddressLine1: line1 || null,
    billingCity: city,
    billingState: state,
    billingZipPostal: pin,
    billingCountryCode: "IN",
    taxTreatment: mapTaxpayerTypeToEntityTreatment(taxpayerType),
    source: "remote",
  };
}

export function mapGstVerifyPayload(
  payload: Record<string, unknown>,
  fallback: GstinLookupResult
): GstinLookupResult {
  const legalName =
    typeof payload.legal_name === "string"
      ? payload.legal_name.trim()
      : typeof payload.legalName === "string"
        ? payload.legalName.trim()
        : null;
  const tradeName =
    typeof payload.trade_name === "string"
      ? payload.trade_name.trim()
      : typeof payload.tradeName === "string"
        ? payload.tradeName.trim()
        : null;
  const address =
    typeof payload.address === "string"
      ? payload.address.trim()
      : typeof payload.pradr === "string"
        ? payload.pradr.trim()
        : null;
  const state =
    typeof payload.state === "string"
      ? payload.state.trim()
      : typeof payload.stateName === "string"
        ? payload.stateName.trim()
        : fallback.billingState;
  const taxpayerType =
    typeof payload.taxpayer_type === "string"
      ? payload.taxpayer_type.trim()
      : typeof payload.taxpayerType === "string"
        ? payload.taxpayerType.trim()
        : null;

  return {
    ...fallback,
    legalName,
    tradeName,
    status:
      typeof payload.status === "string"
        ? payload.status.trim()
        : typeof payload.registration_status === "string"
          ? payload.registration_status.trim()
          : null,
    taxpayerType,
    billingAddressLine1: address,
    billingCity: null,
    billingState: state,
    billingZipPostal: extractPinCode(address),
    billingCountryCode: "IN",
    taxTreatment: mapTaxpayerTypeToEntityTreatment(taxpayerType),
    source: "remote",
  };
}

export function applyGstinLookupToEntityForm(
  form: EntityFormValues,
  lookup: GstinLookupResult
): EntityFormValues {
  const displayName = lookup.tradeName || lookup.legalName || form.name;
  const shipping = form.same_as_billing
    ? {
        shipping_address_line1: lookup.billingAddressLine1 ?? form.billing_address_line1,
        shipping_address_line2: form.billing_address_line2,
        shipping_city: lookup.billingCity ?? form.billing_city,
        shipping_state: lookup.billingState ?? form.billing_state,
        shipping_zip_postal: lookup.billingZipPostal ?? form.billing_zip_postal,
        shipping_country_code: lookup.billingCountryCode,
      }
    : {};

  return {
    ...form,
    tax_registration_number: lookup.gstin,
    name: displayName || form.name,
    legal_name: lookup.legalName ?? form.legal_name,
    tax_treatment: lookup.taxTreatment ?? form.tax_treatment,
    billing_address_line1: lookup.billingAddressLine1 ?? form.billing_address_line1,
    billing_city: lookup.billingCity ?? form.billing_city,
    billing_state: lookup.billingState ?? form.billing_state,
    billing_zip_postal: lookup.billingZipPostal ?? form.billing_zip_postal,
    billing_country_code: lookup.billingCountryCode || form.billing_country_code || "IN",
    ...shipping,
  };
}

export async function lookupGstinDetails(gstin: string): Promise<GstinLookupResult | null> {
  const validationError = validateGstin(gstin);
  if (validationError) return null;

  try {
    const response = await fetch(
      `/api/entities/gstin-lookup?gstin=${encodeURIComponent(normalizeGstin(gstin))}`,
      { method: "GET", headers: { Accept: "application/json" } }
    );

    if (!response.ok) return null;
    const payload = (await response.json()) as GstinLookupResult;
    if (!payload?.gstin) return null;
    return payload;
  } catch {
    return null;
  }
}
