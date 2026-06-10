"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  PO_FULL_PAGE_LAYOUT,
  PoDocumentEditorShell,
} from "@/components/procurement/purchase-orders/po-document-editor-shell";
import { PoVoucherNumberField } from "@/components/procurement/purchase-orders/po-voucher-number-field";
import { Button } from "@/components/ui/button";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import { poListReturnHref } from "@/lib/procurement/navigation";
import { usePoMutateForm } from "@/lib/procurement/purchase-orders/use-po-mutate-form";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";

type Props = {
  mode: "create" | "edit";
  editOrderId?: string | null;
  copyFromId?: string | null;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  editAccessGranted: boolean;
  allowEditIssuedPurchaseOrders: boolean;
  allowLineItemDiscounts: boolean;
  purchasePricesTaxInclusive: boolean;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  preferredDestinationLocationId?: string | null;
  organizationBillTo: OrganizationBillToSnapshot;
};

export function PoDocumentPageShell({
  mode,
  editOrderId = null,
  copyFromId = null,
  locations,
  suppliers,
  editAccessGranted,
  allowEditIssuedPurchaseOrders,
  allowLineItemDiscounts,
  purchasePricesTaxInclusive,
  defaultCurrency,
  documentLayout,
  preferredDestinationLocationId = null,
}: Props) {
  const router = useRouter();
  const returnHref = poListReturnHref(editOrderId);

  const handleAfterSave = (purchaseOrderId: string) => {
    router.push(poListReturnHref(purchaseOrderId));
    router.refresh();
  };

  const handleEditNotAllowed = (purchaseOrderId: string) => {
    router.replace(poListReturnHref(purchaseOrderId));
  };

  const mutate = usePoMutateForm({
    mode,
    editOrderId,
    copyFromId,
    locations,
    suppliers,
    defaultCurrency,
    preferredDestinationLocationId,
    editAccessGranted,
    allowEditIssuedPurchaseOrders,
    onAfterSave: handleAfterSave,
    onEditNotAllowed: mode === "edit" ? handleEditNotAllowed : undefined,
  });

  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: mutate.isDirty,
  });

  const handleBack = () => {
    if (mutate.isDirty) {
      requestClose(() => router.push(returnHref));
      return;
    }
    router.push(returnHref);
  };

  const title =
    mode === "create"
      ? "New purchase order"
      : mutate.detail?.voucher_number ?? "Edit purchase order";

  const showEditor = !mutate.detailLoading;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={handleBack}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden />
            Back to list
          </Button>
          <div className="min-w-0 flex-1">
            {mutate.purchaseOrderId && mutate.detail?.voucher_number ? (
              <PoVoucherNumberField
                variant="header"
                value={mutate.detail.voucher_number}
                canEdit={mutate.canEditVoucherNumber}
                disabled={mutate.isPending}
                onSave={mutate.handleSaveVoucherNumber}
              />
            ) : (
              <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={mutate.isPending || locations.length === 0 || suppliers.length === 0}
              onClick={mutate.handleSaveDraft}
              title={`${mutate.saveActionLabel} (Ctrl+Enter)`}
            >
              {mutate.isPending ? "Saving…" : mutate.saveActionLabel}
            </Button>
            {mutate.isDraftOrder && mutate.purchaseOrderId ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={mutate.isPending}
                onClick={mutate.handleIssue}
              >
                Issue
              </Button>
            ) : null}
          </div>
        </div>

        <div className="canvas-scroll-endpad flex min-h-0 flex-1 flex-col overflow-auto p-4">
          {mutate.error ? (
            <UserFacingErrorMessage
              message={mutate.error}
              action={mutate.errorAction ?? undefined}
              className="mb-4 shrink-0"
            />
          ) : null}
          {mutate.detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading purchase order…</p>
          ) : null}
          {showEditor ? (
            <PoDocumentEditorShell
              form={mutate.form}
              locations={locations}
              suppliers={suppliers}
              editOrderId={mutate.purchaseOrderId}
              defaultCurrency={defaultCurrency}
              documentLayout={documentLayout}
              allowLineItemDiscounts={allowLineItemDiscounts}
              purchasePricesTaxInclusive={purchasePricesTaxInclusive}
              isPending={mutate.isPending}
              layoutOverride={PO_FULL_PAGE_LAYOUT}
              onPatch={mutate.patchForm}
              onLinesChange={mutate.handleLinesChange}
            />
          ) : null}
        </div>
      </div>
      {discardDialog}
    </>
  );
}
