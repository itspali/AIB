export type ImportPortOption = {
  code: string;
  name: string;
  country: string;
};

/** Curated ports for import shipment dropdowns (ICEGATE-style codes where applicable). */
export const IMPORT_PORT_OPTIONS: ImportPortOption[] = [
  { code: "CNSHA", name: "Shanghai", country: "CN" },
  { code: "CNNGB", name: "Ningbo", country: "CN" },
  { code: "CNYTN", name: "Yantian / Shenzhen", country: "CN" },
  { code: "CNQDG", name: "Qingdao", country: "CN" },
  { code: "SGSIN", name: "Singapore", country: "SG" },
  { code: "HKHKG", name: "Hong Kong", country: "HK" },
  { code: "KRPUS", name: "Busan", country: "KR" },
  { code: "JPYOK", name: "Yokohama", country: "JP" },
  { code: "USLAX", name: "Los Angeles", country: "US" },
  { code: "USNYC", name: "New York", country: "US" },
  { code: "DEHAM", name: "Hamburg", country: "DE" },
  { code: "NLRTM", name: "Rotterdam", country: "NL" },
  { code: "INNSA", name: "Nhava Sheva (JNPT)", country: "IN" },
  { code: "INNSA1", name: "Nhava Sheva — customs (INNSA1)", country: "IN" },
  { code: "INMAA1", name: "Chennai — customs (INMAA1)", country: "IN" },
  { code: "INMAA", name: "Chennai port", country: "IN" },
  { code: "INMUN1", name: "Mundra — customs (INMUN1)", country: "IN" },
  { code: "INMUN", name: "Mundra port", country: "IN" },
  { code: "INCCU1", name: "Kolkata — customs (INCCU1)", country: "IN" },
  { code: "INBLR4", name: "Bangalore ICD", country: "IN" },
  { code: "INDEL4", name: "Delhi ICD", country: "IN" },
];

export const IMPORT_PORT_OTHER_VALUE = "__OTHER__";

export function formatImportPortLabel(port: ImportPortOption): string {
  return `${port.name} (${port.code})`;
}

export function findImportPortByCode(code: string): ImportPortOption | undefined {
  const normalized = code.trim().toUpperCase();
  return IMPORT_PORT_OPTIONS.find((port) => port.code.toUpperCase() === normalized);
}
