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
import { cn } from "@/lib/utils";

type Props = {
  value: QcTestTemplateFormState;
  onChange: (value: QcTestTemplateFormState) => void;
  readOnly?: boolean;
  disabled?: boolean;
};

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
        <p className="text-sm text-muted-foreground">No QC test template defined at this scope.</p>
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
        <div className="space-y-2">
          {value.parameters.map((row) => (
            <div key={row.clientKey} className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <p className="text-sm font-medium">
                {row.name}
                {row.is_mandatory ? <span className="text-destructive"> *</span> : null}
              </p>
              <p className="text-xs text-muted-foreground">{qcTestParameterTypeLabel(row.parameter_type)}</p>
            </div>
          ))}
        </div>
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
            placeholder="Incoming inspection"
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

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Test parameters</p>
            <p className="text-xs text-muted-foreground">
              Inspectors must complete mandatory tests before saving an inspection.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" disabled={controlsDisabled} onClick={addParameter}>
            <Plus className="mr-1 h-4 w-4" />
            Add test
          </Button>
        </div>

        {value.parameters.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
            No tests yet. Add parameters such as visual check, weight, or moisture.
          </p>
        ) : (
          <div className="space-y-3">
            {value.parameters.map((row, index) => (
              <div
                key={row.clientKey}
                className="space-y-3 rounded-lg border border-border bg-muted/15 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Test {index + 1}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive"
                    disabled={controlsDisabled}
                    onClick={() => removeParameter(index)}
                    aria-label={`Remove test ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input
                      value={row.name}
                      disabled={controlsDisabled}
                      placeholder="Visual inspection"
                      onChange={(event) => patchParameter(index, { name: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={row.parameter_type}
                      disabled={controlsDisabled}
                      onValueChange={(next) =>
                        patchParameter(index, {
                          parameter_type: next as QcTestParameterFormRow["parameter_type"],
                        })
                      }
                    >
                      <SelectTrigger>
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
                  </div>
                </div>

                {row.parameter_type === "NUMERIC" ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Minimum</Label>
                      <Input
                        value={row.min_value}
                        disabled={controlsDisabled}
                        inputMode="decimal"
                        onChange={(event) => patchParameter(index, { min_value: event.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Maximum</Label>
                      <Input
                        value={row.max_value}
                        disabled={controlsDisabled}
                        inputMode="decimal"
                        onChange={(event) => patchParameter(index, { max_value: event.target.value })}
                      />
                    </div>
                  </div>
                ) : null}

                {row.parameter_type === "TEXT" ? (
                  <div className="space-y-1.5">
                    <Label>Expected text</Label>
                    <Input
                      value={row.expected_text}
                      disabled={controlsDisabled}
                      onChange={(event) => patchParameter(index, { expected_text: event.target.value })}
                    />
                  </div>
                ) : null}

                {row.parameter_type === "CHOICE" ? (
                  <div className="space-y-1.5">
                    <Label>Allowed choices</Label>
                    <Input
                      value={row.choice_options_text}
                      disabled={controlsDisabled}
                      placeholder="Grade A, Grade B, Reject"
                      onChange={(event) =>
                        patchParameter(index, { choice_options_text: event.target.value })
                      }
                    />
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-2 rounded-md border border-border/70 bg-background px-3 py-2">
                  <Label htmlFor={`qc-param-mandatory-${row.clientKey}`} className="text-sm">
                    Mandatory
                  </Label>
                  <Switch
                    id={`qc-param-mandatory-${row.clientKey}`}
                    checked={row.is_mandatory}
                    disabled={controlsDisabled}
                    onCheckedChange={(checked) => patchParameter(index, { is_mandatory: checked })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
