export type PostalAddressInput = {
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  zip_postal?: string | null;
  country_code?: string | null;
};

export function formatPostalAddressLines(input: PostalAddressInput): string[] {
  const lines: string[] = [];

  const line1 = input.address_line1?.trim();
  const line2 = input.address_line2?.trim();
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);

  const city = input.city?.trim() ?? "";
  const state = input.state?.trim() ?? "";
  const zip = input.zip_postal?.trim() ?? "";
  const locality = [city, state].filter(Boolean).join(", ");
  const cityLine = [locality, zip].filter(Boolean).join(" ").trim();
  if (cityLine) lines.push(cityLine);

  const country = input.country_code?.trim();
  if (country) lines.push(country);

  return lines;
}

export function hasPostalAddress(input: PostalAddressInput): boolean {
  return formatPostalAddressLines(input).length > 0;
}
