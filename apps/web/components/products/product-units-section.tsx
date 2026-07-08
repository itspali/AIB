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
import {
  editorCatalogBlockClass,
  editorFieldInlineHintClass,
  editorFieldLabelClass,
  useEditorPanelLayout,
} from "@/lib/products/editor-chrome";
import { useEditorFieldHelp } from "@/components/products/product-editor/editor-field-help";
import { formatAlternateUomConversionPreview } from "@/lib/products/item-uom-commerce";
import { resolveUomOptions, withUomValue, type UomOption } from "@/lib/products/uom-options";
import { cn } from "@/lib/utils";

type BaseUnitFieldProps = {
  catalogContext: ProductCatalogContext;
  baseUom: string;
  isPhysical: boolean;
  stockUnitDisabled?: boolean;
  stockUnitLocked?: boolean;
  onBaseUomChange: (code: string) => void;
};

export function ProductBaseUnitField({
  catalogContext,
  baseUom,
  isPhysical,
  stockUnitDisabled,
  stockUnitLocked,
  onBaseUomChange,
}: BaseUnitFieldProps) {
  const panel = useEditorPanelLayout();
  const showFieldHelp = useEditorFieldHelp();
  const uomOptions = resolveUomOptions(catalogContext.uoms);
  const baseUomOptions: UomOption[] = withUomValue(uomOptions, baseUom);

  const baseUnitHint = isPhysical
    ? ITEM_EDITOR_FIELD_HELP.baseUnitPhysical
    : ITEM_EDITOR_FIELD_HELP.baseUnitNonPhysical;

  const baseUnitInfo = mergeFieldLabelInfo(
    fieldHelpText(baseUnitHint),
    stockUnitLocked ? fieldHelpText(ITEM_EDITOR_FIELD_HELP.lockedField) : null
  );

  return (
    <div className={cn("min-w-0", panel ? "space-y-1.5" : "space-y-2")}>
      <div className="flex items-center gap-1.5">
        <Label className={editorFieldLabelClass(panel)}>Base unit</Label>
        {baseUnitInfo && !showFieldHelp ? (
          <FieldLabelInfo label="Base unit">{baseUnitInfo}</FieldLabelInfo>
        ) : null}
        {stockUnitLocked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground ring-1 ring-border">
            Locked
          </span>
        ) : null}
      </div>
      {showFieldHelp ? (
        <p className={editorFieldInlineHintClass(panel)}>{baseUnitHint}</p>
      ) : null}
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
  );
}

type Props = {
  catalogContext: ProductCatalogContext;
  baseUom: string;
  alternateUoms: ProductMasterFormValues["alternate_uoms"];
  alternatesDisabled?: boolean;
  hideHeading?: boolean;
  onAlternateUomsChange: (rows: ProductMasterFormValues["alternate_uoms"]) => void;
};

export function ProductUnitsSection({
  catalogContext,
  baseUom,
  alternateUoms,
  alternatesDisabled,
  hideHeading,
  onAlternateUomsChange,
}: Props) {
  const panel = useEditorPanelLayout();
  const showFieldHelp = useEditorFieldHelp();
  const uomOptions = resolveUomOptions(catalogContext.uoms);
  const alternateUomOptions = uomOptions.filter((option) => option.code !== baseUom);
  const defaultAlternateUomCode = alternateUomOptions[0]?.code ?? "";

  return (
    <div className={panel ? "space-y-3" : "space-y-6"}>
      <div className={editorCatalogBlockClass(panel)}>
        {hideHeading ? null : (
          <SubsectionHeading
            title="Alternate units"
            compact={panel}
            info={fieldHelpText(ITEM_EDITOR_FIELD_HELP.alternateUnits)}
          />
        )}
        <div className="space-y-2">
          {alternateUoms.length > 0 ? (
            <div className="hidden gap-2 md:grid md:grid-cols-[1fr_1fr_auto]">
              <span className="text-xs font-medium text-muted-foreground">Unit</span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Conversion factor</span>
                  {!showFieldHelp ? (
                    <FieldLabelInfo label="Conversion factor">
                      {fieldHelpText(ITEM_EDITOR_FIELD_HELP.conversionFactor)}
                    </FieldLabelInfo>
                  ) : null}
                </div>
                {showFieldHelp ? (
                  <span className={editorFieldInlineHintClass(panel)}>
                    {ITEM_EDITOR_FIELD_HELP.conversionFactor}
                  </span>
                ) : null}
              </div>
              <span className="sr-only">Actions</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No alternate units configured.</p>
          )}
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
                  className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto] md:items-start"
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
                      "text-xs leading-snug md:col-span-2",
                      conversionPreview ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {conversionPreview ??
                      `Enter how many ${baseUom.toLowerCase()} are in one ${row.uom_code.toLowerCase()} (e.g. 1 box = 12 pieces → 12).`}
                  </p>
                </div>
              );
            })}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1 px-0 font-medium text-primary hover:bg-transparent hover:text-primary",
              panel ? "text-xs" : "text-sm"
            )}
            disabled={alternatesDisabled || defaultAlternateUomCode === ""}
            onClick={() =>
              onAlternateUomsChange([
                ...alternateUoms,
                { uom_code: defaultAlternateUomCode, conversion_factor: "1" },
              ])
            }
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Add unit
          </Button>
        </div>
      </div>
    </div>
  );
}
