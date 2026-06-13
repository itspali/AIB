import type { DocumentPostingDocumentType } from "@/lib/documents/posting-types";

export type PostingStepDefinition = {
  id: string;
  label: string;
  description: string;
  documents: DocumentPostingDocumentType[];
};

export const POSTING_STEP_CATALOG: Record<string, PostingStepDefinition> = {
  po_header_saved: {
    id: "po_header_saved",
    label: "Order details saved",
    description: "Supplier, dates, and location were stored on this purchase order.",
    documents: ["PO"],
  },
  po_lines_saved: {
    id: "po_lines_saved",
    label: "Line items saved",
    description: "Quantities, rates, and items on this order were updated.",
    documents: ["PO"],
  },
  po_promo_lines_flagged: {
    id: "po_promo_lines_flagged",
    label: "Free goods marked",
    description: "Lines with zero rate were saved as promotional items linked to paid lines.",
    documents: ["PO"],
  },
  po_totals_calculated: {
    id: "po_totals_calculated",
    label: "Order totals calculated",
    description: "Subtotal, tax, and grand total were recalculated from the lines.",
    documents: ["PO"],
  },
  po_status_issued: {
    id: "po_status_issued",
    label: "Order sent to supplier",
    description: "This order is now issued and can be received on a goods receipt.",
    documents: ["PO"],
  },
  po_promo_commitments_created: {
    id: "po_promo_commitments_created",
    label: "Free goods commitments recorded",
    description: "Expected free quantities from this order were registered for tracking when stock arrives.",
    documents: ["PO"],
  },
  po_receipt_eligibility_opened: {
    id: "po_receipt_eligibility_opened",
    label: "Receiving enabled",
    description: "You can now create goods receipts against the quantities on this order.",
    documents: ["PO"],
  },
  grn_receipt_recorded: {
    id: "grn_receipt_recorded",
    label: "Receipt recorded",
    description: "This goods receipt was saved with receipt date, location, and line quantities.",
    documents: ["GRN"],
  },
  grn_quantities_received: {
    id: "grn_quantities_received",
    label: "Stock quantities updated",
    description: "Accepted quantities were added to inventory at the receiving location.",
    documents: ["GRN"],
  },
  grn_paid_stock_valued: {
    id: "grn_paid_stock_valued",
    label: "Paid stock cost applied",
    description: "Items you paid for were valued using the unit cost on this receipt and your average cost method.",
    documents: ["GRN"],
  },
  grn_free_stock_separated: {
    id: "grn_free_stock_separated",
    label: "Free goods kept separate",
    description: "Promotional or zero-cost lines were placed in a separate pool so they do not distort sellable stock value.",
    documents: ["GRN"],
  },
  grn_po_fulfillment_updated: {
    id: "grn_po_fulfillment_updated",
    label: "Order fulfillment updated",
    description: "Quantities received were applied against the linked purchase order so open balances stay accurate.",
    documents: ["GRN"],
  },
  grn_qc_quarantine_applied: {
    id: "grn_qc_quarantine_applied",
    label: "Quality hold applied",
    description: "Stock is held for inspection and is not available for sale until quality checks pass.",
    documents: ["GRN"],
  },
  grn_qc_released: {
    id: "grn_qc_released",
    label: "Quality inspection passed",
    description: "Inspection is complete and the receipt is cleared for normal use. Stock was already posted; this updates the receipt status only.",
    documents: ["GRN"],
  },
  grn_promo_bundle_cost_adjusted: {
    id: "grn_promo_bundle_cost_adjusted",
    label: "Bundle cost adjusted",
    description: "Because all free goods for this promotion were received, the average cost of paid units was recalculated.",
    documents: ["GRN"],
  },
  grn_entitlement_partial: {
    id: "grn_entitlement_partial",
    label: "Promotion partially received",
    description: "Part of the promised free goods arrived; the remainder can be received on a later receipt.",
    documents: ["GRN"],
  },
  grn_entitlement_closed: {
    id: "grn_entitlement_closed",
    label: "Promotion tracking completed",
    description: "All promised free goods for this deal were received; no further quantities are expected.",
    documents: ["GRN"],
  },
  grn_orphan_sample_quarantined: {
    id: "grn_orphan_sample_quarantined",
    label: "Sample stock quarantined",
    description: "This receipt had no purchase order; items were received as samples and are not available for normal resale.",
    documents: ["GRN"],
  },
  grn_landed_charges_allocated: {
    id: "grn_landed_charges_allocated",
    label: "Freight and charges allocated",
    description: "Extra costs such as freight or customs were spread across receipt lines using your allocation method.",
    documents: ["GRN"],
  },
  bill_invoice_recorded: {
    id: "bill_invoice_recorded",
    label: "Supplier invoice recorded",
    description: "Invoice number, date, and amounts were saved against your vendor account.",
    documents: ["BILL"],
  },
  bill_grn_linked: {
    id: "bill_grn_linked",
    label: "Receipts linked to invoice",
    description: "One or more goods receipts were tied to this invoice for quantity and cost matching.",
    documents: ["BILL"],
  },
  bill_three_way_match: {
    id: "bill_three_way_match",
    label: "Order, receipt, and invoice matched",
    description: "Quantities and rates were compared across the purchase order, receipts, and this invoice within your tolerance.",
    documents: ["BILL"],
  },
  bill_cost_variance_applied: {
    id: "bill_cost_variance_applied",
    label: "Price difference applied",
    description: "Where the invoice rate differed from the order, inventory value and expense were updated using your price variance rules.",
    documents: ["BILL"],
  },
  bill_on_hold: {
    id: "bill_on_hold",
    label: "Invoice placed on hold",
    description: "Matching failed or needs review; inventory and payables were not fully updated until resolved.",
    documents: ["BILL"],
  },
  bill_advance_applied: {
    id: "bill_advance_applied",
    label: "Advance payment applied",
    description: "A prior vendor advance was applied to reduce the amount due on this invoice.",
    documents: ["BILL"],
  },
  bill_payables_posted: {
    id: "bill_payables_posted",
    label: "Amount owed to supplier updated",
    description: "The balance due to this vendor was updated in accounts payable.",
    documents: ["BILL"],
  },
};

export function resolvePostingStepDefinition(stepId: string): PostingStepDefinition {
  return (
    POSTING_STEP_CATALOG[stepId] ?? {
      id: stepId,
      label: stepId.replace(/_/g, " "),
      description: "A system update was applied for this document.",
      documents: ["PO", "GRN", "BILL"],
    }
  );
}

export function postingStepsForDocument(
  documentType: DocumentPostingDocumentType
): PostingStepDefinition[] {
  return Object.values(POSTING_STEP_CATALOG).filter((step) =>
    step.documents.includes(documentType)
  );
}
