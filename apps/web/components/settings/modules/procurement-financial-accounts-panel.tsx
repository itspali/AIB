"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveFinancialProcurementSettings } from "@/app/settings/modules/procurement/actions";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ExpenseAccountOption,
  FinancialProcurementSettings,
} from "@/lib/procurement/settings";

type Props = {
  initialSettings: FinancialProcurementSettings;
  expenseAccounts: ExpenseAccountOption[];
  assetAccounts: ExpenseAccountOption[];
  liabilityAccounts: ExpenseAccountOption[];
  canEdit: boolean;
  importsEnabled?: boolean;
};

export function ProcurementFinancialAccountsPanel({
  initialSettings,
  expenseAccounts,
  assetAccounts,
  liabilityAccounts,
  canEdit,
  importsEnabled = false,
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [isPending, startTransition] = useTransition();

  const isDirty = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveFinancialProcurementSettings(settings);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Billing GL accounts saved.");
    });
  };

  return (
    <OrgSettingsSection
      title="Billing GL accounts"
      description={
        importsEnabled
          ? "Configure accounts used for purchase price variance, promotional contra, goods-in-transit holding, and vendor prepayments."
          : "Configure accounts used for purchase price variance, promotional contra, and vendor prepayments."
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="ppv-expense-account">PPV expense account</Label>
          <Select
            value={settings.ppv_expense_account_id ?? "none"}
            disabled={!canEdit}
            onValueChange={(value) =>
              setSettings((current) => ({
                ...current,
                ppv_expense_account_id: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger id="ppv-expense-account">
              <SelectValue placeholder="Select expense account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not configured</SelectItem>
              {expenseAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.account_code} — {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used when Apply PPV posts variance beyond inventory restatement limits.
          </p>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="promo-contra-expense-account">Promotional contra expense account</Label>
          <Select
            value={settings.promo_contra_expense_account_id ?? "none"}
            disabled={!canEdit}
            onValueChange={(value) =>
              setSettings((current) => ({
                ...current,
                promo_contra_expense_account_id: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger id="promo-contra-expense-account">
              <SelectValue placeholder="Select expense account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not configured</SelectItem>
              {expenseAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.account_code} — {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used when promotional bundle cost is restated against paid stock on GRN close-out.
          </p>
        </div>

        {importsEnabled ? (
        <div className="grid gap-2">
          <Label htmlFor="git-holding-account">GIT holding account</Label>
          <Select
            value={settings.git_holding_account_id ?? "none"}
            disabled={!canEdit}
            onValueChange={(value) =>
              setSettings((current) => ({
                ...current,
                git_holding_account_id: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger id="git-holding-account">
              <SelectValue placeholder="Select asset account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not configured</SelectItem>
              {assetAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.account_code} — {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Goods-in-transit asset used when posting import stock to a virtual GIT holding node
            (Dr GIT holding / Cr inventory on post; reversed on clearance).
          </p>
        </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="vendor-prepayment-account">Vendor prepayment account</Label>
          <Select
            value={settings.vendor_prepayment_account_id ?? "none"}
            disabled={!canEdit}
            onValueChange={(value) =>
              setSettings((current) => ({
                ...current,
                vendor_prepayment_account_id: value === "none" ? null : value,
              }))
            }
          >
            <SelectTrigger id="vendor-prepayment-account">
              <SelectValue placeholder="Select liability account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not configured</SelectItem>
              {liabilityAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.account_code} — {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Used when vendor advances are applied to supplier bills (Dr AP / Cr prepayment).
          </p>
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <Button type="button" size="sm" disabled={!isDirty || isPending} onClick={handleSave}>
              {isPending ? "Saving…" : "Save GL accounts"}
            </Button>
          </div>
        ) : null}
      </div>
    </OrgSettingsSection>
  );
}
