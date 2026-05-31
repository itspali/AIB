"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteUom, seedDefaultUoms } from "@/app/settings/uom/actions";
import { UomDrawerForm } from "@/components/inventory/uom/uom-drawer-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UOM_FAMILIES, uomFamilyLabel, type UomFamily, type UomRow } from "@/lib/uom/types";

type Props = {
  initialRows: UomRow[];
  canManage: boolean;
};

export function UomManagementTerminal({ initialRows, canManage }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<UomRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UomRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isSeeding, startSeed] = useTransition();

  const grouped = useMemo(() => {
    const byFamily = new Map<UomFamily, UomRow[]>();
    for (const row of initialRows) {
      const list = byFamily.get(row.family) ?? [];
      list.push(row);
      byFamily.set(row.family, list);
    }
    return UOM_FAMILIES.map((family) => ({ family, rows: byFamily.get(family) ?? [] })).filter(
      (group) => group.rows.length > 0
    );
  }, [initialRows]);

  const loadDefaults = () => {
    startSeed(async () => {
      const result = await seedDefaultUoms();
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load default units.");
        return;
      }
      toast.success(
        result.created > 0
          ? `Added ${result.created} default unit${result.created === 1 ? "" : "s"}.`
          : "Default units are already present."
      );
      router.refresh();
    });
  };

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: UomRow) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    startDelete(async () => {
      const result = await deleteUom(target.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete unit.");
        return;
      }
      toast.success(
        result.outcome === "DEACTIVATED"
          ? "Unit is in use — deactivated instead of deleted."
          : "Unit deleted."
      );
      setPendingDelete(null);
      router.refresh();
    });
  };

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Units of measure</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define the units items are counted, weighed, and sold in. Each family has one base unit;
            other units convert to it by a factor.
          </p>
        </div>
        {canManage && (
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={loadDefaults} disabled={isSeeding}>
              <Sparkles className="h-4 w-4" />
              Load defaults
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New unit
            </Button>
          </div>
        )}
      </header>

      {!canManage && (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          You have read-only access to units of measure. Editing requires an owner or admin role.
        </div>
      )}

      {initialRows.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-12 text-center dark:border-white/10">
          <p className="max-w-md text-sm font-medium">No units defined yet.</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Load a standard set (Pieces, Kilogram, Litre, Metre…) to get started, then add your own.
          </p>
          {canManage && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={loadDefaults} disabled={isSeeding}>
                <Sparkles className="h-4 w-4" />
                Load default units
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create first unit
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/80 text-xs uppercase tracking-wide text-muted-foreground dark:border-white/10">
                <th className="px-4 py-2.5 text-left font-medium">Code</th>
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-right font-medium">Factor to base</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
                {canManage && <th className="w-24 px-4 py-2.5 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => (
                <FamilyGroup
                  key={group.family}
                  family={group.family}
                  rows={group.rows}
                  canManage={canManage}
                  onEdit={openEdit}
                  onDelete={setPendingDelete}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {canManage && (
        <UomDrawerForm
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          editing={editing}
          onSaved={() => router.refresh()}
        />
      )}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => !next && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? (
                <>
                  &ldquo;{pendingDelete.name}&rdquo; will be removed. If it is currently assigned to
                  any items, it will be deactivated instead so existing records stay intact.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={isDeleting} onClick={confirmDelete}>
              {isDeleting ? "Removing…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type FamilyGroupProps = {
  family: UomFamily;
  rows: UomRow[];
  canManage: boolean;
  onEdit: (row: UomRow) => void;
  onDelete: (row: UomRow) => void;
};

function FamilyGroup({ family, rows, canManage, onEdit, onDelete }: FamilyGroupProps) {
  const colSpan = canManage ? 5 : 4;
  return (
    <>
      <tr className="bg-muted/40">
        <td
          colSpan={colSpan}
          className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {uomFamilyLabel(family)}
        </td>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.id}
          className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30 dark:border-white/5"
        >
          <td className="px-4 py-2.5 font-mono font-semibold">{row.code}</td>
          <td className="px-4 py-2.5">{row.name}</td>
          <td className="px-4 py-2.5 text-right font-mono tabular-nums">
            {row.factor_to_base}
          </td>
          <td className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {row.is_family_base && <Badge variant="active">Base</Badge>}
              <Badge variant={row.is_active ? "completed" : "locked"}>
                {row.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </td>
          {canManage && (
            <td className="px-4 py-2.5">
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Edit unit"
                  onClick={() => onEdit(row)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Delete unit"
                  onClick={() => onDelete(row)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </td>
          )}
        </tr>
      ))}
    </>
  );
}
