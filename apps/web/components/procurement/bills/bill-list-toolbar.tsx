"use client";

import { ArrowUpDown } from "lucide-react";
import { BillListColumnSettings } from "@/components/procurement/bills/bill-list-column-settings";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { PurchaseBillListPrefs } from "@/lib/procurement/bills/list-prefs";
import {
  BILL_LIST_SORT_OPTIONS,
  purchaseBillSortOptionKey,
  type PurchaseBillListSortDirection,
} from "@/lib/procurement/bills/list-sort";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import type { BillMatchStatus } from "@/lib/procurement/bills/three-way-match";
import type { ProcurementSupplierOption } from "@/lib/procurement/shared/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type Props = {
  prefs: PurchaseBillListPrefs;
  onPrefsChange: (prefs: PurchaseBillListPrefs) => void;
  suppliers: ProcurementSupplierOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

const MATCH_STATUS_OPTIONS: Array<{ value: BillMatchStatus | "all"; label: string }> = [
  { value: "all", label: "All match statuses" },
  { value: "MATCHED", label: billMatchStatusLabel("MATCHED") },
  { value: "VARIANCE", label: billMatchStatusLabel("VARIANCE") },
  { value: "PPV_HOLD", label: billMatchStatusLabel("PPV_HOLD") },
];

const PAID_FILTER_OPTIONS = [
  { value: "all", label: "All payment states" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
] as const;

function SupplierFilterSelect({
  value,
  disabled,
  suppliers,
  onValueChange,
  triggerClassName,
}: {
  value: string | null;
  disabled: boolean;
  suppliers: ProcurementSupplierOption[];
  onValueChange: (supplierId: string | null) => void;
  triggerClassName?: string;
}) {
  const supplierActive = Boolean(value);

  return (
    <Select
      value={value ?? "all"}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === "all" ? null : next)}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(supplierActive), triggerClassName)}>
        <SelectValue placeholder="All suppliers" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All suppliers</SelectItem>
        {suppliers.map((supplier) => (
          <SelectItem key={supplier.id} value={supplier.id}>
            {supplier.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MatchStatusFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: PurchaseBillListPrefs["matchStatus"];
  disabled: boolean;
  onValueChange: (value: PurchaseBillListPrefs["matchStatus"]) => void;
  triggerClassName?: string;
}) {
  const matchActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as BillMatchStatus | "all")}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(matchActive), triggerClassName)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {MATCH_STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PaidFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: PurchaseBillListPrefs["paidFilter"];
  disabled: boolean;
  onValueChange: (value: PurchaseBillListPrefs["paidFilter"]) => void;
  triggerClassName?: string;
}) {
  const paidActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as PurchaseBillListPrefs["paidFilter"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(paidActive), triggerClassName)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAID_FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BillListToolbar({
  prefs,
  onPrefsChange,
  suppliers,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const supplierActive = Boolean(prefs.supplierId);
  const matchActive = prefs.matchStatus !== "all";
  const paidActive = prefs.paidFilter !== "all";
  const extraFilterCount = (supplierActive ? 1 : 0) + (matchActive ? 1 : 0) + (paidActive ? 1 : 0);
  const sortValue = purchaseBillSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    BILL_LIST_SORT_OPTIONS.find(
      (option) => purchaseBillSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="bill"
      countNounPlural="bills"
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({
                  ...prefs,
                  supplierId: null,
                  matchStatus: "all",
                  paidFilter: "all",
                }),
              extraDropdownContent: (
                <div className="space-y-3 p-1">
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Supplier</p>
                    <SupplierFilterSelect
                      value={prefs.supplierId}
                      disabled={controlsDisabled}
                      suppliers={suppliers}
                      onValueChange={(supplierId) => onPrefsChange({ ...prefs, supplierId })}
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Match status</p>
                    <MatchStatusFilterSelect
                      value={prefs.matchStatus}
                      disabled={controlsDisabled}
                      onValueChange={(matchStatus) => onPrefsChange({ ...prefs, matchStatus })}
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Payment</p>
                    <PaidFilterSelect
                      value={prefs.paidFilter}
                      disabled={controlsDisabled}
                      onValueChange={(paidFilter) => onPrefsChange({ ...prefs, paidFilter })}
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                </div>
              ),
            }}
          />

          <SupplierFilterSelect
            value={prefs.supplierId}
            disabled={controlsDisabled}
            suppliers={suppliers}
            onValueChange={(supplierId) => onPrefsChange({ ...prefs, supplierId })}
            triggerClassName="hidden min-w-[8rem] md:inline-flex"
          />

          <MatchStatusFilterSelect
            value={prefs.matchStatus}
            disabled={controlsDisabled}
            onValueChange={(matchStatus) => onPrefsChange({ ...prefs, matchStatus })}
            triggerClassName="hidden min-w-[9rem] md:inline-flex"
          />

          <PaidFilterSelect
            value={prefs.paidFilter}
            disabled={controlsDisabled}
            onValueChange={(paidFilter) => onPrefsChange({ ...prefs, paidFilter })}
            triggerClassName="hidden min-w-[8.5rem] md:inline-flex"
          />

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = BILL_LIST_SORT_OPTIONS.find(
                  (entry) => purchaseBillSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as PurchaseBillListSortDirection,
                });
              }}
            >
              <SelectTrigger
                className={listToolbarSortTriggerClass(true)}
                title={`Sort: ${activeSortLabel}`}
                aria-label={`Sort: ${activeSortLabel}`}
              >
                <SelectValue />
                <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
              </SelectTrigger>
              <SelectContent align="end">
                {BILL_LIST_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={purchaseBillSortOptionKey(option.field, option.direction)}
                    value={purchaseBillSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <BillListColumnSettings
            prefs={prefs}
            onChange={onPrefsChange}
            detectedDeviceClass={deviceClass}
            disabled={controlsDisabled}
          />
        </>
      }
    />
  );
}
