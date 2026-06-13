"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProcurementPolicies } from "@/app/settings/modules/procurement/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PO_AUTO_ROUND_OFF_STEP_PRESETS,
  type PoAutoRoundOffStepPreset,
} from "@/lib/procurement/purchase-orders/po-auto-round-off";
import type { LandedCostAllocationMethod, ProcurementSettings } from "@/lib/procurement/settings";

type Props = {
  initialSettings: Pick<
    ProcurementSettings,
    | "po_auto_round_off_enabled"
    | "po_auto_round_off_step"
    | "is_po_mandatory_for_grn"
    | "is_qc_required_before_stocking"
    | "allow_qc_line_override"
    | "allow_zero_cost_receipts"
    | "promo_default_category"
    | "landed_cost_allocation_method"
    | "absorb_sunk_logistics_overhead"
    | "matching_tolerance_percentage"
    | "po_mrp_trade_terms_enabled"
    | "allow_edit_issued_purchase_orders"
    | "allow_line_item_discounts"
    | "allow_transaction_discounts"
    | "purchase_prices_tax_inclusive"
  >;
  canEdit: boolean;
};

function formatStepLabel(step: PoAutoRoundOffStepPreset): string {
  if (step === 1) return "1.00 (whole unit)";
  return step.toFixed(2);
}

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function ProcurementPoliciesPanel({ initialSettings, canEdit }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const patch = (partial: Partial<typeof settings>) => {
    setSettings((current) => ({ ...current, ...partial }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProcurementPolicies(settings);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Procurement policies saved.");
    });
  };

  return (
    <div className="space-y-4">
      <OrgSettingsSection
        title="Purchase order totals"
        description="Control how purchase order grand totals are rounded before issue."
      >
        <div className="space-y-3">
          <SwitchRow
            label="Auto round-off on purchase order totals"
            description="When enabled, round-off is computed automatically and grand total is adjusted to the nearest configured step."
            checked={settings.po_auto_round_off_enabled}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ po_auto_round_off_enabled: checked })}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <div>
              <Label htmlFor="po_auto_round_off_step" className="text-sm font-medium">
                Round to nearest
              </Label>
              <p className="text-xs text-muted-foreground">Applies when auto round-off is enabled.</p>
            </div>
            <Select
              value={String(settings.po_auto_round_off_step)}
              disabled={!canEdit || isPending || !settings.po_auto_round_off_enabled}
              onValueChange={(value) =>
                patch({ po_auto_round_off_step: Number(value) as PoAutoRoundOffStepPreset })
              }
            >
              <SelectTrigger id="po_auto_round_off_step" className="h-8 w-[10rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PO_AUTO_ROUND_OFF_STEP_PRESETS.map((preset) => (
                  <SelectItem key={preset} value={String(preset)} className="text-xs">
                    {formatStepLabel(preset)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Purchase order document"
        description="Line layout, pricing defaults, and editing rules for purchase orders."
      >
        <div className="space-y-3">
          <SwitchRow
            label="MRP and trade terms columns"
            description="Show MRP and trade-term fields on purchase order lines when catalog data supports them."
            checked={settings.po_mrp_trade_terms_enabled}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ po_mrp_trade_terms_enabled: checked })}
          />
          <SwitchRow
            label="Allow editing issued purchase orders"
            description="Users with edit permission can change issued orders that have not yet been received."
            checked={settings.allow_edit_issued_purchase_orders}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ allow_edit_issued_purchase_orders: checked })}
          />
          <SwitchRow
            label="Purchase prices include tax"
            description="Default tax-inclusive pricing for new purchase orders. Each PO can override on the line table."
            checked={settings.purchase_prices_tax_inclusive}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ purchase_prices_tax_inclusive: checked })}
          />
          <SwitchRow
            label="Line item discounts"
            description="Allow discount percentage or amount on individual purchase order lines."
            checked={settings.allow_line_item_discounts}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ allow_line_item_discounts: checked })}
          />
          <SwitchRow
            label="Transaction-level discounts"
            description="Allow a document-level discount on purchase order totals."
            checked={settings.allow_transaction_discounts}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ allow_transaction_discounts: checked })}
          />
        </div>
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Receiving & promotions"
        description="Goods receipt rules and promotional stock defaults."
      >
        <div className="space-y-3">
          <SwitchRow
            label="Purchase order required for receipts"
            description="When enabled, every goods receipt must reference an issued purchase order."
            checked={settings.is_po_mandatory_for_grn}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ is_po_mandatory_for_grn: checked })}
          />
          <SwitchRow
            label="Quality check before stocking"
            description="Paid stock is held in a QC sub-pool until inspection release posts it to sellable inventory."
            checked={settings.is_qc_required_before_stocking}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ is_qc_required_before_stocking: checked })}
          />
          <SwitchRow
            label="Allow per-line QC override on receipts"
            description="When enabled, receivers can toggle QC hold per line on a goods receipt."
            checked={settings.allow_qc_line_override}
            disabled={!canEdit || isPending || !settings.is_qc_required_before_stocking}
            onCheckedChange={(checked) => patch({ allow_qc_line_override: checked })}
          />
          <SwitchRow
            label="Allow zero-cost receipt lines"
            description="Permit promotional or free goods on goods receipts when unit cost is zero."
            checked={settings.allow_zero_cost_receipts}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ allow_zero_cost_receipts: checked })}
          />
          <div className="rounded-lg border border-border px-4 py-3">
            <Label htmlFor="promo_default_category" className="text-sm font-medium">
              Default promotional category
            </Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Applied when a purchase order line has a zero rate.
            </p>
            <Input
              id="promo_default_category"
              value={settings.promo_default_category}
              disabled={!canEdit || isPending}
              onChange={(event) => patch({ promo_default_category: event.target.value })}
            />
          </div>
        </div>
      </OrgSettingsSection>

      <OrgSettingsSection
        title="Landed cost & matching"
        description="Freight allocation defaults and invoice matching tolerance."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
            <div>
              <Label className="text-sm font-medium">Landed cost allocation</Label>
              <p className="text-xs text-muted-foreground">
                Default method for spreading freight and import charges across receipt lines.
              </p>
            </div>
            <Select
              value={settings.landed_cost_allocation_method}
              disabled={!canEdit || isPending}
              onValueChange={(value) =>
                patch({ landed_cost_allocation_method: value as LandedCostAllocationMethod })
              }
            >
              <SelectTrigger className="h-8 w-[10rem] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BY_QUANTITY">By quantity</SelectItem>
                <SelectItem value="BY_VALUE">By value</SelectItem>
                <SelectItem value="BY_WEIGHT">By weight</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SwitchRow
            label="Absorb sunk logistics on rejected qty"
            description="Rejected quantities still absorb allocated freight when this policy is on."
            checked={settings.absorb_sunk_logistics_overhead}
            disabled={!canEdit || isPending}
            onCheckedChange={(checked) => patch({ absorb_sunk_logistics_overhead: checked })}
          />
          <div className="rounded-lg border border-border px-4 py-3">
            <Label htmlFor="matching_tolerance_percentage" className="text-sm font-medium">
              Three-way match tolerance (%)
            </Label>
            <p className="mb-2 text-xs text-muted-foreground">
              Allowed variance between order, receipt, and invoice rates before placing a hold.
            </p>
            <Input
              id="matching_tolerance_percentage"
              inputMode="decimal"
              value={String(settings.matching_tolerance_percentage)}
              disabled={!canEdit || isPending}
              onChange={(event) =>
                patch({ matching_tolerance_percentage: Number(event.target.value) || 0 })
              }
            />
          </div>
        </div>
      </OrgSettingsSection>

      {canEdit ? (
        <div className="flex justify-end">
          <Button size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save policies"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
