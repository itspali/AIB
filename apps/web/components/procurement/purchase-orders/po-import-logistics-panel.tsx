"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImportLogisticsFieldLabel } from "@/components/procurement/import-logistics/import-logistics-field-label";
import { ProcurementLocationCombobox } from "@/components/procurement/shared/procurement-location-combobox";
import { SubsectionHeading } from "@/components/ui/field-label-info";
import type { PoDraftFormState } from "@/lib/procurement/purchase-orders/draft-form";
import { resolvePoGstContextFromForm } from "@/lib/procurement/purchase-orders/po-tax-supply";
import type { PoFulfillmentStage } from "@/lib/procurement/import-logistics-settings-shared";
import {
  IMPORT_LOGISTICS_PO_HELP,
  IMPORT_LOGISTICS_PO_LABELS,
} from "@/lib/procurement/import-logistics/field-labels";
import type { ProcurementLocationOption, ProcurementSupplierOption } from "@/lib/procurement/shared/types";
import { isGstImportSupplyNature } from "@/lib/tax/gst-supply-context";
import { useOnboardingContext } from "@/components/onboarding/onboarding-context";

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
  const { importsEnabled } = useOnboardingContext();

  const gstCtx = resolvePoGstContextFromForm(
    suppliers,
    form.supplier_id,
    locations,
    form.destination_location_id,
    tenantCountry
  );

  if (!importsEnabled || !isGstImportSupplyNature(gstCtx.supplyNature)) {
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
      <SubsectionHeading
        title="Import receipt routing"
        info={
          <p>
            Staging and fulfillment settings for overseas import purchase orders. These values
            prefill when you create an import shipment from this PO.
          </p>
        }
        compact
      />

      <div className="grid gap-2">
        <ImportLogisticsFieldLabel
          label={IMPORT_LOGISTICS_PO_LABELS.fulfillmentStage}
          help={IMPORT_LOGISTICS_PO_HELP.fulfillmentStage}
        />
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

      <ProcurementLocationCombobox
        locations={locations}
        value={receiptValue === NONE_VALUE ? null : receiptValue}
        disabled={disabled}
        label={IMPORT_LOGISTICS_PO_LABELS.firstReceivingLocation}
        help={IMPORT_LOGISTICS_PO_HELP.firstReceivingLocation}
        allowEmpty
        emptyLabel="Same as destination"
        placeholder="Same as destination or search…"
        onChange={(locationId) =>
          onPatch({
            receipt_location_id: locationId ?? "",
          })
        }
      />

      <ProcurementLocationCombobox
        locations={locations}
        value={ultimateValue === NONE_VALUE ? null : ultimateValue}
        disabled={disabled}
        label={IMPORT_LOGISTICS_PO_LABELS.finalWarehouse}
        help={IMPORT_LOGISTICS_PO_HELP.finalWarehouse}
        allowEmpty
        emptyLabel="Same as destination"
        placeholder="Same as destination or search…"
        onChange={(locationId) =>
          onPatch({
            ultimate_destination_location_id: locationId ?? "",
          })
        }
      />
    </div>
  );
}
