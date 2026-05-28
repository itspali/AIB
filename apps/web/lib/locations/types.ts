import type { OrganizationLocationGovernanceConfig } from "@/lib/organization/types";

export const ENTERPRISE_LOCATION_TYPES = [
  "GLOBAL_HQ",
  "SUBCONTINENTAL_HQ",
  "COUNTRY_HQ",
  "REGIONAL_ZONE",
  "STATE_HQ",
  "STORAGE_WAREHOUSE",
  "OFFICE_BRANCH",
  "VIRTUAL_STOREFRONT",
] as const;

export const LEGACY_LOCATION_TYPES = [
  "HEAD_OFFICE",
  "REGIONAL_HQ",
  "WAREHOUSE",
  "MANUFACTURING_PLANT",
  "RETAIL_OUTLET",
] as const;

export type EnterpriseLocationType = (typeof ENTERPRISE_LOCATION_TYPES)[number];
export type LegacyLocationType = (typeof LEGACY_LOCATION_TYPES)[number];
export type LocationOperationalType = EnterpriseLocationType | LegacyLocationType;

export type LocationRow = {
  id: string;
  parent_location_id: string | null;
  name: string;
  code: string;
  location_type: LocationOperationalType;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_postal: string;
  country_code: string;
  manager_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_stock_holding: boolean;
  is_active: boolean;
  location_tax_identifier: string | null;
  tax_registered_name: string | null;
  location_meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type LocationTopologyRow = {
  id: string;
  parent_location_id: string | null;
  name: string;
  code: string;
  location_type: LocationOperationalType;
  is_stock_holding: boolean;
  is_active: boolean;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_postal: string;
  country_code: string;
  manager_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  depth: number;
  path: string[];
  child_count: number;
};

export type LocationTreeNode = LocationTopologyRow & {
  children: LocationTreeNode[];
};

export type LocationGovernanceSnapshot = OrganizationLocationGovernanceConfig;

export type LocationModuleContext = {
  governance: LocationGovernanceSnapshot;
  centralHqLocationId: string | null;
  canManage: boolean;
};

export type LocationFormValues = {
  location_id: string | null;
  name: string;
  code: string;
  location_type: LocationOperationalType;
  parent_location_id: string | null;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  zip_postal: string;
  country_code: string;
  manager_name: string;
  contact_email: string;
  contact_phone: string;
  is_stock_holding: boolean;
  location_tax_identifier: string;
  tax_registered_name: string;
  show_advanced: boolean;
};

export type LocationTagVariant = "administrative" | "completed" | "active";
