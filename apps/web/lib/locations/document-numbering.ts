import { NAMING_SEQUENCE_KEYS } from "@/lib/organization/naming-options";
import type { DocumentSequenceRow } from "@/lib/organization/types";
import type { NamingSequenceEntry } from "@/lib/naming/sequences";
import type { LocationFormValues, LocationRow } from "@/lib/locations/types";

export type LocationNumberingCapabilities = Pick<
  LocationRow,
  "is_stock_holding" | "is_commercial_storefront" | "is_administrative_office"
>;

const STOCK_HOLDING_VOUCHER_KEYS = [
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "STOCK_TRANSFER",
  "STOCK_ADJUSTMENT",
] as const;

const STOREFRONT_VOUCHER_KEYS = [
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
  "CUSTOMER_PAYMENT",
  "SALES_CREDIT_NOTE",
] as const;

const ADMIN_OFFICE_VOUCHER_KEYS = ["GENERAL_LEDGER"] as const;

export type DocumentNumberingKey = (typeof NAMING_SEQUENCE_KEYS)[number];

export function getLocationDocumentNumberingKeys(
  location: LocationNumberingCapabilities
): DocumentNumberingKey[] {
  const keys: DocumentNumberingKey[] = [];

  if (location.is_stock_holding) {
    keys.push(...STOCK_HOLDING_VOUCHER_KEYS);
  }
  if (location.is_commercial_storefront) {
    keys.push(...STOREFRONT_VOUCHER_KEYS);
  }
  if (location.is_administrative_office) {
    keys.push(...ADMIN_OFFICE_VOUCHER_KEYS);
  }

  return NAMING_SEQUENCE_KEYS.filter((key) => keys.includes(key));
}

export function locationHasDocumentNumbering(location: LocationNumberingCapabilities): boolean {
  return getLocationDocumentNumberingKeys(location).length > 0;
}

export function filterNamingSequencesToKeys(
  sequences: Record<string, NamingSequenceEntry>,
  keys: readonly string[]
): Record<string, NamingSequenceEntry> {
  const allowed = new Set(keys);
  return Object.fromEntries(
    Object.entries(sequences).filter(([key]) => allowed.has(key))
  ) as Record<string, NamingSequenceEntry>;
}

export function mergeDocumentSequenceCounters(
  sequences: Record<string, NamingSequenceEntry>,
  documentSequences: readonly DocumentSequenceRow[]
): Record<string, NamingSequenceEntry> {
  const next = { ...sequences };

  for (const row of documentSequences) {
    if (!next[row.voucher_type]) continue;
    next[row.voucher_type] = {
      ...next[row.voucher_type],
      next: String(row.next_value),
    };
  }

  return next;
}

export function filterLocationFormNamingSequences(
  values: Pick<
    LocationFormValues,
    | "naming_sequences"
    | "is_stock_holding"
    | "is_commercial_storefront"
    | "is_administrative_office"
  >
): Record<string, NamingSequenceEntry> {
  const keys = getLocationDocumentNumberingKeys(values);
  return filterNamingSequencesToKeys(values.naming_sequences, keys);
}
