"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTaxCode, loadDefaultTaxCodes } from "@/app/settings/tax/actions";
import { TaxCodeDrawerForm } from "@/components/settings/tax-code-drawer-form";
import { TaxRulePreview } from "@/components/settings/tax-rule-preview";
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
import { taxCodeKindLabel, type TaxCodeRow } from "@/lib/tax/types";

type Props = {
  initialRows: TaxCodeRow[];
  canEdit: boolean;
};

export function TaxSettingsTerminal({ initialRows, canEdit }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<TaxCodeRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<TaxCodeRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [isLoadingDefaults, startLoadDefaults] = useTransition();

  const loadDefaults = () => {
    startLoadDefaults(async () => {
      const result = await loadDefaultTaxCodes();
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load default tax rules.");
        return;
      }
      toast.success(
        result.created > 0
          ? `Added ${result.created} default tax rule${result.created === 1 ? "" : "s"} for ${result.countryCode}.`
          : "Default tax rules are already present."
      );
      router.refresh();
    });
  };

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: TaxCodeRow) => {
    setEditing(row);
    setDrawerOpen(true);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    startDelete(async () => {
      const result = await deleteTaxCode(target.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete tax rule.");
        return;
      }
      toast.success(
        result.outcome === "DEACTIVATED"
          ? "Tax rule is in use — deactivated instead of deleted."
          : "Tax rule deleted."
      );
      setPendingDelete(null);
      router.refresh();
    });
  };

  return (
    <>
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Tax settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define reusable tax rules (flat or value-based slabs). Items reference a rule instead of
            a typed percentage.
          </p>
        </div>
        {canEdit && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              onClick={loadDefaults}
              disabled={isLoadingDefaults}
            >
              <Sparkles className="h-4 w-4" />
              Load defaults
            </Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              New tax rule
            </Button>
          </div>
        )}
      </header>

      {!canEdit && (
        <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          You have read-only access to tax settings. Editing requires the owner or a delegated
          permission.
        </div>
      )}

      {initialRows.length === 0 ? (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
          <p className="max-w-md text-sm font-medium">No tax rules defined yet.</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create flat rates (e.g. GST 18%) or value-based slabs (e.g. apparel 5% / 12%) once, then
            assign them to items.
          </p>
          {canEdit && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={loadDefaults} disabled={isLoadingDefaults}>
                <Sparkles className="h-4 w-4" />
                Load defaults for my country
              </Button>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create first tax rule
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {initialRows.map((row) => (
            <Card key={row.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{row.code}</span>
                    <Badge variant="default">{taxCodeKindLabel(row.kind)}</Badge>
                    {row.is_variable && <Badge variant="active">Variable</Badge>}
                    <Badge variant={row.is_active ? "completed" : "locked"}>
                      {row.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{row.name}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Edit tax rule"
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Delete tax rule"
                      onClick={() => setPendingDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3">
                <TaxRulePreview
                  isVariable={row.is_variable}
                  rate={row.rate}
                  rules={row.rules}
                />
              </div>

              {row.components.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {row.components.map((c) => `${c.name} ${c.rate}%`).join(" + ")}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {canEdit && (
        <TaxCodeDrawerForm
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
            <AlertDialogTitle>Delete tax rule?</AlertDialogTitle>
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
