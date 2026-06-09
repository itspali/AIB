import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { ENTITY_LIST_PAGE_SIZE } from "@/lib/entities/list-page-size";
import type { EntityListRow, EntityWorkspace, PartyNatureType } from "@/lib/entities/types";
import {
  isEntityCommercialType,
  isPartyNatureType,
  isTaxTreatmentType,
} from "@/lib/entities/types";

const DEFAULT_PAGE_SIZE = ENTITY_LIST_PAGE_SIZE;

type EntityListRpcRow = {
  id: string;
  name: string;
  legal_name: string | null;
  code: string | null;
  type: string;
  party_nature: string;
  tax_treatment: string;
  tax_registration_number: string | null;
  customer_category_id: string | null;
  customer_category_name: string | null;
  supplier_category_id: string | null;
  supplier_category_name: string | null;
  credit_limit: number | string | null;
  current_balance: number | string | null;
  payment_terms_days: number | string | null;
  company_email: string | null;
  company_phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  total_count: number | string | null;
};

export type EntityListPage = {
  rows: EntityListRow[];
  totalCount: number;
  pageSize: number;
  hasMore: boolean;
};

export type EntityListFetchOptions = {
  offset?: number;
  limit?: number;
  search?: string | null;
  activeOnly?: boolean | null;
  partyNature?: PartyNatureType | null;
  customerCategoryId?: string | null;
  supplierCategoryId?: string | null;
};

function formatDecimal(value: number | string | null | undefined, fallback = "0"): string {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function mapEntityListRow(row: EntityListRpcRow): EntityListRow | null {
  const partyNature = String(row.party_nature ?? "ORGANIZATION");
  if (
    !isEntityCommercialType(row.type) ||
    !isTaxTreatmentType(row.tax_treatment) ||
    !isPartyNatureType(partyNature)
  ) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    legal_name: row.legal_name,
    code: row.code,
    type: row.type,
    party_nature: partyNature,
    tax_treatment: row.tax_treatment,
    tax_registration_number: row.tax_registration_number,
    customer_category_id: row.customer_category_id,
    customer_category_name: row.customer_category_name,
    supplier_category_id: row.supplier_category_id,
    supplier_category_name: row.supplier_category_name,
    credit_limit: formatDecimal(row.credit_limit),
    current_balance: formatDecimal(row.current_balance),
    payment_terms_days: Number(row.payment_terms_days) || 0,
    company_email: row.company_email,
    company_phone: row.company_phone,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    primary_contact_name: row.primary_contact_name,
    primary_contact_email: row.primary_contact_email,
  };
}

export async function fetchEntityListPage(
  supabase: SupabaseClient,
  workspace: EntityWorkspace,
  options?: EntityListFetchOptions
): Promise<EntityListPage> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? DEFAULT_PAGE_SIZE;

  const { data, error } = await supabase.rpc("fetch_entity_list_page", {
    p_workspace: workspace,
    p_offset: offset,
    p_limit: limit,
    p_search: options?.search ?? null,
    p_active_only: options?.activeOnly ?? null,
    p_party_nature: options?.partyNature ?? null,
    p_customer_category_id: options?.customerCategoryId ?? null,
    p_supplier_category_id: options?.supplierCategoryId ?? null,
  });

  if (error) {
    console.warn("[entities] fetch_entity_list_page unavailable:", error.message);
    return {
      rows: [],
      totalCount: 0,
      pageSize: limit,
      hasMore: false,
    };
  }

  const rpcRows = (data ?? []) as EntityListRpcRow[];
  const mapped = rpcRows
    .map((row) => mapEntityListRow(row))
    .filter((row): row is EntityListRow => row !== null);

  const totalCountRaw = rpcRows[0]?.total_count;
  const totalCount =
    totalCountRaw != null ? Number(totalCountRaw) || 0 : mapped.length;

  return {
    rows: mapped,
    totalCount,
    pageSize: limit,
    hasMore: offset + mapped.length < totalCount,
  };
}

export { ENTITY_LIST_PAGE_SIZE } from "@/lib/entities/list-page-size";
