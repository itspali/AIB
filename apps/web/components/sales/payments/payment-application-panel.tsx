"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyCustomerPaymentToInvoice,
  loadOpenInvoicesForCustomer,
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
import type { OpenSalesInvoiceOption } from "@/lib/sales/invoices/types";
import type { CustomerPaymentRow } from "@/lib/sales/payments/types";

type Props = {
  payment: CustomerPaymentRow;
  onApplied: () => void;
};

export function PaymentApplicationPanel({ payment, onApplied }: Props) {
  const [invoices, setInvoices] = useState<OpenSalesInvoiceOption[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadOpenInvoicesForCustomer(payment.customer_id).then((result) => {
      if ("invoices" in result) {
        setInvoices(result.invoices);
        if (result.invoices[0]) {
          setInvoiceId(result.invoices[0].id);
          setAmount(result.invoices[0].outstanding_amount);
        }
      }
    });
  }, [payment.customer_id]);

  const handleApply = () => {
    startTransition(async () => {
      setError(null);
      const parsedAmount = Number(amount);
      if (!invoiceId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError("Select an invoice and enter a valid amount.");
        return;
      }

      const result = await applyCustomerPaymentToInvoice({
        payment_id: payment.id,
        invoice_id: invoiceId,
        amount: parsedAmount,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Payment applied to invoice.");
      onApplied();
    });
  };

  if (Number(payment.unapplied_balance) <= 0) {
    return (
      <p className="text-sm text-muted-foreground">This payment has no remaining unapplied balance.</p>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Apply payment
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Unapplied balance: {payment.unapplied_balance}
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-2">
        <Label>Open invoice</Label>
        <Select value={invoiceId} onValueChange={setInvoiceId}>
          <SelectTrigger>
            <SelectValue placeholder="Select invoice" />
          </SelectTrigger>
          <SelectContent>
            {invoices.map((invoice) => (
              <SelectItem key={invoice.id} value={invoice.id}>
                {invoice.invoice_number} — outstanding {invoice.outstanding_amount}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Amount to apply</Label>
        <Input value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>

      <Button onClick={handleApply} disabled={isPending || invoices.length === 0}>
        Apply to invoice
      </Button>
    </div>
  );
}
