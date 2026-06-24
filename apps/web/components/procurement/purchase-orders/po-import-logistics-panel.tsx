"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import { resolvePoGstContextFromForm } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { PoFulfillmentStage } from "@/lib/procurement/import-logistics-settings-shared";
import type { ProcurementLocationOption, ProcurementSupplierOption } from "@/lib/procurement/shared/types";
import { isGstImportSupplyNature } from "@/lib/tax/gst-supply-context";

const TENANT_DEFAULT_VALUE = "__TENANT_DEFAULT__";
const NONE_VALUE = "__NONE__";

type Props = {
  form: PoDraftFormState;
  locations: ProcurementLocationOption[];
  suppliers: ProcurementSupplierOption[];
  tenantCountry?: string | null;
  tenantDefaultFulfillmentStage: PoFulfillmentStage;
  disabled?: boolean;
  onPatch: (patch: Partial<PoDraftFormState>) => void;
};

export function PoImportLogisticsPanel({
  form,
  locations,
  suppliers,
  tenantCountry,
  tenantDefaultFulfillmentStage,
  disabled = false,
  onPatch,
}: Props) {
  const gstCtx = resolvePoGstContextFromForm(
    suppliers,
    form.supplier_id,
    locations,
    form.destination_location_id,
    tenantCountry
  );

  if (!isGstImportSupplyNature(gstCtx.supplyNature)) {
    return null;
  }

  const fulfillmentValue =
    form.po_fulfillment_stage_override?.trim() || TENANT_DEFAULT_VALUE;
  const receiptValue = form.receipt_location_id?.trim() || NONE_VALUE;
  const ultimateValue =
    form.ultimate_destination_location_id?.trim() ||
    form.destination_location_id?.trim() ||
    NONE_VALUE;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <p className="text-sm font-medium">Import receipt routing</p>
        <p className="text-xs text-muted-foreground">
          Staging and fulfillment settings for overseas import purchase orders.
        </p>
      </div>

      <div className="grid gap-2">
        <Label>PO fulfillment stage</Label>
        <Select
          value={fulfillmentValue}
          disabled={disabled}
          onValueChange={(value) =>
            onPatch({
              po_fulfillment_stage_override:
                value === TENANT_DEFAULT_VALUE
                  ? ""
                  : (value as PoFulfillmentStage),
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TENANT_DEFAULT_VALUE}>
              Tenant default ({tenantDefaultFulfillmentStage === "FINAL" ? "Final" : "Commercial"})
            </SelectItem>
            <SelectItem value="COMMERCIAL">Commercial receipt</SelectItem>
            <SelectItem value="FINAL">Final warehouse receipt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Staging / receipt location</Label>
        <Select
          value={receiptValue}
          disabled={disabled}
          onValueChange={(value) =>
            onPatch({
              receipt_location_id: value === NONE_VALUE ? "" : value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Same as destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Same as destination</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Ultimate destination warehouse</Label>
        <Select
          value={ultimateValue}
          disabled={disabled}
          onValueChange={(value) =>
            onPatch({
              ultimate_destination_location_id: value === NONE_VALUE ? "" : value,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Same as destination" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>Same as destination</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
