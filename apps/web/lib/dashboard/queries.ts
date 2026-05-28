import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardMetrics,
  TaxRateSlabRow,
  WorkspaceControls,
} from "@/lib/dashboard/types";
import {
  alignSeriesToSnapshot,
  buildUtcDayKeys,
  bucketDailyCount,
  bucketDailySum,
  toCumulativeSeries,
} from "@/lib/dashboard/sparkline";

async function countRows(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  filters: Record<string, string>
): Promise<number> {
  let query = supabase.from(table).select("*", { count: "exact", head: true }).eq("tenant_id", tenantId);
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

export async function fetchApprovalAlertCount(
  supabase: SupabaseClient,
  tenantId: string
): Promise<number> {
  const [salesPending, salesHold, purchasePending, transferPending] = await Promise.all([
    countRows(supabase, "sales_orders", tenantId, { commercial_status: "PENDING_APPROVAL" }),
    countRows(supabase, "sales_orders", tenantId, { commercial_status: "CREDIT_HOLD" }),
    countRows(supabase, "purchase_orders", tenantId, { document_status: "PENDING_APPROVAL" }),
    countRows(supabase, "stock_transfers", tenantId, { current_status: "PENDING_APPROVAL" }),
  ]);

  return salesPending + salesHold + purchasePending + transferPending;
}

export async function fetchDashboardMetrics(
  supabase: SupabaseClient,
  tenantId: string
): Promise<DashboardMetrics> {
  const [glResult, apResult, valuationResult, fullyPaid, dispatched, creditHold, glHistory, invHistory, orderHistory] =
    await Promise.all([
    supabase
      .from("general_ledger_entries")
      .select("debit_amount, credit_amount, created_at, accounts!inner(account_code)")
      .eq("tenant_id", tenantId)
      .eq("accounts.account_code", "1200-AR"),
    supabase
      .from("purchase_invoices")
      .select("total_liability_amount")
      .eq("tenant_id", tenantId)
      .eq("is_paid", false),
    supabase
      .from("item_valuations")
      .select("total_quantity_on_hand, current_average_cost")
      .eq("tenant_id", tenantId),
    countRows(supabase, "sales_orders", tenantId, { payment_status: "FULLY_PAID" }),
    countRows(supabase, "sales_orders", tenantId, { fulfillment_status: "DISPATCHED_IN_TRANSIT" }),
    countRows(supabase, "sales_orders", tenantId, { commercial_status: "CREDIT_HOLD" }),
    supabase
      .from("general_ledger_entries")
      .select("debit_amount, credit_amount, created_at, accounts!inner(account_code)")
      .eq("tenant_id", tenantId)
      .eq("accounts.account_code", "1200-AR")
      .order("created_at", { ascending: true }),
    supabase
      .from("inventory_ledger")
      .select("quantity, cost_at_transaction, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
    supabase
      .from("sales_orders")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true }),
  ]);

  let arNet = 0;
  if (!glResult.error && glResult.data) {
    for (const row of glResult.data) {
      arNet += Number(row.debit_amount) - Number(row.credit_amount);
    }
  }

  let apOutstanding = 0;
  if (!apResult.error && apResult.data) {
    for (const row of apResult.data) {
      apOutstanding += Number(row.total_liability_amount);
    }
  }

  let inventoryValuation = 0;
  if (!valuationResult.error && valuationResult.data) {
    for (const row of valuationResult.data) {
      inventoryValuation +=
        Number(row.total_quantity_on_hand) * Number(row.current_average_cost);
    }
  }

  const netCapitalExposure = arNet - apOutstanding;
  const pipelineTotal = fullyPaid + dispatched + creditHold;
  const dayKeys = buildUtcDayKeys();

  const arDailyRows =
    !glHistory.error && glHistory.data
      ? glHistory.data.map((row) => ({
          created_at: row.created_at as string,
          amount: Number(row.debit_amount) - Number(row.credit_amount),
        }))
      : [];

  const invDailyRows =
    !invHistory.error && invHistory.data
      ? invHistory.data.map((row) => ({
          created_at: row.created_at as string,
          amount: Math.abs(Number(row.quantity) * Number(row.cost_at_transaction)),
        }))
      : [];

  const orderDailyRows =
    !orderHistory.error && orderHistory.data
      ? orderHistory.data.map((row) => ({ created_at: row.created_at as string }))
      : [];

  const netCapitalSpark = alignSeriesToSnapshot(
    toCumulativeSeries(bucketDailySum(arDailyRows, dayKeys)),
    netCapitalExposure
  );
  const inventorySpark = alignSeriesToSnapshot(
    toCumulativeSeries(bucketDailySum(invDailyRows, dayKeys)),
    inventoryValuation
  );
  const pipelineSpark = alignSeriesToSnapshot(
    toCumulativeSeries(bucketDailyCount(orderDailyRows, dayKeys)),
    pipelineTotal
  );

  return {
    netCapitalExposure,
    inventoryValuation,
    pipelineCounts: {
      fullyPaid,
      dispatchedInTransit: dispatched,
      creditHold,
    },
    sparklines: {
      netCapital: netCapitalSpark,
      inventory: inventorySpark,
      pipeline: pipelineSpark,
    },
  };
}

export async function fetchWorkspaceControls(
  supabase: SupabaseClient,
  tenantId: string
): Promise<WorkspaceControls> {
  const { data } = await supabase
    .from("workspace_control_registry")
    .select("registry_key, configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .in("registry_key", ["SALES_SETTINGS", "FINANCIAL_SETTINGS"]);

  let allowLineItemDiscounts = true;
  let accountingPeriodClosingDate: string | null = null;

  for (const row of data ?? []) {
    const meta = row.configuration_metadata as Record<string, unknown>;
    if (row.registry_key === "SALES_SETTINGS") {
      const flag = meta?.allow_line_item_discounts;
      if (typeof flag === "boolean") allowLineItemDiscounts = flag;
    }
    if (row.registry_key === "FINANCIAL_SETTINGS") {
      const dateVal = meta?.accounting_period_closing_date;
      if (typeof dateVal === "string" && dateVal.length > 0) {
        accountingPeriodClosingDate = dateVal;
      }
    }
  }

  return { allowLineItemDiscounts, accountingPeriodClosingDate };
}

export async function fetchTaxRateRegistry(
  supabase: SupabaseClient,
  tenantId: string
): Promise<TaxRateSlabRow[]> {
  const { data, error } = await supabase
    .from("tax_rate_registry")
    .select(
      "id, tax_component_name, tax_percentage, active_from_date, active_to_date, legal_compliance_code"
    )
    .eq("tenant_id", tenantId)
    .order("active_from_date", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    tax_component_name: row.tax_component_name,
    tax_percentage: Number(row.tax_percentage),
    active_from_date: row.active_from_date,
    active_to_date: row.active_to_date,
    legal_compliance_code: row.legal_compliance_code,
  }));
}
