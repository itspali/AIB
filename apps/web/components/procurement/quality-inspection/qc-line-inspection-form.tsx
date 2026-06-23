"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeQcLineInspection } from "@/app/(workspace)/procurement/quality-inspection/actions";
import { Badge } from "@/components/ui/badge";
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
import {
  GRN_REJECT_DISPOSITIONS,
  grnRejectDispositionLabel,
  type GrnRejectDisposition,
} from "@/lib/procurement/goods-receipts/grn-reject-dispositions";
import {
  formatGrnDisplayQuantity,
  parseGrnQcReleaseQuantities,
  syncGrnQcPassQuantity,
  syncGrnQcRejectQuantity,
} from "@/lib/procurement/goods-receipts/grn-qc-release";
import {
  evaluateQcParameterResult,
  qcInspectionBlockedByMandatoryFailures,
  qcInspectionHasUnfilledMandatory,
} from "@/lib/procurement/quality-inspection/evaluate-parameter";
import type {
  QcInspectionQueueRow,
  QcTestTemplate,
} from "@/lib/procurement/quality-inspection/types";
import { cn } from "@/lib/utils";

type Props = {
  row: QcInspectionQueueRow;
  template: QcTestTemplate | null;
  onCompleted: () => void | Promise<void>;
};

type LineDraft = {
  pass: string;
  reject: string;
  disposition: GrnRejectDisposition;
  notes: string;
};

function defaultLineDraft(onHold: number): LineDraft {
  return {
    pass: String(onHold),
    reject: "0",
    disposition: "SCRAP",
    notes: "",
  };
}

