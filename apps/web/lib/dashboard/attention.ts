import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMyApprovalTasks } from "@/lib/approvals/queries";
import type { ApprovalDocumentType, ApprovalTaskRow } from "@/lib/approvals/types";
import type { DashboardAttentionItem } from "@/lib/dashboard/types";
import { formatMoneyDetail } from "@/lib/procurement/math";
import { poListReturnHref } from "@/lib/procurement/navigation";
import { TRANSFERS_HREF } from "@/lib/inventory/transfers/navigation";
import {
  invoiceListReturnHref,
  quoteListReturnHref,
  soListReturnHref,
} from "@/lib/sales/navigation";

const ATTENTION_LIMIT = 8;

function resolveApprovalHref(task: ApprovalTaskRow): string {
  switch (task.document_type as ApprovalDocumentType) {
    case "PURCHASE_ORDER":
      return poListReturnHref(task.document_id);
    case "SALES_ORDER":
      return soListReturnHref(task.document_id);
    case "SALES_QUOTATION":
      return quoteListReturnHref(task.document_id);
    case "SALES_INVOICE":
      return invoiceListReturnHref(task.document_id);
    default:
      return "/approvals";
  }
}

function approvalItem(task: ApprovalTaskRow): DashboardAttentionItem {
  return {
    id: `approval-${task.run_id}-${task.step_id}`,
    kind: "APPROVAL",
    title: task.voucher_number ?? "Document",
    subtitle: task.party_name,
    amountLabel: formatMoneyDetail(task.amount_basis, task.currency_code),
    href: resolveApprovalHref(task),
    submittedAt: task.submitted_at || null,
  };
}

export async function fetchDashboardAttentionItems(
  supabase: SupabaseClient,
  tenantId: string,
  limit = ATTENTION_LIMIT
): Promise<DashboardAttentionItem[]> {
  const approvalLimit = Math.max(limit - 2, 4);

  const [approvalTasks, creditHoldResult, transferResult] = await Promise.all([
    fetchMyApprovalTasks(supabase, approvalLimit),
    supabase
      .from("sales_orders")
      .select(
        `
        id,
        voucher_number,
        total_net_amount,
        currency_code,
        updated_at,
        customer:entities!sales_orders_customer_tenant_fk (name)
      `
      )
      .eq("tenant_id", tenantId)
      .eq("commercial_status", "CREDIT_HOLD")
      .order("updated_at", { ascending: false })
      .limit(3),
    supabase
      .from("stock_transfers")
      .select("id, transfer_number, updated_at")
      .eq("tenant_id", tenantId)
      .eq("current_status", "PENDING_APPROVAL")
      .order("updated_at", { ascending: false })
      .limit(3),
  ]);

  const items: DashboardAttentionItem[] = approvalTasks.map(approvalItem);

  for (const row of creditHoldResult.data ?? []) {
    const customer = row.customer as { name?: string } | null;
    items.push({
      id: `credit-hold-${row.id as string}`,
      kind: "CREDIT_HOLD",
      title: (row.voucher_number as string) ?? "Sales order",
      subtitle: customer?.name ?? null,
      amountLabel: formatMoneyDetail(
        Number(row.total_net_amount) || 0,
        (row.currency_code as string) ?? ""
      ),
      href: soListReturnHref(row.id as string),
      submittedAt: (row.updated_at as string) ?? null,
    });
  }

  for (const row of transferResult.data ?? []) {
    items.push({
      id: `transfer-${row.id as string}`,
      kind: "TRANSFER_APPROVAL",
      title: (row.transfer_number as string) ?? "Stock transfer",
      subtitle: "Awaiting approval",
      amountLabel: null,
      href: `${TRANSFERS_HREF}?id=${encodeURIComponent(row.id as string)}`,
      submittedAt: (row.updated_at as string) ?? null,
    });
  }

  items.sort((a, b) => {
    const aTime = a.submittedAt ? Date.parse(a.submittedAt) : 0;
    const bTime = b.submittedAt ? Date.parse(b.submittedAt) : 0;
    return bTime - aTime;
  });

  return items.slice(0, limit);
}
