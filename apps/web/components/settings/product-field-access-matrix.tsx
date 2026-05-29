"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProductFieldsAccess } from "@/app/settings/organization/actions";
import { Switch } from "@/components/ui/switch";
import {
  buildDefaultProductFieldsAccessMatrix,
  PRODUCT_FIELD_KEYS,
  type TenantProductFieldsAccess,
} from "@/lib/products/field-permissions";
import { PRODUCT_LIST_COLUMNS } from "@/lib/products/list-columns";
import type { UserRole } from "@/lib/user/types";

const ROLES: UserRole[] = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

type Props = {
  initialAccess: TenantProductFieldsAccess | null;
  disabled?: boolean;
};

export function ProductFieldAccessMatrix({ initialAccess, disabled = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const defaults = useMemo(
    () => initialAccess ?? buildDefaultProductFieldsAccessMatrix(),
    [initialAccess]
  );
  const [accessDraft, setAccessDraft] = useState<TenantProductFieldsAccess>(defaults);

  useEffect(() => {
    setAccessDraft(defaults);
  }, [defaults]);

  const columnLabels = useMemo(
    () => new Map(PRODUCT_LIST_COLUMNS.map((column) => [column.id, column.label])),
    []
  );

  const toggleField = (
    role: UserRole,
    field: (typeof PRODUCT_FIELD_KEYS)[number],
    allowed: boolean
  ) => {
    setAccessDraft((current) => ({
      ...current,
      [role]: {
        ...(current[role] ?? {}),
        [field]: allowed,
      },
    }));
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveProductFieldsAccess(accessDraft);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Product field access updated.");
    });
  };

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">Product field access by role</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Control which product list and report fields each role can view. Hidden fields are removed
          from tables, cards, column settings, and search filters.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Field</th>
              {ROLES.map((role) => (
                <th key={role} className="px-2 py-2 font-medium">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRODUCT_FIELD_KEYS.map((field) => (
              <tr key={field} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3 text-sm">{columnLabels.get(field) ?? field}</td>
                {ROLES.map((role) => {
                  const allowed = accessDraft[role]?.[field] ?? defaults[role]?.[field] ?? true;
                  return (
                    <td key={`${role}-${field}`} className="px-2 py-2 text-center">
                      <Switch
                        checked={allowed}
                        disabled={disabled || isPending}
                        aria-label={`${role} can view ${columnLabels.get(field) ?? field}`}
                        onCheckedChange={(checked) => toggleField(role, field, checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!disabled ? (
        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save field access"}
        </button>
      ) : null}
    </section>
  );
}
