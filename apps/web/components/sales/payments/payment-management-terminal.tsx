"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadCustomerPayments } from "@/app/sales/payments/actions";
import { PaymentDrawerForm } from "@/components/sales/payments/payment-drawer-form";
import { UnifiedCatalogHeader } from "@/components/layout/unified-catalog-header";
import { ListWorkspaceLayoutToggleControl } from "@/components/layout/list-workspace-layout-toggle-control";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import {
  ListWorkspaceCatalogBody,
  ListWorkspaceModuleFrame,
  useListWorkspaceCatalogLayout,
} from "@/components/layout/list-workspace-catalog-module";
import { formatDate } from "@/lib/dashboard/format";
import { SALES_PAYMENTS_HREF } from "@/lib/sales/navigation";
import type { CustomerOption } from "@/lib/sales/shared/types";
import type { CustomerPaymentRow } from "@/lib/sales/payments/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import {
  buildCatalogSplitListPane,
  mapCustomerPaymentRowToSplitFeed,
  useListWorkspaceFeedFilter,
} from "@/lib/layout/list-workspace";
import { Button } from "@/components/ui/button";

type Props = {
  initialPayments: CustomerPaymentRow[];
  customers: CustomerOption[];
  editAccessGranted: boolean;
};

export function PaymentManagementTerminal({
  initialPayments,
  customers,
  editAccessGranted,
}: Props) {
  const drawer = useModuleDrawerUrl(SALES_PAYMENTS_HREF);
  const [payments, setPayments] = useState(initialPayments);
  const [, startRefreshTransition] = useTransition();

  const refreshList = useCallback(() => {
    startRefreshTransition(async () => {
      try {
        const nextPayments = await loadCustomerPayments();
        setPayments(nextPayments);
      } catch (error) {
        console.error("[PaymentManagementTerminal] refresh failed", error);
        toast.error(error instanceof Error ? error.message : "Unable to refresh payments.");
      }
    });
  }, []);

  const selectedId = drawer.recordId;
  const peekPayment =
    selectedId != null && drawer.surface === "peek"
      ? (payments.find((row) => row.id === selectedId) ?? null)
      : null;

  const handleAfterSave = useCallback(
    (paymentId: string) => {
      refreshList();
      drawer.afterSave(paymentId);
    },
    [drawer, refreshList]
  );

  const peekOpen = drawer.isOpen && drawer.surface === "peek";
  const { layout } = useListWorkspaceCatalogLayout();

  const { feedFilteredRows, feedFilterProps } = useListWorkspaceFeedFilter({
    rows: payments,
    extractSearchable: (row) => [
      row.payment_number,
      row.customer_name,
      row.reference_number,
      row.payment_method,
      row.amount_received,
      row.unapplied_balance,
    ],
  });

  const handleSelectPayment = useCallback(
    (paymentId: string) => {
      drawer.openPeek(paymentId);
    },
    [drawer]
  );

  const listPrimary = (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-1">
      {payments.length === 0 ? (
        <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/35 px-6 py-12 text-center">
          <p className="text-sm font-medium">No customer payments yet.</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Record receipts from customers and apply them to open invoices.
          </p>
          {editAccessGranted ? (
            <Button className="mt-6" onClick={() => drawer.openCreate()}>
              Record payment
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Payment</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium text-right">Received</th>
                <th className="px-3 py-2 font-medium text-right">Unapplied</th>
                <th className="px-3 py-2 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {feedFilteredRows.map((payment) => (
                <tr
                  key={payment.id}
                  className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                  onClick={() => handleSelectPayment(payment.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs">{payment.payment_number}</td>
                  <td className="px-3 py-2">{payment.customer_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {payment.amount_received}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {payment.unapplied_balance}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {formatDate(payment.received_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const splitListPrimary = buildCatalogSplitListPane({
    rows: feedFilteredRows,
    selectedId,
    onSelect: handleSelectPayment,
    mapRow: mapCustomerPaymentRowToSplitFeed,
    hasAnyData: payments.length > 0,
    emptyMessage: "No payments match the current filters.",
    empty: listPrimary,
    filteredEmpty: (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No payments match the current filters.
        </div>
      </div>
    ),
  });

  return (
    <ListWorkspaceModuleFrame peekOpen={peekOpen}>
      <>
      <ListModuleShell
        surface="classic"
        className="list-module-shell-root"
        title={
          <UnifiedCatalogHeader
            title="Customer payments"
            count={payments.length > 0 ? String(feedFilteredRows.length) : undefined}
            onNew={editAccessGranted ? drawer.openCreate : undefined}
            newAriaLabel="Record payment"
            layout={layout}
            feedFilter={feedFilterProps}
            controls={<ListWorkspaceLayoutToggleControl />}
          />
        }
      >
        <ListWorkspaceCatalogBody
          peekOpen={peekOpen}
          splitEmptyTitle="Select a payment"
          splitEmptyMessage="Choose a row from the list to inspect details here."
          listContent={listPrimary}
          splitListContent={splitListPrimary}
        />
      </ListModuleShell>

      <PaymentDrawerForm
        open={drawer.isOpen}
        surface={drawer.surface}
        customers={customers}
        peekPayment={peekPayment}
        peekRecordId={selectedId}
        editAccessGranted={editAccessGranted}
        onClose={drawer.close}
        onAfterSave={handleAfterSave}
      />
      </>
    </ListWorkspaceModuleFrame>
  );
}
