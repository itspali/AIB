"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  canEdit: boolean;
  disabled?: boolean;
  /** Header title row vs compact form row. */
  variant?: "header" | "form";
  onSave: (next: string) => Promise<{ error?: string }>;
};

export function PoVoucherNumberField({
  value,
  canEdit,
  disabled = false,
  variant = "form",
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isHeader = variant === "header";

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [editing, value]);

  const cancelEdit = () => {
    setDraft(value);
    setError(null);
    setEditing(false);
  };

  const saveEdit = async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError("PO number is required.");
      return;
    }
    if (trimmed === value) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    const result = await onSave(trimmed);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className={cn("min-w-0", isHeader ? "space-y-1" : "space-y-1")}>
        <div className="flex min-w-0 items-center gap-1.5">
          <Input
            id="po-voucher-number-edit"
            value={draft}
            disabled={disabled || saving}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveEdit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelEdit();
              }
            }}
            className={cn(
              "min-w-0 flex-1 font-mono",
              isHeader ? "h-8 text-sm font-semibold" : "h-8 text-sm"
            )}
            aria-label="PO number"
            aria-invalid={Boolean(error)}
            autoFocus
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            disabled={disabled || saving}
            aria-label="Save PO number"
            onClick={() => void saveEdit()}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            disabled={disabled || saving}
            aria-label="Cancel editing PO number"
            onClick={cancelEdit}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className={cn(
          "min-w-0 truncate font-mono",
          isHeader ? "text-sm font-semibold leading-5" : "text-sm font-medium"
        )}
      >
        {value}
      </span>
      {canEdit && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
          aria-label="Edit PO number"
          onClick={() => {
            setDraft(value);
            setError(null);
            setEditing(true);
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
