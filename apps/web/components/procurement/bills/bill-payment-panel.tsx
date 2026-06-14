"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadBillAdvanceApplications, postVendorPayment } from "@/app/procurement/bills/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/dashboard/format";
import type { BillAdvanceApplicationRow } from "@/lib/procurement/advances/types";

type Props = {
  purchaseInvoiceId: string;
  invoiceLiability: string;
  isPaid: boolean;
  onPaid: () => void;
};

export function BillPaymentPanel({
  purchaseInvoiceId,
  invoiceLiability,
  isPaid,
  onPaid,
}: Props) {
  const [applications, setApplications] = useState<BillAdvanceApplicationRow[]>([]);
  const [paymentReference, setPaymentReference] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const liability = Number.parseFloat(invoiceLiability) || 0;
  const appliedTotal = useMemo(
    () =>
      applications.reduce((sum, row) => sum + (Number.parseFloat(row.amount_applied) || 0), 0),
    [applications]
  );
  const remainingDue = Math.max(liability - appliedTotal, 0);

  const refresh = () => {
    startTransition(async () => {
      setLoading(true);
      const result = await loadBillAdvanceApplications(purchaseInvoiceId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setApplications(result.applications);
        if (!amount) {
          const due = Math.max(liability - result.applications.reduce(
            (sum, row) => sum + (Number.parseFloat(row.amount_applied) || 0),
            0
          ), 0);
          if (due > 0) setAmount(due.toFixed(2));
        }
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when bill changes
  }, [purchaseInvoiceId, invoiceLiability]);

  const handlePostPayment = () => {
    startTransition(async () => {
      const result = await postVendorPayment({
        purchase_invoice_id: purchaseInvoiceId,
        payment_reference: paymentReference.trim(),
        amount: Number(amount),
        payment_date: paymentDate || null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Vendor payment recorded.");
      setPaymentReference("");
      onPaid();
      refresh();
    });
  };

  if (isPaid) {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Payment</h3>
        <p className="text-xs text-muted-foreground">This bill is marked as paid.</p>
      </section>
    );
  }

  if (loading && applications.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading payment details…</p>;
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Record payment</h3>
        <p className="text-xs text-muted-foreground">
          Post a vendor payment against this bill. Remaining due after advance applications:{" "}
          <span className="font-medium tabular-nums">{remainingDue.toFixed(2)}</span>
        </p>
      </div>

      {applications.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {applications.map((row) => (
            <li key={row.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{row.payment_reference}</span>
              <span className="tabular-nums">
                Advance {row.amount_applied} · {formatDate(row.applied_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {remainingDue > 0 ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-end">
          <div>
            <Label htmlFor="bill_payment_ref" className="text-xs">
              Payment reference
            </Label>
            <Input
              id="bill_payment_ref"
              className="h-8 text-xs"
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bill_payment_amount" className="text-xs">
              Amount
            </Label>
            <Input
              id="bill_payment_amount"
              inputMode="decimal"
              className="h-8 text-xs"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="bill_payment_date" className="text-xs">
              Payment date
            </Label>
            <Input
              id="bill_payment_date"
              type="date"
              className="h-8 text-xs"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={
              isPending ||
              !paymentReference.trim() ||
              Number(amount) <= 0 ||
              Number(amount) + 1e-9 < remainingDue
            }
            onClick={handlePostPayment}
          >
            {isPending ? "Posting…" : "Post payment"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Advance applications cover the full liability. No cash payment required.
        </p>
      )}
    </section>
  );
}
