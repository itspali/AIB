export const COUNTRY_OPTIONS = [
  "US",
  "IN",
  "GB",
  "DE",
  "FR",
  "CA",
  "AU",
  "SG",
  "AE",
  "JP",
] as const;

export type CountryCode = (typeof COUNTRY_OPTIONS)[number];

export const COUNTRY_LABELS: Record<CountryCode, string> = {
  US: "United States",
  IN: "India",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
  AE: "United Arab Emirates",
  JP: "Japan",
};

export function countryLabel(code: string): string {
  return COUNTRY_LABELS[code as CountryCode] ?? code;
}
