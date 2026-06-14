"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SoDocumentEditorShell } from "@/components/sales/orders/so-document-editor-shell";
import { Button } from "@/components/ui/button";
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { LIST_MODULE_VIEWPORT_OFFSET } from "@/lib/layout/list-module-chrome";
import { useListModuleScrollLock } from "@/lib/layout/use-list-module-scroll-lock";
import { useAvailablePaneHeight } from "@/lib/layout/use-viewport-remaining-height";
import { soListReturnHref } from "@/lib/sales/navigation";
import { useSoMutateForm } from "@/lib/sales/orders/use-so-mutate-form";
import { cn } from "@/lib/utils";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

type Props = {
  mode: "create" | "edit";
  editOrderId?: string | null;
  copyFromId?: string | null;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  editAccessGranted: boolean;
  allowLineItemDiscounts: boolean;
  defaultCurrency: string;
  preferredShippingLocationId?: string | null;
};

export function SoDocumentPageShell({
  mode,
  editOrderId = null,
  copyFromId = null,
  locations,
  customers,
  editAccessGranted,
  allowLineItemDiscounts,
  defaultCurrency,
  preferredShippingLocationId = null,
}: Props) {
  const router = useRouter();
  const returnHref = soListReturnHref(editOrderId);

  const handleAfterSave = (salesOrderId: string) => {
    router.push(soListReturnHref(salesOrderId));
    router.refresh();
  };

  const handleEditNotAllowed = (salesOrderId: string) => {
    router.replace(soListReturnHref(salesOrderId));
  };

  const mutate = useSoMutateForm({
    mode,
    editOrderId,
    copyFromId,
    locations,
    customers,
    preferredShippingLocationId,
    editAccessGranted,
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
    mode === "create" ? "New sales order" : mutate.detail?.voucher_number ?? "Edit sales order";

  const lineTableFillHeight = true;
  const { ref: viewportRef, height: viewportHeight } = useAvailablePaneHeight(
    lineTableFillHeight,
    "remaining-viewport"
  );
  useListModuleScrollLock(lineTableFillHeight);

  return (
    <>
      <div
        ref={viewportRef}
        style={
          lineTableFillHeight && viewportHeight != null
            ? { height: viewportHeight, maxHeight: viewportHeight }
            : undefined
        }
        className={cn(
          "flex min-h-0 flex-col",
          lineTableFillHeight ? "overflow-hidden" : "h-full",
          lineTableFillHeight && LIST_MODULE_VIEWPORT_OFFSET
        )}
      >
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
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={mutate.isPending || locations.length === 0 || customers.length === 0}
              onClick={mutate.handleSaveDraft}
              title={`${mutate.saveActionLabel} (Ctrl+Enter)`}
            >
              {mutate.isPending ? "Saving…" : mutate.saveActionLabel}
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "canvas-scroll-endpad flex min-h-0 flex-1 flex-col p-4",
            lineTableFillHeight ? "overflow-hidden" : "overflow-auto"
          )}
        >
          {mutate.error ? (
            <UserFacingErrorMessage
              message={mutate.error}
              action={mutate.errorAction ?? undefined}
              className="mb-4 shrink-0"
            />
          ) : null}
          {mutate.detailLoading ? (
            <p className="text-sm text-muted-foreground">Loading sales order…</p>
          ) : (
            <SoDocumentEditorShell
              form={mutate.form}
              locations={locations}
              customers={customers}
              defaultCurrency={defaultCurrency}
              allowLineItemDiscounts={allowLineItemDiscounts}
              isPending={mutate.isPending}
              onPatch={mutate.patchForm}
              onLinesChange={mutate.setLines}
            />
          )}
        </div>
      </div>
      {discardDialog}
    </>
  );
}
