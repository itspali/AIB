import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentPostingRun, PostingStepResult } from "@/lib/documents/posting-types";

function parsePostingSteps(raw: unknown): PostingStepResult[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const id = typeof row.id === "string" ? row.id : null;
      const status = row.status;
      if (
        !id ||
        status !== "success" &&
        status !== "failure" &&
        status !== "skipped" &&
        status !== "not_run"
      ) {
        return null;
      }
      return {
        id,
        status,
        detail: typeof row.detail === "string" ? row.detail : null,
      } satisfies PostingStepResult;
    })
    .filter((step): step is NonNullable<typeof step> => step !== null);
}

export async function fetchLatestDocumentPostingRun(
  supabase: SupabaseClient,
  documentType: "PO" | "GRN" | "BILL",
  documentId: string
): Promise<DocumentPostingRun | null> {
  const { data, error } = await supabase.rpc("fetch_document_posting_runs", {
    p_document_type: documentType,
    p_document_id: documentId,
  });

  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object") return null;

  const record = row as Record<string, unknown>;
  return {
    id: String(record.id),
    document_type: documentType,
    document_id: documentId,
    overall_status: record.overall_status === "failure" ? "failure" : "success",
    steps: parsePostingSteps(record.steps),
    posted_at: String(record.posted_at ?? ""),
  };
}

export function parsePostGoodsReceiptRpcResult(raw: unknown): {
  goodsReceiptId: string;
  steps: PostingStepResult[];
} | null {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string") {
      return { goodsReceiptId: raw, steps: [] };
    }
    return null;
  }

  const payload = raw as Record<string, unknown>;
  const goodsReceiptId =
    typeof payload.goods_receipt_id === "string"
      ? payload.goods_receipt_id
      : typeof payload.goodsReceiptId === "string"
        ? payload.goodsReceiptId
        : null;

  if (!goodsReceiptId) return null;

  return {
    goodsReceiptId,
    steps: parsePostingSteps(payload.steps),
  };
}

export function parseIssuePurchaseOrderRpcResult(raw: unknown): {
  purchaseOrderId: string;
  steps: PostingStepResult[];
} | null {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string") {
      return { purchaseOrderId: raw, steps: [] };
    }
    return null;
  }

  const payload = raw as Record<string, unknown>;
  const purchaseOrderId =
    typeof payload.purchase_order_id === "string"
      ? payload.purchase_order_id
      : typeof payload.purchaseOrderId === "string"
        ? payload.purchaseOrderId
        : null;

  if (!purchaseOrderId) return null;

  return {
    purchaseOrderId,
    steps: parsePostingSteps(payload.steps),
  };
}

export function parseSavePurchaseInvoiceRpcResult(raw: unknown): {
  purchaseInvoiceId: string;
  steps: PostingStepResult[];
} | null {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string") {
      return { purchaseInvoiceId: raw, steps: [] };
    }
    return null;
  }

  const payload = raw as Record<string, unknown>;
  const purchaseInvoiceId =
    typeof payload.purchase_invoice_id === "string"
      ? payload.purchase_invoice_id
      : typeof payload.purchaseInvoiceId === "string"
        ? payload.purchaseInvoiceId
        : null;

  if (!purchaseInvoiceId) return null;

  return {
    purchaseInvoiceId,
    steps: parsePostingSteps(payload.steps),
  };
}
