"use client";

import type { ReactNode } from "react";
import { DocumentLayoutLabel } from "@/components/documents/document-layout-label";
import { SalesCustomerCombobox } from "@/components/sales/shared/sales-customer-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  getSalesLayoutColumnPref,
} from "@/lib/sales/shared/sales-commerce-layout";
import {
  getVisibleSalesFormHeaderPrimaryFields,
  resolveSalesFormFieldNarrowSpanClass,
  resolveSalesFormFieldsGridProps,
} from "@/lib/sales/shared/sales-form-layout";
import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  customerDefaultCurrency,
  customerDefaultStates,
  customerPaymentTerms,
  resolveSalesCommerceSupplyStates,
} from "@/lib/sales/shared/sales-commerce-draft";
import {
  CURRENCY_OPTIONS,
  type OrganizationCurrency,
} from "@/lib/organization/currency-options";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";
import { cn } from "@/lib/utils";

export type SalesCommerceHeaderForm = {
  customer_id: string;
  currency_code: string;
  payment_terms_days: string;
  billing_state: string;
  shipping_state: string;
};

type Props<TForm extends SalesCommerceHeaderForm> = {
  form: TForm;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  locationId: string;
  locationField: "shipping_location_id" | "origin_location_id";
  disabled?: boolean;
  defaultCurrency?: string;
  layout?: DocumentLayoutTemplate;
  onPatch: (patch: Partial<TForm & Record<string, unknown>>) => void;
};

function renderPrimaryHeaderField<TForm extends SalesCommerceHeaderForm>(
  field: DocumentColumnPref,
  props: Props<TForm>,
  index: number,
  fields: DocumentColumnPref[]
): ReactNode {
  const {
    form,
    locations,
    customers,
    locationId,
    locationField,
    disabled = false,
    defaultCurrency = "USD",
    layout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
    onPatch,
  } = props;
  const narrowSpanClass = resolveSalesFormFieldNarrowSpanClass(index, fields, "stack");

  switch (field.id) {
    case "customer":
      return (
        <SalesCustomerCombobox
          key={field.id}
          className={cn("min-w-0 w-full", narrowSpanClass)}
          customers={customers}
          value={form.customer_id}
          disabled={disabled}
          labelField={getSalesLayoutColumnPref(layout, "customer")}
          onChange={(customerId) => {
            const states = customerDefaultStates(
              customers,
              customerId,
              locations,
              locationId
            );
            onPatch({
              customer_id: customerId,
              billing_state: states.billing_state,
              shipping_state: states.shipping_state,
              payment_terms_days: customerPaymentTerms(customers, customerId),
              currency_code: customerDefaultCurrency(customers, customerId, defaultCurrency),
            } as Partial<TForm & Record<string, unknown>>);
          }}
        />
      );
    case "shipping_location":
      return (
        <div key={field.id} className={cn("min-w-0 w-full space-y-2", narrowSpanClass)}>
          <DocumentLayoutLabel
            field={getSalesLayoutColumnPref(layout, "shipping_location")}
            fallbackLabel="Ship from"
          />
          <Select
            value={locationId}
            disabled={disabled}
            onValueChange={(value) => {
              const location = locations.find((row) => row.id === value);
              const states = resolveSalesCommerceSupplyStates({
                customers,
                locations,
                customerId: form.customer_id,
                originLocationId: value,
                billingState: form.billing_state,
                shippingState: location?.state?.trim() || form.shipping_state,
              });
              onPatch({
                [locationField]: value,
                billing_state: states.billing_state,
                shipping_state: states.shipping_state,
              } as Partial<TForm & Record<string, unknown>>);
            }}
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
    case "currency":
      return (
        <div key={field.id} className={cn("min-w-0 w-full space-y-2", narrowSpanClass)}>
          <DocumentLayoutLabel
            field={getSalesLayoutColumnPref(layout, "currency")}
            fallbackLabel="Currency"
          />
          <Select
            value={form.currency_code}
            disabled={disabled}
            onValueChange={(value) =>
              onPatch({ currency_code: value as OrganizationCurrency } as Partial<
                TForm & Record<string, unknown>
              >)
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

export function SalesCommerceFormHeader<TForm extends SalesCommerceHeaderForm>(props: Props<TForm>) {
  const { layout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT } = props;
  const primaryFields = getVisibleSalesFormHeaderPrimaryFields(layout);

  if (primaryFields.length === 0) return null;

  const grid = resolveSalesFormFieldsGridProps(primaryFields.length);

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