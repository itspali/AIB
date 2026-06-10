"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadPurchaseOrders } from "@/app/procurement/purchase-orders/actions";
import { PoDrawerForm } from "@/components/procurement/purchase-orders/po-drawer-form";
import { PoEmptyState } from "@/components/procurement/purchase-orders/po-empty-state";
import { PoListTable } from "@/components/procurement/purchase-orders/po-list-table";
import { PoListToolbar } from "@/components/procurement/purchase-orders/po-list-toolbar";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  getDefaultPurchaseOrderListPrefs,
  loadPurchaseOrderListPrefs,
  savePurchaseOrderListPrefs,
  setPurchaseOrderColumnWidth,
  type PurchaseOrderListPrefs,
} from "@/lib/procurement/purchase-orders/list-prefs";
import {
  sortPurchaseOrderListRows,
  type PurchaseOrderListSortDirection,
  type PurchaseOrderListSortField,
} from "@/lib/procurement/purchase-orders/list-sort";
import { PROCUREMENT_PO_HREF, PO_COPY_FROM_PARAM } from "@/lib/procurement/navigation";
import { canEditPurchaseOrderDocument } from "@/lib/procurement/access";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { useFilteredPurchaseOrders } from "@/lib/procurement/purchase-orders/use-filtered-purchase-orders";
import type {
  ProcurementLocationOption,
  ProcurementSupplierOption,
} from "@/lib/procurement/shared/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import { useLivePoDocumentLayout } from "@/lib/documents/use-live-po-document-layout";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type { OrganizationBillToSnapshot } from "@/lib/procurement/purchase-orders/organization-bill-to";

const PO_PAGE_DESCRIPTION =
  "Raise draft purchase orders, issue them to suppliers, and receive stock on goods receipts.";

type Props = {
  initialPurchaseOrders: PurchaseOrderRow[];
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  editAccessGranted: boolean;
  allowEditIssuedPurchaseOrders: boolean;
  allowLineItemDiscounts: boolean;
  defaultCurrency: string;
  documentLayout: DocumentLayoutTemplate;
  preferredDestinationLocationId?: string | null;
  organizationBillTo: OrganizationBillToSnapshot;
};

