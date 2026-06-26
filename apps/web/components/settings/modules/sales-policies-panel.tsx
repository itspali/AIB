"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSalesPolicies } from "@/app/settings/operations/sales/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  SALES_DOCUMENT_CONVERSION_MODE_OPTIONS,
  type SalesDocumentConversionMode,
} from "@/lib/sales/document-conversion-settings";

type Props = {
  initialDocumentConversionMode: SalesDocumentConversionMode;
  canEdit: boolean;
};

export function SalesPoliciesPanel({ initialDocumentConversionMode, canEdit }: Props) {
  const [documentConversionMode, setDocumentConversionMode] = useState(
    initialDocumentConversionMode
  );
  const [isPending, startTransition] = useTransition();

  const isDirty = documentConversionMode !== initialDocumentConversionMode;

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveSalesPolicies({ document_conversion_mode: documentConversionMode });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Sales policies saved.");
    });
  };

  return (
    <div className="space-y-4">
      <OrgSettingsSection
        title="Document conversion"
        description="Choose how quote-to-order, quote-to-invoice, and order-to-invoice conversions behave."
      >
        <RadioGroup
          value={documentConversionMode}
          disabled={!canEdit || isPending}
          onValueChange={(value) =>
            setDocumentConversionMode(value as SalesDocumentConversionMode)
          }
          className="space-y-2"
        >
          {SALES_DOCUMENT_CONVERSION_MODE_OPTIONS.map((option) => (
            <Label
              key={option.value}
              htmlFor={`sales_conversion_${option.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-border px-4 py-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-muted/30"
            >
              <RadioGroupItem
                id={`sales_conversion_${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium">{option.title}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </OrgSettingsSection>

      {canEdit ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
            {isPending ? "Saving…" : "Save policies"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
