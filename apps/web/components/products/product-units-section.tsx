"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldLabelInfo, fieldHelpText, mergeFieldLabelInfo, SubsectionHeading } from "@/components/ui/field-label-info";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCatalogContext, ProductMasterFormValues } from "@/lib/products/types";
import { ITEM_EDITOR_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { editorCatalogBlockClass, editorGridClass, useEditorPanelLayout } from "@/lib/products/editor-chrome";
import { formatAlternateUomConversionPreview } from "@/lib/products/item-uom-commerce";
import { resolveUomOptions, withUomValue, type UomOption } from "@/lib/products/uom-options";
import { cn } from "@/lib/utils";

type Props = {
  catalogContext: ProductCatalogContext;
  baseUom: string;
  alternateUoms: ProductMasterFormValues["alternate_uoms"];
  isPhysical: boolean;
  stockUnitDisabled?: boolean;
  stockUnitLocked?: boolean;
  alternatesDisabled?: boolean;
  onBaseUomChange: (code: string) => void;
  onAlternateUomsChange: (rows: ProductMasterFormValues["alternate_uoms"]) => void;
};

export function ProductUnitsSection({
  catalogContext,
  baseUom,
  alternateUoms,
  isPhysical,
  stockUnitDisabled,
  stockUnitLocked,
  alternatesDisabled,
  onBaseUomChange,
  onAlternateUomsChange,
}: Props) {
  const panel = useEditorPanelLayout();
  const uomOptions = resolveUomOptions(catalogContext.uoms);
  const baseUomOptions: UomOption[] = withUomValue(uomOptions, baseUom);
  const alternateUomOptions = uomOptions.filter((option) => option.code !== baseUom);
  const defaultAlternateUomCode = alternateUomOptions[0]?.code ?? "";

  const baseUnitInfo = mergeFieldLabelInfo(
    fieldHelpText(
      isPhysical ? ITEM_EDITOR_FIELD_HELP.baseUnitPhysical : ITEM_EDITOR_FIELD_HELP.baseUnitNonPhysical
    ),
    stockUnitLocked ? fieldHelpText(ITEM_EDITOR_FIELD_HELP.lockedField) : null
  );

  return (
    <div className={panel ? "space-y-3" : "space-y-6"}>
      <div className={editorGridClass(panel)}>
        <div className={cn("min-w-0", panel ? "space-y-1.5" : "space-y-2")}>
          <div className="flex items-center gap-1.5">
            <Label className={cn("font-medium text-muted-foreground", panel ? "text-xs" : "text-sm")}>
              Base unit
            </Label>
            {baseUnitInfo ? <FieldLabelInfo label="Base unit">{baseUnitInfo}</FieldLabelInfo> : null}
            {stockUnitLocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                Locked
              </span>
            ) : null}
          </div>
          <Select
            value={baseUom}
            disabled={stockUnitDisabled || stockUnitLocked}
            onValueChange={onBaseUomChange}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {baseUomOptions.map((option) => (
                <SelectItem key={option.code} value={option.code}>
                  {option.code}
                  {option.name && option.name !== option.code ? ` · ${option.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={editorCatalogBlockClass(panel)}>
        <div className="flex items-center justify-between gap-2">
          <SubsectionHeading
            title="Alternate units"
            compact={panel}
            info={fieldHelpText(ITEM_EDITOR_FIELD_HELP.alternateUnits)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={alternatesDisabled || defaultAlternateUomCode === ""}
            onClick={() =>
              onAlternateUomsChange([
                ...alternateUoms,
                { uom_code: defaultAlternateUomCode, conversion_factor: "1" },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add unit
          </Button>
        </div>
        {alternateUoms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alternate units configured.</p>
        ) : (
          <div className="space-y-2">
            <div className="hidden gap-2 sm:grid sm:grid-cols-[1fr_1fr_auto]">
              <span className="text-xs font-medium text-muted-foreground">Unit</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Conversion factor</span>
                <FieldLabelInfo label="Conversion factor">
                  {fieldHelpText(ITEM_EDITOR_FIELD_HELP.conversionFactor)}
                </FieldLabelInfo>
              </div>
              <span className="sr-only">Actions</span>
            </div>
            {alternateUoms.map((row, index) => {
              const conversionPreview = formatAlternateUomConversionPreview(
                row.uom_code,
                row.conversion_factor,
                baseUom,
                uomOptions
              );

              return (
                <div
                  key={`alternate-uom-${index}`}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
                >
                  <Select
                    value={row.uom_code}
                    disabled={alternatesDisabled}
                    onValueChange={(value) => {
                      const next = [...alternateUoms];
                      next[index] = { ...next[index], uom_code: value };
                      onAlternateUomsChange(next);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {alternateUomOptions.map((option) => (
                        <SelectItem key={option.code} value={option.code}>
                          {option.code}
                          {option.name && option.name !== option.code ? ` · ${option.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    disabled={alternatesDisabled}
                    className="font-mono text-right"
                    inputMode="decimal"
                    placeholder="Conversion factor"
                    value={row.conversion_factor}
                    onChange={(event) => {
                      const next = [...alternateUoms];
                      next[index] = { ...next[index], conversion_factor: event.target.value };
                      onAlternateUomsChange(next);
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive sm:row-span-2"
                    disabled={alternatesDisabled}
                    onClick={() =>
                      onAlternateUomsChange(alternateUoms.filter((_, rowIndex) => rowIndex !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <p
                    className={cn(
                      "text-xs leading-snug sm:col-span-2",
                      conversionPreview ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {conversionPreview ??
                      `Enter how many ${baseUom.toLowerCase()} are in one ${row.uom_code.toLowerCase()} (e.g. 1 box = 12 pieces → 12).`}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
