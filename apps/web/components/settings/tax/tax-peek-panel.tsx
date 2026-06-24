"use client";

import { Pencil, Trash2 } from "lucide-react";
import { TaxRulePreview } from "@/components/settings/tax-rule-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import { formatTaxComponentsSummary } from "@/lib/tax/list-column-display-text";
import { taxCodeKindLabel, type TaxCodeRow } from "@/lib/tax/types";

type Props = {
  row: TaxCodeRow;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function TaxPeekPanel({ row, canEdit = false, onEdit, onDelete }: Props) {
  const componentsSummary = formatTaxComponentsSummary(row);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{row.code}</span>
            <Badge variant="default">{taxCodeKindLabel(row.kind)}</Badge>
            {row.is_variable ? <Badge variant="active">Variable</Badge> : null}
            <Badge variant={row.is_active ? "completed" : "locked"}>
              {row.is_active ? "Active" : "Inactive"}
            </Badge>
            {!row.is_recoverable ? <Badge variant="locked">Non-recoverable</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{row.name}</p>
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-1">
            {onEdit ? (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {onDelete ? (
              <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <TaxRulePreview isVariable={row.is_variable} rate={row.rate} rules={row.rules} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Components
          </p>
          <p className="text-sm">{componentsSummary}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Prices include tax
          </p>
          <p className="text-sm">{row.is_inclusive_default ? "Yes" : "No"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Effective from
          </p>
          <p className="text-sm">
            {row.effective_from ? formatDate(row.effective_from) : "—"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Effective to
          </p>
          <p className="text-sm">{row.effective_to ? formatDate(row.effective_to) : "—"}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Updated
          </p>
          <p className="text-sm">{formatDate(row.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
