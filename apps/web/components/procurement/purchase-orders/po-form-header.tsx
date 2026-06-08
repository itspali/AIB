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

import { supplierPaymentTerms } from "@/lib/procurement/purchase-orders/draft-form";

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
  onPatch: (patch: Partial<PoDraftFormState>) => void;

};



export function PoFormHeader({

  form,

  locations,

  suppliers,

  assignedVoucherNumber,
  disabled = false,
  stackVertically = false,
  onPatch,
}: Props) {
  const showPoNumber = Boolean(assignedVoucherNumber?.trim());

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        !stackVertically &&
          (showPoNumber ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2")
      )}
    >

      {showPoNumber ? (

        <div className="space-y-2">

          <Label>PO number</Label>

          <Input readOnly value={assignedVoucherNumber} className="font-mono text-sm" />

        </div>

      ) : null}



      <div className="space-y-2">

        <Label>Destination location</Label>

        <Select

          value={form.destination_location_id}

          disabled={disabled}

          onValueChange={(value) => onPatch({ destination_location_id: value })}

        >

          <SelectTrigger>

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

        suppliers={suppliers}

        value={form.supplier_id}

        disabled={disabled}

        onChange={(supplierId) =>

          onPatch({

            supplier_id: supplierId,

            payment_terms_days: supplierPaymentTerms(suppliers, supplierId),

          })

        }

      />

    </div>

  );

}

