"use client";

import { QuoteListColumnSettings } from "@/components/sales/quotes/quote-list-column-settings";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SalesQuoteListPrefs } from "@/lib/sales/quotes/list-prefs";
import type { SalesQuoteListStatusFilter } from "@/lib/sales/quotes/list-prefs";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { CustomerOption } from "@/lib/sales/shared/types";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import { listToolbarSelectClass } from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: SalesQuoteListStatusFilter[] = [
  "all",
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED_ACTIVE",
  "SENT",
  "FULLY_COMPLETED",
  "CANCELLED",
];

type Props = {
  prefs: SalesQuoteListPrefs;
  onPrefsChange: (prefs: SalesQuoteListPrefs) => void;
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
  value: SalesQuoteListPrefs["status"];
  disabled: boolean;
  onValueChange: (value: SalesQuoteListPrefs["status"]) => void;
  triggerClassName?: string;
}) {
  const statusActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as SalesQuoteListPrefs["status"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(statusActive), triggerClassName)}>
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status === "all"
              ? "All statuses"
              : status === "SENT"
                ? "Sent"
                : salesQuoteStatusLabel(status as SalesDocumentStatus)}
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

export function QuoteListToolbar({
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
  const extraFilterCount = (customerActive ? 1 : 0) + (statusActive ? 1 : 0);

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="quote"
      countNounPlural="quotes"
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({ ...prefs, customerId: null, status: "all" }),
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

          <QuoteListColumnSettings
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
