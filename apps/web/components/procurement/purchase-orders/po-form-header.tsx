"use client";

import { PoSupplierCombobox } from "@/components/procurement/purchase-orders/po-supplier-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  /** Set only for saved drafts — hidden on new PO create until first save assigns a number. */
  assignedVoucherNumber?: string | null;
  disabled?: boolean;
  /** Single column when the drawer is at 40vw peek width. */
  stackVertically?: boolean;
  /** Workspace base currency when the supplier has no trading currency override. */
  defaultCurrency?: string;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

export function PoFormHeader({
  form,
  locations,
  suppliers,
  assignedVoucherNumber,
  disabled = false,
  stackVertically = false,
  defaultCurrency = "USD",
  onPatch,
}: Props) {
  const showPoNumber = Boolean(assignedVoucherNumber?.trim());

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:gap-4">
      {showPoNumber ? (
        <div className="min-w-0 space-y-2">
          <Label>PO number</Label>
          <Input readOnly value={assignedVoucherNumber ?? ""} className="font-mono text-sm" />
        </div>
      ) : null}

      <div
        className={cn(
          "grid min-w-0 gap-2 sm:gap-4",
          stackVertically ? "grid-cols-1" : "grid-cols-3"
        )}
      >
        <div className="min-w-0 space-y-2">
          <Label>Destination</Label>
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

        <PoSupplierCombobox
          className="min-w-0"
          suppliers={suppliers}
          value={form.supplier_id}
          disabled={disabled}
          onChange={(supplierId) =>
            onPatch({
              supplier_id: supplierId,
              payment_terms_days: supplierPaymentTerms(suppliers, supplierId),
              currency_code: supplierDefaultCurrency(suppliers, supplierId, defaultCurrency),
            })
          }
        />

        <div className="min-w-0 space-y-2">
          <Label>Currency</Label>
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
      </div>
    </div>
  );
}