export function QcLineInspectionForm({ row, template, onCompleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const onHold = Number(row.quantity_on_hold);
  const [draft, setDraft] = useState<LineDraft>(() => defaultLineDraft(onHold));
  const [measuredByParameterId, setMeasuredByParameterId] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(defaultLineDraft(Number(row.quantity_on_hold)));
    setMeasuredByParameterId({});
  }, [row.id, row.quantity_on_hold]);

  const parameterResults = useMemo(() => {
    if (!template) return [];
    return template.parameters.map((parameter) => ({
      parameter,
      measured: measuredByParameterId[parameter.id] ?? "",
      result: evaluateQcParameterResult(parameter, measuredByParameterId[parameter.id] ?? ""),
    }));
  }, [measuredByParameterId, template]);

  const hasMandatoryBlock = template
    ? qcInspectionBlockedByMandatoryFailures(template.parameters, measuredByParameterId)
    : false;
  const hasUnfilledMandatory = template
    ? qcInspectionHasUnfilledMandatory(template.parameters, measuredByParameterId)
    : false;

  const parsedQuantities = parseGrnQcReleaseQuantities(onHold, draft.pass, draft.reject);
  const rejectQty = draft.reject.trim() === "" ? 0 : Number(draft.reject);
  const showRejectDisposition = Number.isFinite(rejectQty) && rejectQty > 0;

  const handleSubmit = () => {
    if (parsedQuantities.error) {
      toast.error(parsedQuantities.error);
      return;
    }
    if (hasUnfilledMandatory) {
      toast.error("Complete all mandatory QC tests before saving.");
      return;
    }

    startTransition(async () => {
      const result = await completeQcLineInspection({
        goods_receipt_item_id: row.id,
        quantity_released: String(parsedQuantities.pass),
        quantity_failed: String(parsedQuantities.reject),
        failed_disposition: parsedQuantities.reject > 0 ? draft.disposition : undefined,
        notes: draft.notes.trim() || null,
        result_lines: (template?.parameters ?? []).map((parameter, index) => {
          const measured = measuredByParameterId[parameter.id] ?? "";
          return {
            parameter_id: parameter.id,
            parameter_name: parameter.name,
            parameter_type: parameter.parameter_type,
            min_value: parameter.min_value,
            max_value: parameter.max_value,
            expected_text: parameter.expected_text,
            choice_options: parameter.choice_options,
            measured_value: measured,
            result: evaluateQcParameterResult(parameter, measured),
            is_mandatory: parameter.is_mandatory,
            sort_order: parameter.sort_order ?? index,
          };
        }),
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Inspection saved and stock updated.");
      await onCompleted();
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{row.item_name}</h3>
          <p className="font-mono text-xs text-muted-foreground">{row.variant_sku}</p>
        </div>
        <Badge variant="action_required" className="shrink-0 text-xs font-normal">
          {formatGrnDisplayQuantity(onHold)} on hold
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">GRN</p>
          <p className="font-mono text-sm">{row.grn_number}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Purchase order</p>
          <p className="font-mono text-sm">{row.purchase_order_number ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Location</p>
          <p className="text-sm">{row.destination_location_name}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Received</p>
          <p className="text-sm">{new Date(row.received_at).toLocaleString()}</p>
        </div>
      </div>

      {template ? (
        <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <h4 className="text-sm font-semibold">QC tests — {template.name}</h4>
            {template.description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{template.description}</p>
            ) : null}
          </div>
          <div className="space-y-3">
            {parameterResults.map(({ parameter, measured, result }) => (
              <div key={parameter.id} className="grid gap-2 rounded-md border border-border/70 bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <Label className="text-sm font-medium">
                    {parameter.name}
                    {parameter.is_mandatory ? (
                      <span className="ml-1 text-destructive">*</span>
                    ) : null}
                  </Label>
                  <Badge
                    variant={
                      result === "PASS" ? "completed" : result === "FAIL" ? "administrative" : "locked"
                    }
                    className="text-[10px] font-normal"
                  >
                    {result}
                  </Badge>
                </div>
                {parameter.parameter_type === "BOOLEAN" ? (
                  <Select
                    value={measured || "unset"}
                    disabled={isPending}
                    onValueChange={(value) =>
                      setMeasuredByParameterId((current) => ({
                        ...current,
                        [parameter.id]: value === "unset" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">—</SelectItem>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                    </SelectContent>
                  </Select>
                ) : parameter.parameter_type === "CHOICE" ? (
                  <Select
                    value={measured || "unset"}
                    disabled={isPending}
                    onValueChange={(value) =>
                      setMeasuredByParameterId((current) => ({
                        ...current,
                        [parameter.id]: value === "unset" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select value" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unset">—</SelectItem>
                      {parameter.choice_options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-8"
                    value={measured}
                    disabled={isPending}
                    placeholder={
                      parameter.parameter_type === "NUMERIC"
                        ? parameter.min_value || parameter.max_value
                          ? `Range ${parameter.min_value ?? "—"} to ${parameter.max_value ?? "—"}`
                          : "Enter measured value"
                        : parameter.expected_text
                          ? `Expected: ${parameter.expected_text}`
                          : "Enter observation"
                    }
                    onChange={(event) =>
                      setMeasuredByParameterId((current) => ({
                        ...current,
                        [parameter.id]: event.target.value,
                      }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {hasMandatoryBlock ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              One or more mandatory tests failed. Adjust results or record rejects below.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-4 text-xs text-muted-foreground">
          No QC test template is assigned to this item or its category. Define one under the
          item&apos;s Inventory section or on the product category.
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <h4 className="text-sm font-semibold">Inspection outcome</h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc-pass-qty">Pass to stock</Label>
            <Input
              id="qc-pass-qty"
              className="h-8 tabular-nums"
              inputMode="decimal"
              value={draft.pass}
              disabled={isPending}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ...syncGrnQcPassQuantity(onHold, event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-reject-qty">Reject</Label>
            <Input
              id="qc-reject-qty"
              className="h-8 tabular-nums"
              inputMode="decimal"
              value={draft.reject}
              disabled={isPending}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ...syncGrnQcRejectQuantity(onHold, event.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reject as</Label>
            <Select
              value={draft.disposition}
              disabled={!showRejectDisposition || isPending}
              onValueChange={(value) =>
                setDraft((current) => ({ ...current, disposition: value as GrnRejectDisposition }))
              }
            >
              <SelectTrigger className={cn("h-8 text-xs", !showRejectDisposition && "opacity-60")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRN_REJECT_DISPOSITIONS.map((disposition) => (
                  <SelectItem key={disposition} value={disposition}>
                    {grnRejectDispositionLabel(disposition)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="qc-notes">Notes</Label>
          <textarea
            id="qc-notes"
            rows={2}
            value={draft.notes}
            disabled={isPending}
            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
            className="flex min-h-[4rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button type="button" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving…" : "Save inspection"}
        </Button>
      </section>
    </div>
  );
}
