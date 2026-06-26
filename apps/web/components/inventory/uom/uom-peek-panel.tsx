"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import { formatUomFactorSummary } from "@/lib/uom/list-column-display-text";
import { uomFamilyLabel, type UomRow } from "@/lib/uom/types";

type Props = {
  row: UomRow;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function UomPeekPanel({ row, canManage = false, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold">{row.code}</span>
            <Badge variant="default">{uomFamilyLabel(row.family)}</Badge>
            {row.is_family_base ? <Badge variant="active">Base</Badge> : null}
            <Badge variant={row.is_active ? "completed" : "locked"}>
              {row.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{row.name}</p>
        </div>
        {canManage ? (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Conversion factor to base
          </p>
          <p className="font-mono text-sm tabular-nums">{formatUomFactorSummary(row)}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Base unit of family
          </p>
          <p className="text-sm">{row.is_family_base ? "Yes" : "No"}</p>
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
