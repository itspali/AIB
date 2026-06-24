"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createEmptyQcTestParameterRow,
  QC_TEST_PARAMETER_TYPES,
  qcTestParameterTypeLabel,
  type QcTestParameterFormRow,
  type QcTestTemplateFormState,
} from "@/lib/procurement/quality-inspection/template-form";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_HEADER_CELL,
  listTableElementClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import { cn } from "@/lib/utils";

const QC_TEST_TABLE_FRAME =
  "overflow-x-auto rounded-lg border border-border bg-background shadow-sm";

type Props = {
  value: QcTestTemplateFormState;
  onChange: (value: QcTestTemplateFormState) => void;
  readOnly?: boolean;
  disabled?: boolean;
};

function formatReadOnlyCriteria(row: QcTestParameterFormRow): string {
  switch (row.parameter_type) {
    case "NUMERIC": {
      const min = row.min_value.trim();
      const max = row.max_value.trim();
      if (min && max) return `${min} – ${max}`;
      if (min) return `Min ${min}`;
      if (max) return `Max ${max}`;
      return "—";
    }
    case "TEXT":
      return row.expected_text.trim() || "—";
    case "CHOICE":
      return row.choice_options_text.trim() || "—";
    case "BOOLEAN":
      return "Pass / fail";
  }
}

function QcTestCriteriaCell({
  row,
  index,
  controlsDisabled,
  onPatch,
}: {
  row: QcTestParameterFormRow;
  index: number;
  controlsDisabled: boolean;
  onPatch: (patch: Partial<QcTestParameterFormRow>) => void;
}) {
  switch (row.parameter_type) {
    case "NUMERIC":
      return (
        <div className="flex min-w-[10rem] items-center gap-1.5">
          <Input
            className="h-8 tabular-nums"
            value={row.min_value}
            disabled={controlsDisabled}
            placeholder="Min"
            inputMode="decimal"
            aria-label={`Minimum for ${row.name || `test ${index + 1}`}`}
            onChange={(event) => onPatch({ min_value: event.target.value })}
          />
          <span className="text-xs text-muted-foreground">–</span>
          <Input
            className="h-8 tabular-nums"
            value={row.max_value}
            disabled={controlsDisabled}
            placeholder="Max"
            inputMode="decimal"
            aria-label={`Maximum for ${row.name || `test ${index + 1}`}`}
            onChange={(event) => onPatch({ max_value: event.target.value })}
          />
        </div>
      );
    case "TEXT":
      return (
        <Input
          className="h-8 min-w-[10rem]"
          value={row.expected_text}
          disabled={controlsDisabled}
          placeholder="Expected value"
          aria-label={`Expected text for ${row.name || `test ${index + 1}`}`}
          onChange={(event) => onPatch({ expected_text: event.target.value })}
        />
      );
    case "CHOICE":
      return (
        <Input
          className="h-8 min-w-[12rem]"
          value={row.choice_options_text}
          disabled={controlsDisabled}
          placeholder="Grade A, Grade B, Reject"
          aria-label={`Choices for ${row.name || `test ${index + 1}`}`}
          onChange={(event) => onPatch({ choice_options_text: event.target.value })}
        />
      );
    case "BOOLEAN":
      return <span className="text-xs text-muted-foreground">Pass / fail response</span>;
  }
}

