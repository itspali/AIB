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

type Props = {
  prefs: SalesInvoiceListPrefs;
  onPrefsChange: (prefs: SalesInvoiceListPrefs) => void;
  customers: CustomerOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

const STATUS_OPTIONS: Array<{ value: SalesDocumentStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "DRAFT", label: salesInvoiceStatusLabel("DRAFT") },
  { value: "PENDING_APPROVAL", label: salesInvoiceStatusLabel("PENDING_APPROVAL") },
  { value: "APPROVED_ACTIVE", label: salesInvoiceStatusLabel("APPROVED_ACTIVE") },
];

const PAYMENT_OPTIONS: Array<{ value: SalesPaymentStatus | "all"; label: string }> = [
  { value: "all", label: "All payment states" },
  { value: "UNPAID", label: salesInvoicePaymentStatusLabel("UNPAID") },
  { value: "PARTIALLY_PAID", label: salesInvoicePaymentStatusLabel("PARTIALLY_PAID") },
  { value: "FULLY_PAID", label: salesInvoicePaymentStatusLabel("FULLY_PAID") },
];

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
                    <Select
                      value={prefs.customerId ?? "all"}
                      disabled={controlsDisabled}
                      onValueChange={(next) =>
                        onPrefsChange({
                          ...prefs,
                          customerId: next === "all" ? null : next,
                        })
                      }
                    >
                      <SelectTrigger className={cn(listToolbarSelectClass(customerActive), "h-8 w-full")}>
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
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Status</p>
                    <Select
                      value={prefs.status}
                      disabled={controlsDisabled}
                      onValueChange={(next) =>
                        onPrefsChange({
                          ...prefs,
                          status: next as SalesDocumentStatus | "all",
                        })
                      }
                    >
                      <SelectTrigger className={cn(listToolbarSelectClass(statusActive), "h-8 w-full")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Payment</p>
                    <Select
                      value={prefs.paymentStatus}
                      disabled={controlsDisabled}
                      onValueChange={(next) =>
                        onPrefsChange({
                          ...prefs,
                          paymentStatus: next as SalesPaymentStatus | "all",
                        })
                      }
                    >
                      <SelectTrigger className={cn(listToolbarSelectClass(paymentActive), "h-8 w-full")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ),
            }}
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
