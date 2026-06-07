"use client";

import { useCallback, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

export function useVariantMatrixSelection(variantIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const allSelected = useMemo(
    () => variantIds.length > 0 && variantIds.every((id) => selectedIds.has(id)),
    [selectedIds, variantIds]
  );

  const someSelected = useMemo(
    () => variantIds.some((id) => selectedIds.has(id)),
    [selectedIds, variantIds]
  );

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedIds(checked ? new Set(variantIds) : new Set());
    },
    [variantIds]
  );

  const toggleOne = useCallback((variantId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(variantId);
      else next.delete(variantId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedList = useMemo(
    () => variantIds.filter((id) => selectedIds.has(id)),
    [selectedIds, variantIds]
  );

  return {
    selectedIds,
    selectedList,
    allSelected,
    someSelected,
    toggleAll,
    toggleOne,
    clearSelection,
  };
}

export function VariantMatrixSelectHeader({
  checked,
  indeterminate,
  disabled,
  onCheckedChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={indeterminate ? "indeterminate" : checked}
      disabled={disabled}
      aria-label="Select all variants"
      onCheckedChange={(value) => onCheckedChange(value === true)}
    />
  );
}

export function VariantMatrixSelectCell({
  checked,
  disabled,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={(value) => onCheckedChange(value === true)}
    />
  );
}
