import type { SupabaseClient } from "@supabase/supabase-js";

type SalesApprovalDocumentType = "SALES_ORDER" | "SALES_INVOICE" | "SALES_QUOTATION";

export async function fetchApprovalWorkflowCompleteByDocumentId(
  supabase: SupabaseClient,
  tenantId: string,
  documentType: SalesApprovalDocumentType,
  documentIds: string[]
): Promise<Set<string>> {
  if (documentIds.length === 0) return new Set();

  const completeIds = new Set<string>();

  const [darResult, runResult] = await Promise.all([
    supabase
      .from("document_approval_requests")
      .select("document_id")
      .eq("tenant_id", tenantId)
      .eq("document_type", documentType)
      .eq("status", "APPROVED")
      .in("document_id", documentIds),
    supabase
      .from("document_approval_runs")
      .select("document_id")
      .eq("tenant_id", tenantId)
      .eq("document_type", documentType)
      .eq("status", "APPROVED")
      .in("document_id", documentIds),
  ]);

  for (const row of darResult.data ?? []) {
    completeIds.add(row.document_id as string);
  }
  for (const row of runResult.data ?? []) {
    completeIds.add(row.document_id as string);
  }

  return completeIds;
}
