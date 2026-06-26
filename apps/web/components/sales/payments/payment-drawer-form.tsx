"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  loadCustomerPaymentDetail,
  saveCustomerPayment,
} from "@/app/sales/payments/actions";
import { PaymentApplicationPanel } from "@/components/sales/payments/payment-application-panel";
import { DocumentPosActionBar } from "@/components/layout/mutation-form/document-pos-action-bar";
import { RightDrawer } from "@/components/ui/right-drawer";
import { useModuleDrawerPeekPresentation } from "@/lib/layout/use-module-drawer-peek-presentation";
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
import { UserFacingErrorMessage } from "@/components/ui/user-facing-error-message";
import { formatDate } from "@/lib/dashboard/format";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { CustomerOption } from "@/lib/sales/shared/types";
import { GATEWAY_PROVIDER_TYPES } from "@/lib/sales/payments/schemas";
import type { CustomerPaymentRow, GatewayProviderType } from "@/lib/sales/payments/types";

type Props = {
  open: boolean;
  surface: DrawerSurface;
  customers: CustomerOption[];
  peekPayment: CustomerPaymentRow | null;
  peekRecordId: string | null;
  editAccessGranted: boolean;
  onClose: () => void;
  onAfterSave: (paymentId: string) => void;
};

const PAYMENT_METHOD_LABELS: Record<GatewayProviderType, string> = {
  STRIPE: "Stripe",
  RAZORPAY: "Razorpay",
  PAYPAL: "PayPal",
  INTERNAL_CREDIT: "Internal credit",
  BANK_TRANSFER: "Bank transfer",
  CASH_ON_DELIVERY: "Cash",
};

export function PaymentDrawerForm({
  open,
  surface,
  customers,
  peekPayment,
  peekRecordId,
  editAccessGranted,
  onClose,
  onAfterSave,
}: Props) {
  const readOnly = surface === "peek";
  const isCreating = surface === "create";
  const { peekShellClassName, peekBodyClassName } = useModuleDrawerPeekPresentation(
    surface === "peek"
  );
  const [detail, setDetail] = useState<CustomerPaymentRow | null>(peekPayment);
  const [detailLoading, setDetailLoading] = useState(false);
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<GatewayProviderType>("BANK_TRANSFER");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      setDetail(null);
      setCustomerId(customers[0]?.id ?? "");
      setAmount("");
      setReferenceNumber("");
      setError(null);
      return;
    }
    if (surface === "peek" && peekPayment) {
      setDetail(peekPayment);
      return;
    }
    if (!peekRecordId) return;

    setDetailLoading(true);
    loadCustomerPaymentDetail(peekRecordId)
      .then((result) => {
        if ("error" in result) {
          setError(result.error);
          return;
        }
        setDetail(result.payment);
      })
      .finally(() => setDetailLoading(false));
  }, [open, surface, isCreating, peekPayment, peekRecordId, customers]);

  const handleSave = () => {
    startTransition(async () => {
      setError(null);
      const parsedAmount = Number(amount);
      if (!customerId || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setError("Select a customer and enter a valid amount.");
        return;
      }

      const result = await saveCustomerPayment({
        customer_id: customerId,
        amount_received: parsedAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim() || null,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success("Payment recorded.");
      onAfterSave(result.paymentId!);
    });
  };

  const title =
    surface === "create" ? "Record payment" : detail?.payment_number ?? "Customer payment";

  return (
    <>
      <RightDrawer
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        onRequestClose={onClose}
        title={title}
        headerActions={
          !readOnly ? (
            <DocumentPosActionBar
              onCancel={onClose}
              saveLabel={isPending ? "Saving…" : "Save"}
              onSave={handleSave}
              primaryLabel={isPending ? "Saving…" : "Record payment"}
              onPrimary={handleSave}
              disabled={isPending || !editAccessGranted}
            />
          ) : null
        }
        widthPolicy={surface === "peek" ? "peek" : "document"}
        allowBackgroundInteraction={surface === "peek"}
        peekMode={surface === "peek"}
        className={peekShellClassName}
        bodyClassName={surface === "peek" ? peekBodyClassName : "module-drawer-form-body"}
        showCloseButton
      >
      {readOnly ? (
        detailLoading ? (
          <p className="text-sm text-muted-foreground">Loading payment…</p>
        ) : detail ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Payment number</p>
                <p className="font-mono text-sm font-medium">{detail.payment_number}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Customer</p>
                <p className="text-sm font-medium">{detail.customer_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Amount received</p>
                <p className="text-sm font-medium">{detail.amount_received}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Unapplied</p>
                <p className="text-sm font-medium">{detail.unapplied_balance}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Method</p>
                <p className="text-sm">{PAYMENT_METHOD_LABELS[detail.payment_method]}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Received</p>
                <p className="text-sm">{formatDate(detail.received_at)}</p>
              </div>
            </div>

            {detail.applications?.length ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Applications
                </p>
                <ul className="space-y-2 text-sm">
                  {detail.applications.map((application) => (
                    <li key={application.id} className="flex justify-between gap-2">
                      <span className="font-mono">{application.invoice_number}</span>
                      <span className="tabular-nums">{application.amount_applied}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {editAccessGranted ? (
              <PaymentApplicationPanel
                payment={detail}
                onApplied={() => {
                  loadCustomerPaymentDetail(detail.id).then((result) => {
                    if ("payment" in result) setDetail(result.payment);
                  });
                }}
              />
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Payment not found.</p>
        )
      ) : (
        <div className="space-y-4">
          {error ? <UserFacingErrorMessage message={error} /> : null}
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount received</Label>
            <Input value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as GatewayProviderType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GATEWAY_PROVIDER_TYPES.map((method) => (
                  <SelectItem key={method} value={method}>
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference number</Label>
            <Input
              value={referenceNumber}
              onChange={(event) => setReferenceNumber(event.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={isPending || !editAccessGranted}>
            Save payment
          </Button>
        </div>
      )}
      </RightDrawer>
    </>
  );
}