export function PoManagementTerminal({
  initialPurchaseOrders,
  locations,
  suppliers,
  editAccessGranted,
  allowEditIssuedPurchaseOrders,
  allowLineItemDiscounts,
  defaultCurrency,
  documentLayout: initialDocumentLayout,
  preferredDestinationLocationId = null,
  organizationBillTo,
}: Props) {
  const searchParams = useSearchParams();
  const drawer = useModuleDrawerUrl(PROCUREMENT_PO_HREF, {
    clearParamsOnClose: [PO_COPY_FROM_PARAM],
  });
  const copyFromId = useMemo(() => {
    if (drawer.surface !== "create") return null;
    return searchParams.get(PO_COPY_FROM_PARAM)?.trim() || null;
  }, [drawer.surface, searchParams]);
  const documentLayout = useLivePoDocumentLayout(initialDocumentLayout, {
    refreshWhen: drawer.isOpen,
  });
  const [purchaseOrders, setPurchaseOrders] = useState(initialPurchaseOrders);
  const [prefs, setPrefs] = useState<PurchaseOrderListPrefs>(getDefaultPurchaseOrderListPrefs);
  const [prefsHydrated, setPrefsHydrated] = useState(false);
  const [, startRefreshTransition] = useTransition();

  useEffect(() => {
    setPrefs(loadPurchaseOrderListPrefs());
    setPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!prefsHydrated) return;
    savePurchaseOrderListPrefs(prefs);
  }, [prefs, prefsHydrated]);

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const nextOrders = await loadPurchaseOrders();
        setPurchaseOrders(nextOrders);
      } catch (error) {
        console.error("[PoManagementTerminal] refresh failed", error);
        toast.error(
          error instanceof Error ? error.message : "Unable to refresh purchase orders."
        );
      }
    });
  }, []);

  const ordersView = useFilteredPurchaseOrders(purchaseOrders, prefs);

  const selectedId = drawer.recordId;
  const peekOrder =
    selectedId != null && drawer.surface === "peek"
      ? (purchaseOrders.find((row) => row.id === selectedId) ?? null)
      : null;

  const editOrderId =
    drawer.surface === "edit" && drawer.recordId ? drawer.recordId : null;

  const handleSelect = useCallback(
    (purchaseOrderId: string) => {
      drawer.openPeek(purchaseOrderId);
    },
    [drawer]
  );

  const handleAfterSave = useCallback(
    (purchaseOrderId: string) => {
      refreshList();
      drawer.afterSave(purchaseOrderId);
    },
    [drawer, refreshList]
  );

  const handleOpenEdit = useCallback(
    (purchaseOrderId: string) => {
      const order = purchaseOrders.find((row) => row.id === purchaseOrderId);
      if (
        order &&
        !canEditPurchaseOrderDocument(order.document_status, {
          allowEditIssued: allowEditIssuedPurchaseOrders,
          hasEditPermission: editAccessGranted,
        })
      ) {
        drawer.openPeek(purchaseOrderId);
        return;
      }
      drawer.openEdit(purchaseOrderId);
    },
    [allowEditIssuedPurchaseOrders, drawer, editAccessGranted, purchaseOrders]
  );

  const handleEditNotAllowed = useCallback(
    (purchaseOrderId: string) => {
      drawer.openPeek(purchaseOrderId);
    },
    [drawer]
  );

  const handleDuplicate = useCallback(
    (purchaseOrderId: string) => {
      drawer.openCreate({
        extraParams: { [PO_COPY_FROM_PARAM]: purchaseOrderId },
      });
    },
    [drawer]
  );

  useEffect(() => {
    if (!editAccessGranted && drawer.surface === "create") {
      drawer.close();
    }
  }, [drawer.surface, drawer.close, editAccessGranted]);

  useEffect(() => {
    if (!editAccessGranted && drawer.surface === "edit") {
      if (drawer.recordId) {
        drawer.openPeek(drawer.recordId);
      } else {
        drawer.close();
      }
    }
  }, [drawer.surface, drawer.recordId, drawer.openPeek, drawer.close, editAccessGranted]);

  const hasAnyData = purchaseOrders.length > 0;
  const filteredRows = ordersView.filteredRows;

  const sortedRows = useMemo(
    () => sortPurchaseOrderListRows(filteredRows, prefs.sortField, prefs.sortDirection),
    [filteredRows, prefs.sortDirection, prefs.sortField]
  );

  const handleSortChange = useCallback(
    (field: PurchaseOrderListSortField, direction: PurchaseOrderListSortDirection) => {
      setPrefs((current) => ({ ...current, sortField: field, sortDirection: direction }));
    },
    []
  );

  const listPrimary = !hasAnyData ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <PoEmptyState
        onCreate={editAccessGranted ? drawer.openCreate : undefined}
        hasLocations={locations.length > 0}
        hasSuppliers={suppliers.length > 0}
      />
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
      <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
        No purchase orders match the current filters.
      </div>
    </div>
  ) : (
    <PoListTable
      rows={sortedRows}
      columnPrefs={prefs.columnPrefs}
      sortField={prefs.sortField}
      sortDirection={prefs.sortDirection}
      frozenColumnCount={prefs.frozenColumnCount}
      onSortChange={handleSortChange}
      onColumnWidthChange={(columnId, width) =>
        setPrefs((current) => setPurchaseOrderColumnWidth(current, columnId, width))
      }
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  );

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Purchase Orders"
            description={PO_PAGE_DESCRIPTION}
            createLabel="New purchase order"
            onCreate={editAccessGranted ? drawer.openCreate : undefined}
            aboutAriaLabel="About Purchase Orders"
          />
        }
        toolbar={
          hasAnyData ? (
            <PoListToolbar
              prefs={prefs}
              onPrefsChange={setPrefs}
              locations={locations}
              resultCount={ordersView.resultCount}
              totalCount={ordersView.totalCount}
              compactCountLabel={drawer.isOpen}
              prefsHydrated={prefsHydrated}
            />
          ) : null
        }
      >
        <div className="flex h-full min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          {listPrimary}
        </div>
      </ListModuleShell>

      <PoDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        locations={locations}
        suppliers={suppliers}
        peekOrder={peekOrder}
        peekRecordId={selectedId}
        editOrderId={editOrderId}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
        onOpenEdit={handleOpenEdit}
        onEditNotAllowed={handleEditNotAllowed}
        editAccessGranted={editAccessGranted}
        allowEditIssuedPurchaseOrders={allowEditIssuedPurchaseOrders}
        allowLineItemDiscounts={allowLineItemDiscounts}
        defaultCurrency={defaultCurrency}
        preferredDestinationLocationId={preferredDestinationLocationId}
        documentLayout={documentLayout}
        organizationBillTo={organizationBillTo}
        copyFromId={copyFromId}
        onDuplicate={editAccessGranted ? handleDuplicate : undefined}
      />
    </>
  );
}
