"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTaxRates } from "@/app/onboarding/actions";
import type { StepSubmitHandle, TaxRateRow } from "@/lib/onboarding/types";

const DEFAULT_ROWS: TaxRateRow[] = [
  {
    tax_component_name: "CGST_9",
    tax_percentage: "9.00",
    active_from_date: new Date().toISOString().slice(0, 10),
    legal_compliance_code: "HSN",
  },
  {
    tax_component_name: "SGST_9",
    tax_percentage: "9.00",
    active_from_date: new Date().toISOString().slice(0, 10),
    legal_compliance_code: "HSN",
  },
  {
    tax_component_name: "IGST_18",
    tax_percentage: "18.00",
    active_from_date: new Date().toISOString().slice(0, 10),
    legal_compliance_code: "HSN",
  },
];

type Props = {
  completed: boolean;
  taxRateCount: number;
  initialRows?: TaxRateRow[];
  showAdvanced: boolean;
};

export const StepTaxRegistry = forwardRef<StepSubmitHandle, Props>(function StepTaxRegistry(
  { completed, taxRateCount, initialRows, showAdvanced },
  ref
) {
  const [rows, setRows] = useState<TaxRateRow[]>(initialRows?.length ? initialRows : DEFAULT_ROWS);

  useImperativeHandle(ref, () => ({
    submit: async () => saveTaxRates(rows),
  }));

  if (completed) {
    return (
      <p className="text-sm text-muted-foreground">
        {taxRateCount} active tax component{taxRateCount === 1 ? "" : "s"} registered for statutory returns.
      </p>
    );
  }

  const updateRow = (index: number, field: keyof TaxRateRow, value: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="p-3 font-medium text-muted-foreground">Component</th>
              <th className="p-3 font-medium text-muted-foreground text-right">Rate %</th>
              <th className="p-3 font-medium text-muted-foreground">Active From</th>
              {showAdvanced && (
                <th className="p-3 font-medium text-muted-foreground">Active To</th>
              )}
              <th className="p-3 font-medium text-muted-foreground">HSN/SAC Token</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2">
                  <Input
                    value={row.tax_component_name}
                    onChange={(e) => updateRow(i, "tax_component_name", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    className="text-right"
                    value={row.tax_percentage}
                    onChange={(e) => updateRow(i, "tax_percentage", e.target.value)}
                  />
                </td>
                <td className="p-2">
                  <Input
                    type="date"
                    value={row.active_from_date.slice(0, 10)}
                    onChange={(e) => updateRow(i, "active_from_date", e.target.value)}
                  />
                </td>
                {showAdvanced && (
                  <td className="p-2">
                    <Input
                      type="date"
                      value={row.active_to_date?.slice(0, 10) || ""}
                      onChange={(e) => updateRow(i, "active_to_date", e.target.value)}
                    />
                  </td>
                )}
                <td className="p-2">
                  <Input
                    value={row.legal_compliance_code || ""}
                    onChange={(e) => updateRow(i, "legal_compliance_code", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setRows((prev) => [
            ...prev,
            {
              tax_component_name: "",
              tax_percentage: "0.00",
              active_from_date: new Date().toISOString().slice(0, 10),
            },
          ])
        }
      >
        Add Tax Row
      </Button>
    </div>
  );
});
