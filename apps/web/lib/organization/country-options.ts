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
