export type SalesPartyAddress = {
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_postal: string | null;
  country_code: string | null;
  tax_identifier: string | null;
};

export type SalesAddressBlockKind = "bill_to" | "ship_to";

export type SalesAddressBlock = {
  kind: SalesAddressBlockKind;
  title: string;
  name: string;
  lines: string[];
  tax_identifier: string | null;
};

export function formatSalesPartyAddressLines(address: SalesPartyAddress | null): string[] {
  if (!address) return [];
  const lines: string[] = [];
  if (address.address_line1) lines.push(address.address_line1);
  if (address.address_line2) lines.push(address.address_line2);
  const cityLine = [address.city, address.state, address.zip_postal].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  if (address.country_code) lines.push(address.country_code);
  return lines;
}

export function hasSalesPartyAddressContent(address: SalesPartyAddress | null): boolean {
  if (!address) return false;
  return (
    Boolean(address.name?.trim()) ||
    Boolean(address.address_line1?.trim()) ||
    Boolean(address.address_line2?.trim()) ||
    Boolean(address.city?.trim()) ||
    Boolean(address.state?.trim()) ||
    Boolean(address.zip_postal?.trim()) ||
    Boolean(address.country_code?.trim()) ||
    Boolean(address.tax_identifier?.trim())
  );
}

export function toSalesAddressBlock(
  kind: SalesAddressBlockKind,
  title: string,
  address: SalesPartyAddress | null,
  supplyState?: string | null
): SalesAddressBlock | null {
  const state = supplyState?.trim() || null;
  const hasAddress = address && hasSalesPartyAddressContent(address);
  if (!hasAddress && !state) return null;

  const lines = hasAddress ? formatSalesPartyAddressLines(address) : [];
  if (state) {
    lines.push(`State: ${state}`);
  }

  return {
    kind,
    title,
    name: address?.name?.trim() || "—",
    lines,
    tax_identifier: address?.tax_identifier?.trim() || null,
  };
}
