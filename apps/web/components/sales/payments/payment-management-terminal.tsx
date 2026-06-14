"use client";

import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadCustomerPayments } from "@/app/sales/payments/actions";
import { PaymentDrawerForm } from "@/components/sales/payments/payment-drawer-form";
import { ListModulePageTitleHeader } from "@/components/layout/list-module-page-title-header";
import { ListModuleShell } from "@/components/layout/list-module-shell";
import { formatDate } from "@/lib/dashboard/format";
import { SALES_PAYMENTS_HREF } from "@/lib/sales/navigation";
import type { CustomerOption } from "@/lib/sales/shared/types";
import type { CustomerPaymentRow } from "@/lib/sales/payments/types";
import { useModuleDrawerUrl } from "@/lib/layout/use-module-drawer-url";
import { Button } from "@/components/ui/button";

const PAYMENT_PAGE_DESCRIPTION =
  "Record customer receipts and apply them to posted sales invoices.";

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

  return (
    <>
      <ListModuleShell
        title={
          <ListModulePageTitleHeader
            title="Customer payments"
            description={PAYMENT_PAGE_DESCRIPTION}
            createLabel="Record payment"
            onCreate={editAccessGranted ? drawer.openCreate : undefined}
            aboutAriaLabel="About Customer Payments"
          />
        }
      >
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
                  {payments.map((payment) => (
                    <tr
                      key={payment.id}
                      className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                      onClick={() => drawer.openPeek(payment.id)}
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
  );
}
