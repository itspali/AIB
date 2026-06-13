"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  applyVendorAdvanceToBill,
  loadBillAdvanceApplications,
  loadVendorAdvancesForSupplier,
  saveVendorAdvance,
} from "@/app/procurement/bills/actions";
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
import type {
  BillAdvanceApplicationRow,
  VendorAdvancePaymentRow,
} from "@/lib/procurement/advances/types";

type Props = {
  purchaseInvoiceId: string;
  supplierId: string;
  invoiceLiability: string;
  onApplied: () => void;
};

export function BillAdvanceApplicationPanel({
  purchaseInvoiceId,
  supplierId,
  invoiceLiability,
  onApplied,
}: Props) {
  const [advances, setAdvances] = useState<VendorAdvancePaymentRow[]>([]);
  const [applications, setApplications] = useState<BillAdvanceApplicationRow[]>([]);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [recordReference, setRecordReference] = useState("");
  const [recordAmount, setRecordAmount] = useState("");
  const [showRecordForm, setShowRecordForm] = useState(false);
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
      const [advanceResult, applicationResult] = await Promise.all([
        loadVendorAdvancesForSupplier(supplierId),
        loadBillAdvanceApplications(purchaseInvoiceId),
      ]);
      if ("error" in advanceResult) {
        toast.error(advanceResult.error);
      } else {
        setAdvances(advanceResult.advances);
        if (!selectedAdvanceId && advanceResult.advances[0]) {
          setSelectedAdvanceId(advanceResult.advances[0].id);
          setAmount(advanceResult.advances[0].unapplied_balance);
        }
      }
      if ("error" in applicationResult) {
        toast.error(applicationResult.error);
      } else {
        setApplications(applicationResult.applications);
      }
      setLoading(false);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when bill/supplier changes
  }, [purchaseInvoiceId, supplierId]);

  const selectedAdvance = advances.find((row) => row.id === selectedAdvanceId) ?? null;

  const handleApply = () => {
    if (!selectedAdvanceId) return;
    startTransition(async () => {
      const result = await applyVendorAdvanceToBill({
        purchase_invoice_id: purchaseInvoiceId,
        advance_payment_id: selectedAdvanceId,
        amount: Number(amount),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Vendor advance applied.");
      onApplied();
      refresh();
    });
  };

  const handleRecordAdvance = () => {
    startTransition(async () => {
      const result = await saveVendorAdvance({
        supplier_id: supplierId,
        payment_reference: recordReference,
        amount: Number(recordAmount),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Vendor advance recorded.");
      setRecordReference("");
      setRecordAmount("");
      setShowRecordForm(false);
      refresh();
    });
  };

  if (loading && advances.length === 0 && applications.length === 0) {
    return <p className="text-xs text-muted-foreground">Loading vendor advances…</p>;
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Vendor advances</h3>
          <p className="text-xs text-muted-foreground">
            Apply unapplied prepayments against this bill. Remaining due after applications:{" "}
            <span className="font-medium tabular-nums">{remainingDue.toFixed(2)}</span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowRecordForm((current) => !current)}
        >
          {showRecordForm ? "Cancel" : "Record advance"}
        </Button>
      </div>

      {showRecordForm ? (
        <div className="grid gap-3 rounded-md border border-dashed border-border p-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <div>
            <Label htmlFor="advance_record_ref" className="text-xs">
              Payment reference
            </Label>
            <Input
              id="advance_record_ref"
              className="h-8 text-xs"
              value={recordReference}
              onChange={(event) => setRecordReference(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="advance_record_amount" className="text-xs">
              Amount
            </Label>
            <Input
              id="advance_record_amount"
              inputMode="decimal"
              className="h-8 text-xs"
              value={recordAmount}
              onChange={(event) => setRecordAmount(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={isPending || !recordReference.trim() || Number(recordAmount) <= 0}
            onClick={handleRecordAdvance}
          >
            Save
          </Button>
        </div>
      ) : null}

      {applications.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {applications.map((row) => (
            <li key={row.id} className="flex justify-between gap-2">
              <span className="font-mono text-xs">{row.payment_reference}</span>
              <span className="tabular-nums">
                {row.amount_applied} · {formatDate(row.applied_at)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {advances.length > 0 && remainingDue > 0 ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <div>
            <Label className="text-xs">Advance payment</Label>
            <Select value={selectedAdvanceId} onValueChange={setSelectedAdvanceId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select advance" />
              </SelectTrigger>
              <SelectContent>
                {advances.map((row) => (
                  <SelectItem key={row.id} value={row.id} className="text-xs">
                    {row.payment_reference} · {row.unapplied_balance} available
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="advance_apply_amount" className="text-xs">
              Amount
            </Label>
            <Input
              id="advance_apply_amount"
              inputMode="decimal"
              className="h-8 text-xs"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={isPending || !selectedAdvance || Number(amount) <= 0}
            onClick={handleApply}
          >
            {isPending ? "Applying…" : "Apply"}
          </Button>
        </div>
      ) : advances.length === 0 && !showRecordForm ? (
        <p className="text-xs text-muted-foreground">No unapplied advances for this supplier.</p>
      ) : null}
    </section>
  );
}
