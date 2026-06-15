"use client";

import { SoCustomerCombobox } from "@/components/sales/orders/so-customer-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  customerDefaultStates,
  type SoDraftFormState,
} from "@/lib/sales/orders/draft-form";
import { resolveSalesCommerceSupplyStates } from "@/lib/sales/shared/sales-commerce-draft";
import type { CustomerOption, SalesLocationOption } from "@/lib/sales/shared/types";

type Props = {
  form: SoDraftFormState;
  locations: SalesLocationOption[];
  customers: CustomerOption[];
  disabled?: boolean;
  onPatch: (patch: Partial<SoDraftFormState>) => void;
};

export function SoFormHeader({ form, locations, customers, disabled = false, onPatch }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <SoCustomerCombobox
        customers={customers}
        value={form.customer_id}
        disabled={disabled}
        onChange={(customerId) => {
          const states = customerDefaultStates(
            customers,
            customerId,
            locations,
            form.shipping_location_id
          );
          onPatch({
            customer_id: customerId,
            billing_state: states.billing_state,
            shipping_state: states.shipping_state,
          });
        }}
      />

      <div className="min-w-0 space-y-2">
        <Label htmlFor="so-shipping-location">Ship from</Label>
        <Select
          value={form.shipping_location_id}
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
              shipping_location_id: value,
              billing_state: states.billing_state,
              shipping_state: states.shipping_state,
            });
          }}
        >
          <SelectTrigger id="so-shipping-location" className="w-full min-w-0">
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

      <div className="min-w-0 space-y-2">
        <Label htmlFor="so-customer-po">Customer PO</Label>
        <Input
          id="so-customer-po"
          value={form.custom_fields.customer_po_number}
          disabled={disabled}
          onChange={(event) =>
            onPatch({
              custom_fields: {
                ...form.custom_fields,
                customer_po_number: event.target.value,
              },
            })
          }
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="so-billing-state">Billing state</Label>
        <Input
          id="so-billing-state"
          value={form.billing_state}
          disabled={disabled}
          onChange={(event) => onPatch({ billing_state: event.target.value })}
        />
      </div>

      <div className="min-w-0 space-y-2">
        <Label htmlFor="so-shipping-state">Shipping state</Label>
        <Input
          id="so-shipping-state"
          value={form.shipping_state}
          disabled={disabled}
          onChange={(event) => onPatch({ shipping_state: event.target.value })}
        />
      </div>

      <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-3">
        <Label htmlFor="so-requested-ship-date">Requested ship date</Label>
        <Input
          id="so-requested-ship-date"
          type="date"
          value={form.custom_fields.requested_ship_date}
          disabled={disabled}
          onChange={(event) =>
            onPatch({
              custom_fields: {
                ...form.custom_fields,
                requested_ship_date: event.target.value,
              },
            })
          }
        />
      </div>

      <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-3">
        <Label htmlFor="so-internal-notes">Internal notes</Label>
        <textarea
          id="so-internal-notes"
          className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={form.custom_fields.internal_notes}
          disabled={disabled}
          rows={3}
          onChange={(event) =>
            onPatch({
              custom_fields: {
                ...form.custom_fields,
                internal_notes: event.target.value,
              },
            })
          }
        />
      </div>
    </div>
  );
}
