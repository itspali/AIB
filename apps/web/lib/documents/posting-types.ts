export type PostingStepStatus = "success" | "failure" | "skipped" | "not_run";

export type PostingStepResult = {
  id: string;
  status: PostingStepStatus;
  detail?: string | null;
};

export type DocumentPostingDocumentType = "PO" | "GRN" | "BILL" | "SO" | "QUOTE" | "INVOICE";

export type DocumentPostingRun = {
  id: string;
  document_type: DocumentPostingDocumentType;
  document_id: string;
  overall_status: "success" | "failure";
  steps: PostingStepResult[];
  posted_at: string;
};

export type PostGoodsReceiptRpcResult = {
  goods_receipt_id: string;
  steps: PostingStepResult[];
};

export type IssuePurchaseOrderRpcResult = {
  purchase_order_id: string;
  steps: PostingStepResult[];
};

export type SavePurchaseInvoiceRpcResult = {
  purchase_invoice_id: string;
  steps: PostingStepResult[];
};
