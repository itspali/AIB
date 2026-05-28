import type { OrganizationLocationGovernanceConfig } from "@/lib/organization/types";

export const PRESENCE_ENVIRONMENTS = ["PHYSICAL", "VIRTUAL"] as const;

export type PresenceEnvironment = (typeof PRESENCE_ENVIRONMENTS)[number];

export type LocationRow = {
  id: string;
  parent_location_id: string | null;
  name: string;
  code: string;
  presence_type: PresenceEnvironment;
  is_administrative_office: boolean;
  is_commercial_storefront: boolean;
  is_manufacturing_floor: boolean;
  is_stock_holding: boolean;
  pos_terminal_count: number;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_postal: string;
  country_code: string;
  manager_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
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
  presence_type: PresenceEnvironment;
  is_administrative_office: boolean;
  is_commercial_storefront: boolean;
  is_manufacturing_floor: boolean;
  is_stock_holding: boolean;
  pos_terminal_count: number;
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
  presence_type: PresenceEnvironment;
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
  is_administrative_office: boolean;
  is_commercial_storefront: boolean;
  is_manufacturing_floor: boolean;
  is_stock_holding: boolean;
  pos_terminal_count: number;
  location_tax_identifier: string;
  tax_registered_name: string;
  show_advanced: boolean;
};

export type LocationTagVariant = "administrative" | "completed" | "active";
