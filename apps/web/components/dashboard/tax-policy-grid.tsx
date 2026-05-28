"use client";

import { useState, useTransition } from "react";
import { Plus, Scale } from "lucide-react";
import { addTaxRateSlab } from "@/app/dashboard/actions";
import { HubPanel, HubSectionHeading } from "@/components/dashboard/hub-panel";
import { TaxPolicyEmptyState } from "@/components/dashboard/tax-policy-empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/dashboard/format";
import { Button } from "@/components/ui/button";
import type { TaxRateSlabRow } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

type TaxPolicyGridProps = {
  rows: TaxRateSlabRow[];
};

const emptyForm = {
  tax_component_name: "",
  tax_percentage: "0.00",
  active_from_date: new Date().toISOString().slice(0, 10),
  active_to_date: "",
  legal_compliance_code: "",
};

export function TaxPolicyGrid({ rows }: TaxPolicyGridProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const openForm = () => {
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await addTaxRateSlab({
        tax_component_name: form.tax_component_name,
        tax_percentage: form.tax_percentage,
        active_from_date: form.active_from_date,
        active_to_date: form.active_to_date || undefined,
        legal_compliance_code: form.legal_compliance_code || undefined,
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      setForm(emptyForm);
      setShowForm(false);
    });
  };

  return (
    <section aria-label="Policy slabs registry">
      <HubSectionHeading
        step="03"
        title="Policy Slabs Registry"
        description="Statutory tax components bound to HSN/SAC compliance tokens."
      />
      <HubPanel accent="violet" icon={Scale}>
        <div className="p-6">
          <div className="mb-4 flex flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {rows.length} registered component{rows.length === 1 ? "" : "s"}
            </p>
            {rows.length > 0 && (
              <Button variant="outline" size="sm" className="border-white/10" onClick={openForm}>
                <Plus className="h-4 w-4" />
                Add New Policy Slab Row
              </Button>
            )}
          </div>

          {rows.length === 0 && !showForm ? (
            <TaxPolicyEmptyState onAdd={openForm} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5 text-left">
                    <th className="p-3 font-medium text-muted-foreground">Component Key Name</th>
                    <th className="p-3 font-medium text-muted-foreground text-right">
                      Percentage Value
                    </th>
                    <th className="p-3 font-medium text-muted-foreground">Active From</th>
                    <th className="p-3 font-medium text-muted-foreground">Active To</th>
                    <th className="p-3 font-medium text-muted-foreground">HSN/SAC Token</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-white/5 transition-colors duration-200 last:border-0 hover:bg-white/[0.03]",
                        i % 2 === 1 && "bg-white/[0.02]"
                      )}
                    >
                      <td className="p-3 font-medium">{row.tax_component_name}</td>
                      <td className="p-3 text-right font-semibold tracking-tight tabular-nums">
                        {row.tax_percentage.toFixed(2)}%
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(row.active_from_date)}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(row.active_to_date)}</td>
                      <td className="p-3">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {row.legal_compliance_code ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {showForm && (
            <div className="mt-4 rounded-xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-4">
              <h3 className="mb-4 text-sm font-medium text-foreground">New policy slab</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tax-name">Component Key Name</Label>
                  <Input
                    id="tax-name"
                    className="border-white/10 bg-background/50"
                    value={form.tax_component_name}
                    onChange={(e) => setForm((f) => ({ ...f, tax_component_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">Percentage Value</Label>
                  <Input
                    id="tax-rate"
                    className="border-white/10 bg-background/50 text-right"
                    value={form.tax_percentage}
                    onChange={(e) => setForm((f) => ({ ...f, tax_percentage: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-from">Active From</Label>
                  <Input
                    id="tax-from"
                    type="date"
                    className="border-white/10 bg-background/50"
                    value={form.active_from_date}
                    onChange={(e) => setForm((f) => ({ ...f, active_from_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-to">Active To</Label>
                  <Input
                    id="tax-to"
                    type="date"
                    className="border-white/10 bg-background/50"
                    value={form.active_to_date}
                    onChange={(e) => setForm((f) => ({ ...f, active_to_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <Label htmlFor="tax-hsn">Legal Compliance HSN/SAC Token</Label>
                  <Input
                    id="tax-hsn"
                    className="border-white/10 bg-background/50"
                    value={form.legal_compliance_code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, legal_compliance_code: e.target.value }))
                    }
                  />
                </div>
              </div>
              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={isPending} onClick={handleSubmit}>
                  Save Policy Slab
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10"
                  disabled={isPending}
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </HubPanel>
    </section>
  );
}
