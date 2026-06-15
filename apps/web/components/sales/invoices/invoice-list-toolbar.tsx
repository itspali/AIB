"use client";

import { InvoiceListColumnSettings } from "@/components/sales/invoices/invoice-list-column-settings";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SalesInvoiceListPrefs } from "@/lib/sales/invoices/list-prefs";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import type { CustomerOption } from "@/lib/sales/shared/types";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesPaymentStatus } from "@/lib/sales/orders/types";
import { listToolbarSelectClass } from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<SalesDocumentStatus | "all"> = [
  "all",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED_ACTIVE",
  "CANCELLED",
];

const PAYMENT_OPTIONS: Array<SalesPaymentStatus | "all"> = [
  "all",
  "UNPAID",
  "PARTIALLY_PAID",
  "FULLY_PAID",
  "REFUNDED",
];

type Props = {
  prefs: SalesInvoiceListPrefs;
  onPrefsChange: (prefs: SalesInvoiceListPrefs) => void;
  customers: CustomerOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

function StatusFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: SalesInvoiceListPrefs["status"];
  disabled: boolean;
  onValueChange: (value: SalesInvoiceListPrefs["status"]) => void;
  triggerClassName?: string;
}) {
  const statusActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as SalesInvoiceListPrefs["status"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(statusActive), triggerClassName)}>
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status === "all" ? "All statuses" : salesInvoiceStatusLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaymentFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: SalesInvoiceListPrefs["paymentStatus"];
  disabled: boolean;
  onValueChange: (value: SalesInvoiceListPrefs["paymentStatus"]) => void;
  triggerClassName?: string;
}) {
  const paymentActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as SalesInvoiceListPrefs["paymentStatus"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(paymentActive), triggerClassName)}>
        <SelectValue placeholder="All payment states" />
      </SelectTrigger>
      <SelectContent>
        {PAYMENT_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status === "all" ? "All payment states" : salesInvoicePaymentStatusLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CustomerFilterSelect({
  value,
  disabled,
  customers,
  onValueChange,
  triggerClassName,
}: {
  value: string | null;
  disabled: boolean;
  customers: CustomerOption[];
  onValueChange: (customerId: string | null) => void;
  triggerClassName?: string;
}) {
  const customerActive = Boolean(value);

  return (
    <Select
      value={value ?? "all"}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === "all" ? null : next)}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(customerActive), triggerClassName)}>
        <SelectValue placeholder="All customers" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All customers</SelectItem>
        {customers.map((customer) => (
          <SelectItem key={customer.id} value={customer.id}>
            {customer.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function InvoiceListToolbar({
  prefs,
  onPrefsChange,
  customers,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const controlsDisabled = !prefsHydrated;
  const customerActive = Boolean(prefs.customerId);
  const statusActive = prefs.status !== "all";
  const paymentActive = prefs.paymentStatus !== "all";
  const extraFilterCount =
    (customerActive ? 1 : 0) + (statusActive ? 1 : 0) + (paymentActive ? 1 : 0);

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="invoice"
      countNounPlural="invoices"
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({
                  ...prefs,
                  customerId: null,
                  status: "all",
                  paymentStatus: "all",
                }),
              extraDropdownContent: (
                <div className="space-y-3 p-1">
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Customer</p>
                    <CustomerFilterSelect
                      value={prefs.customerId}
                      disabled={controlsDisabled}
                      customers={customers}
                      onValueChange={(customerId) =>
                        onPrefsChange({ ...prefs, customerId })
                      }
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Status</p>
                    <StatusFilterSelect
                      value={prefs.status}
                      disabled={controlsDisabled}
                      onValueChange={(status) => onPrefsChange({ ...prefs, status })}
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Payment</p>
                    <PaymentFilterSelect
                      value={prefs.paymentStatus}
                      disabled={controlsDisabled}
                      onValueChange={(paymentStatus) =>
                        onPrefsChange({ ...prefs, paymentStatus })
                      }
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                </div>
              ),
            }}
          />

          <CustomerFilterSelect
            value={prefs.customerId}
            disabled={controlsDisabled}
            customers={customers}
            onValueChange={(customerId) => onPrefsChange({ ...prefs, customerId })}
            triggerClassName="hidden min-w-[8rem] md:inline-flex"
          />

          <StatusFilterSelect
            value={prefs.status}
            disabled={controlsDisabled}
            onValueChange={(status) => onPrefsChange({ ...prefs, status })}
            triggerClassName="hidden min-w-[8.5rem] md:inline-flex"
          />

          <PaymentFilterSelect
            value={prefs.paymentStatus}
            disabled={controlsDisabled}
            onValueChange={(paymentStatus) => onPrefsChange({ ...prefs, paymentStatus })}
            triggerClassName="hidden min-w-[9rem] md:inline-flex"
          />

          <InvoiceListColumnSettings
            prefs={prefs}
            onChange={onPrefsChange}
            detectedDeviceClass="desktop"
            disabled={controlsDisabled}
          />
        </>
      }
    />
  );
}
