"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { loadInvoicePaymentApplications } from "@/app/sales/invoices/actions";
import {
  applyCustomerPaymentToInvoice,
  saveCustomerPayment,
} from "@/app/sales/payments/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/dashboard/format";
import type { InvoicePaymentApplicationRow } from "@/lib/sales/invoices/types";
import type { GatewayProviderType } from "@/lib/sales/payments/types";

const PAYMENT_METHODS: GatewayProviderType[] = [
  "BANK_TRANSFER",
  "INTERNAL_CREDIT",
  "CASH_ON_DELIVERY",
  "STRIPE",
  "RAZORPAY",
  "PAYPAL",
];

type Props = {
  salesInvoiceId: string;
  customerId: string;
  invoiceNetAmount: string;
  totalPaidAmount: string;
  invoicePaymentStatus: string;
  onApplied: () => void;
};

export function InvoicePaymentPanel({
  salesInvoiceId,
  customerId,
  invoiceNetAmount,
  totalPaidAmount,
  invoicePaymentStatus,
  onApplied,
}: Props) {
  const [applications, setApplications] = useState<InvoicePaymentApplicationRow[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<GatewayProviderType>("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const liability = Number.parseFloat(invoiceNetAmount) || 0;
  const paid = Number.parseFloat(totalPaidAmount) || 0;
  const remainingDue = Math.max(liability - paid, 0);

  const refresh = () => {
    startTransition(async () => {
      setLoading(true);
      const result = await loadInvoicePaymentApplications(salesInvoiceId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setApplications(result.applications);
        if (!amount && remainingDue > 0) {
          setAmount(remainingDue.toFixed(2));
        }
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when invoice changes
  }, [salesInvoiceId, invoiceNetAmount, totalPaidAmount]);

  const appliedFromList = useMemo(
    () =>
      applications.reduce(
        (sum, row) => sum + (Number.parseFloat(row.amount_applied) || 0),
        0
      ),
    [applications]
  );

  const handleRecordPayment = () => {
    startTransition(async () => {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        toast.error("Enter a valid payment amount.");
        return;
      }
      if (parsedAmount > remainingDue + 1e-9) {
        toast.error("Amount exceeds outstanding invoice balance.");
        return;
      }

      const saveResult = await saveCustomerPayment({
        customer_id: customerId,
        amount_received: parsedAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || null,
      });

      if ("error" in saveResult) {
        toast.error(saveResult.error);
        return;
      }

      const applyResult = await applyCustomerPaymentToInvoice({
        payment_id: saveResult.paymentId,
        invoice_id: salesInvoiceId,
        amount: parsedAmount,
      });

      if ("error" in applyResult) {
        toast.error(applyResult.error);
        return;
      }

      toast.success("Customer payment recorded and applied.");
      setReferenceNumber("");
      onApplied();
      refresh();
    });
  };

  if (invoicePaymentStatus === "FULLY_PAID" || remainingDue <= 0) {
    return (
      <section className="space-y-2 rounded-lg border border-border p-4">
        <h3 className="text-sm font-semibold">Payment</h3>
        <p className="text-xs text-muted-foreground">This invoice is fully paid.</p>
        {applications.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {applications.map((row) => (
              <li key={row.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{row.payment_number}</span>
                <span className="tabular-nums">
                  {row.amount_applied} · {formatDate(row.applied_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
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
          Outstanding balance:{" "}
          <span className="font-medium tabular-nums">{remainingDue.toFixed(2)}</span>
          {appliedFromList > 0 ? (
            <> · Applied via receipts: {appliedFromList.toFixed(2)}</>
          ) : null}
        </p>
      </div>

      {applications.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {applications.map((row) => (
            <li key={row.id} className="flex justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{row.payment_number}</span>
              <span className="tabular-nums">
                {row.amount_applied} · {formatDate(row.applied_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-xs">Payment method</Label>
          <Select
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as GatewayProviderType)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {method.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Reference</Label>
          <Input
            className="h-8 text-xs"
            value={referenceNumber}
            onChange={(event) => setReferenceNumber(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Amount</Label>
          <Input
            inputMode="decimal"
            className="h-8 text-xs"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={isPending || Number(amount) <= 0}
            onClick={handleRecordPayment}
          >
            {isPending ? "Recording…" : "Record & apply"}
          </Button>
        </div>
      </div>
    </section>
  );
}
