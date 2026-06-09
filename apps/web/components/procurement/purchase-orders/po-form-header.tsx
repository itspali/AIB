"use client";

import type { ReactNode } from "react";
import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import { PoSupplierCombobox } from "@/components/procurement/purchase-orders/po-supplier-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLayoutColumnPref,
} from "@/lib/documents/purchase-order-layout";
import { getVisiblePoFormHeaderPrimaryFields, resolvePoFormFieldsGridProps, resolvePoFormFieldNarrowSpanClass } from "@/lib/documents/po-form-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import {
  supplierDefaultCurrency,
  supplierPaymentTerms,
} from "@/lib/procurement/purchase-orders/draft-form";
import {
  CURRENCY_OPTIONS,
  type OrganizationCurrency,
} from "@/lib/organization/currency-options";
import type { ProcurementLocationOption, ProcurementSupplierOption } from "@/lib/procurement/shared/types";
import { cn } from "@/lib/utils";

type Props = {
  form: PoDraftFormState;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  disabled?: boolean;
  /** Workspace base currency when the supplier has no trading currency override. */
  defaultCurrency?: string;
  layout?: DocumentLayoutTemplate;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

function renderPrimaryHeaderField(
  field: DocumentColumnPref,
  props: Props,
  index: number,
  fields: DocumentColumnPref[]
): ReactNode {
  const {
    form,
    locations,
    suppliers,
    disabled = false,
    defaultCurrency = "USD",
    layout = DEFAULT_PO_SCREEN_LAYOUT,
    onPatch,
  } = props;
  const narrowSpanClass = resolvePoFormFieldNarrowSpanClass(index, fields, "stack");

  switch (field.id) {
    case "destination":
      return (
        <div key={field.id} className={cn("min-w-0 w-full space-y-2", narrowSpanClass)}>
          <DocumentLayoutLabel
            field={getPoLayoutColumnPref(layout, "destination")}
            fallbackLabel="Destination"
          />
          <Select
            value={form.destination_location_id}
            disabled={disabled}
            onValueChange={(value) => onPatch({ destination_location_id: value })}
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    case "supplier":
      return (
        <PoSupplierCombobox
          key={field.id}
          className={cn("min-w-0 w-full", narrowSpanClass)}
          suppliers={suppliers}
          value={form.supplier_id}
          disabled={disabled}
          labelField={getPoLayoutColumnPref(layout, "supplier")}
          onChange={(supplierId) =>
            onPatch({
              supplier_id: supplierId,
              payment_terms_days: supplierPaymentTerms(suppliers, supplierId),
              currency_code: supplierDefaultCurrency(suppliers, supplierId, defaultCurrency),
            })
          }
        />
      );
    case "currency":
      return (
        <div key={field.id} className={cn("min-w-0 w-full space-y-2", narrowSpanClass)}>
          <DocumentLayoutLabel
            field={getPoLayoutColumnPref(layout, "currency")}
            fallbackLabel="Currency"
          />
          <Select
            value={form.currency_code}
            disabled={disabled}
            onValueChange={(value) =>
              onPatch({ currency_code: value as OrganizationCurrency })
            }
          >
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    default:
      return null;
  }
}

export function PoFormHeader(props: Props) {
  const { layout = DEFAULT_PO_SCREEN_LAYOUT } = props;
  const primaryFields = getVisiblePoFormHeaderPrimaryFields(layout);

  if (primaryFields.length === 0) return null;

  const grid = resolvePoFormFieldsGridProps(primaryFields.length);

  return (
    <div className={grid.containerClassName}>
      <div className={cn("gap-2 sm:gap-4", grid.gridClassName)}>
        {primaryFields.map((field, index) =>
          renderPrimaryHeaderField(field, props, index, primaryFields)
        )}
      </div>
    </div>
  );
}