export function QcTestTemplateEditor({ value, onChange, readOnly = false, disabled = false }: Props) {
  const controlsDisabled = readOnly || disabled;

  const patchParameter = (index: number, patch: Partial<QcTestParameterFormRow>) => {
    onChange({
      ...value,
      parameters: value.parameters.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row
      ),
    });
  };

  const removeParameter = (index: number) => {
    onChange({
      ...value,
      parameters: value.parameters.filter((_, rowIndex) => rowIndex !== index),
    });
  };

  const addParameter = () => {
    onChange({
      ...value,
      parameters: [...value.parameters, createEmptyQcTestParameterRow()],
    });
  };

  if (readOnly) {
    if (!value.name.trim() && value.parameters.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">No inspection tests defined at this scope.</p>
      );
    }

    return (
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">{value.name}</p>
          {value.description.trim() ? (
            <p className="mt-1 text-xs text-muted-foreground">{value.description}</p>
          ) : null}
        </div>
        {value.parameters.length > 0 ? (
          <div className={QC_TEST_TABLE_FRAME}>
            <table className={listTableElementClass("medium")}>
              <thead>
                <tr className="text-left">
                  <th className={LIST_TABLE_HEADER_CELL}>Test</th>
                  <th className={LIST_TABLE_HEADER_CELL}>Type</th>
                  <th className={LIST_TABLE_HEADER_CELL}>Criteria</th>
                  <th className={cn(LIST_TABLE_HEADER_CELL, "w-[5.5rem] text-right")}>
                    Mandatory
                  </th>
                </tr>
              </thead>
              <tbody>
                {value.parameters.map((row) => (
                  <tr key={row.clientKey} className={listTableRowClass(false, false)}>
                    <td className={LIST_TABLE_BODY_CELL}>
                      <span className="font-medium">{row.name || "—"}</span>
                    </td>
                    <td className={LIST_TABLE_BODY_CELL}>
                      {qcTestParameterTypeLabel(row.parameter_type)}
                    </td>
                    <td className={LIST_TABLE_BODY_CELL}>{formatReadOnlyCriteria(row)}</td>
                    <td className={cn(LIST_TABLE_BODY_CELL, "text-right tabular-nums")}>
                      {row.is_mandatory ? "Yes" : "No"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="qc-template-name">Template name</Label>
          <Input
            id="qc-template-name"
            value={value.name}
            disabled={controlsDisabled}
            placeholder="Defaults to category or item name"
            onChange={(event) => onChange({ ...value, name: event.target.value })}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="qc-template-description">Description</Label>
          <textarea
            id="qc-template-description"
            rows={2}
            value={value.description}
            disabled={controlsDisabled}
            placeholder="Optional notes for inspectors"
            onChange={(event) => onChange({ ...value, description: event.target.value })}
            className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium">Inspection tests</p>
          <p className="text-xs text-muted-foreground">
            Mandatory tests must be completed before an inspection can be saved.
          </p>
        </div>

        <div className={QC_TEST_TABLE_FRAME}>
          <table className={listTableElementClass("medium")}>
            <thead>
              <tr className="text-left">
                <th className={cn(LIST_TABLE_HEADER_CELL, "min-w-[9rem]")}>Test</th>
                <th className={cn(LIST_TABLE_HEADER_CELL, "min-w-[8rem]")}>Type</th>
                <th className={LIST_TABLE_HEADER_CELL}>Criteria</th>
                <th className={cn(LIST_TABLE_HEADER_CELL, "w-[5.5rem] text-center")}>
                  Mandatory
                </th>
                <th className={cn(LIST_TABLE_HEADER_CELL, "w-10")} aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {value.parameters.length === 0 ? (
                <tr className={listTableRowClass(false, false)}>
                  <td
                    colSpan={5}
                    className={cn(LIST_TABLE_BODY_CELL, "py-6 text-center text-sm text-muted-foreground")}
                  >
                    No inspection tests yet. Use Add New below to define checks such as visual,
                    weight, or moisture.
                  </td>
                </tr>
              ) : (
                value.parameters.map((row, index) => (
                  <tr key={row.clientKey} className={listTableRowClass(false, false)}>
                    <td className={LIST_TABLE_BODY_CELL}>
                      <Input
                        className="h-8 min-w-[8rem]"
                        value={row.name}
                        disabled={controlsDisabled}
                        placeholder="Visual inspection"
                        aria-label={`Test name ${index + 1}`}
                        onChange={(event) => patchParameter(index, { name: event.target.value })}
                      />
                    </td>
                    <td className={LIST_TABLE_BODY_CELL}>
                      <Select
                        value={row.parameter_type}
                        disabled={controlsDisabled}
                        onValueChange={(next) =>
                          patchParameter(index, {
                            parameter_type: next as QcTestParameterFormRow["parameter_type"],
                          })
                        }
                      >
                        <SelectTrigger className="h-8 min-w-[7.5rem]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {QC_TEST_PARAMETER_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {qcTestParameterTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className={LIST_TABLE_BODY_CELL}>
                      <QcTestCriteriaCell
                        row={row}
                        index={index}
                        controlsDisabled={controlsDisabled}
                        onPatch={(patch) => patchParameter(index, patch)}
                      />
                    </td>
                    <td className={cn(LIST_TABLE_BODY_CELL, "text-center")}>
                      <div className="flex justify-center">
                        <Switch
                          checked={row.is_mandatory}
                          disabled={controlsDisabled}
                          aria-label={`Mandatory for ${row.name || `test ${index + 1}`}`}
                          onCheckedChange={(checked) =>
                            patchParameter(index, { is_mandatory: checked })
                          }
                        />
                      </div>
                    </td>
                    <td className={LIST_TABLE_BODY_CELL}>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={controlsDisabled}
                        onClick={() => removeParameter(index)}
                        aria-label={`Remove ${row.name || `test ${index + 1}`}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="relative z-[1] flex items-center border-b border-dashed border-border/70 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={controlsDisabled}
            className="h-8 gap-2 px-0 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={addParameter}
          >
            <Plus className="h-4 w-4 shrink-0" aria-hidden />
            Add New
          </Button>
        </div>
      </div>
    </div>
  );
}
