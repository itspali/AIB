"use client";

import { useCallback, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawerFormField, DrawerFormGrid } from "@/components/layout/drawer-form-grid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  extractBankCodeFromIfsc,
  lookupIfscDetails,
  resolveBankLogoUrl,
} from "@/lib/entities/bank-ifsc";
import type { EntityFormBankAccountValues } from "@/lib/entities/types";
import { cn } from "@/lib/utils";

type Props = {
  accounts: EntityFormBankAccountValues[];
  disabled?: boolean;
  onChange: (accounts: EntityFormBankAccountValues[]) => void;
};

export function defaultEntityBankAccountValues(
  overrides?: Partial<EntityFormBankAccountValues>
): EntityFormBankAccountValues {
  return {
    account_id: null,
    account_holder_name: "",
    account_number: "",
    ifsc_code: "",
    bank_code: "",
    bank_name: "",
    branch_name: "",
    upi_id: "",
    is_primary: false,
    is_active: true,
    ...overrides,
  };
}

function BankLogoPreview({ bankCode }: { bankCode: string }) {
  const [failed, setFailed] = useState(false);
  const logoUrl = resolveBankLogoUrl(bankCode);

  if (!logoUrl || failed) {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted ring-1 ring-border/80">
        <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt=""
      className="h-10 w-10 shrink-0 rounded-md bg-white object-contain p-1 ring-1 ring-border/80"
      onError={() => setFailed(true)}
    />
  );
}

export function EntityBankAccountsSection({ accounts, disabled = false, onChange }: Props) {
  const updateAccount = useCallback(
    (index: number, patch: Partial<EntityFormBankAccountValues>) => {
      onChange(
        accounts.map((account, accountIndex) =>
          accountIndex === index ? { ...account, ...patch } : account
        )
      );
    },
    [accounts, onChange]
  );

  const handleIfscBlur = useCallback(
    async (index: number, rawIfsc: string) => {
      const normalized = rawIfsc.trim().toUpperCase();
      if (!normalized) {
        updateAccount(index, { ifsc_code: "", bank_code: "", bank_name: "", branch_name: "" });
        return;
      }

      const bankCode = extractBankCodeFromIfsc(normalized);
      if (!bankCode) return;

      updateAccount(index, { ifsc_code: normalized, bank_code: bankCode });

      const details = await lookupIfscDetails(normalized);
      if (!details) return;

      updateAccount(index, {
        ifsc_code: details.ifsc,
        bank_code: details.bankCode,
        bank_name: details.bank,
        branch_name: details.branch,
      });
    },
    [updateAccount]
  );

  const addAccount = () => {
    onChange([
      ...accounts,
      defaultEntityBankAccountValues({ is_primary: accounts.length === 0 }),
    ]);
  };

  const removeAccount = (index: number) => {
    onChange(accounts.filter((_, accountIndex) => accountIndex !== index));
  };

  const setPrimary = (index: number) => {
    onChange(
      accounts.map((account, accountIndex) => ({
        ...account,
        is_primary: accountIndex === index,
      }))
    );
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add bank accounts for vendor payments. Enter IFSC to auto-fill bank name, branch, and bank
        logo (via Razorpay IFSC lookup).
      </p>

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No bank accounts yet.
        </div>
      ) : null}

      {accounts.map((account, index) => (
        <div
          key={account.account_id ?? `new-${index}`}
          className={cn("surface-inset space-y-4 rounded-lg p-4", account.is_primary && "ring-1 ring-primary/20")}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <BankLogoPreview bankCode={account.bank_code || extractBankCodeFromIfsc(account.ifsc_code) || ""} />
              <div>
                <p className="text-sm font-medium">
                  Bank account {index + 1}
                  {account.is_primary ? (
                    <span className="ml-2 text-xs font-normal text-primary">Primary</span>
                  ) : null}
                </p>
                {account.bank_name ? (
                  <p className="text-xs text-muted-foreground">{account.bank_name}</p>
                ) : null}
              </div>
            </div>
            {!disabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                onClick={() => removeAccount(index)}
                aria-label="Remove bank account"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            ) : null}
          </div>

          <DrawerFormGrid>
            <DrawerFormField span="full">
              <Label>Account holder name</Label>
              <Input
                value={account.account_holder_name}
                disabled={disabled}
                onChange={(event) =>
                  updateAccount(index, { account_holder_name: event.target.value })
                }
              />
            </DrawerFormField>
            <DrawerFormField>
              <Label>Account number</Label>
              <Input
                value={account.account_number}
                disabled={disabled}
                onChange={(event) => updateAccount(index, { account_number: event.target.value })}
              />
            </DrawerFormField>
            <DrawerFormField>
              <Label>IFSC</Label>
              <Input
                value={account.ifsc_code}
                disabled={disabled}
                className="font-mono uppercase"
                onChange={(event) =>
                  updateAccount(index, { ifsc_code: event.target.value.toUpperCase() })
                }
                onBlur={(event) => void handleIfscBlur(index, event.target.value)}
              />
            </DrawerFormField>
            <DrawerFormField span="full">
              <Label>Branch</Label>
              <Input
                value={account.branch_name}
                disabled={disabled}
                onChange={(event) => updateAccount(index, { branch_name: event.target.value })}
              />
            </DrawerFormField>
            <DrawerFormField span="full">
              <Label>UPI ID</Label>
              <Input
                value={account.upi_id}
                disabled={disabled}
                placeholder="name@bank"
                onChange={(event) => updateAccount(index, { upi_id: event.target.value })}
              />
            </DrawerFormField>
          </DrawerFormGrid>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={account.is_primary}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  if (checked) setPrimary(index);
                }}
              />
              <span className="text-sm">Primary account</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={account.is_active}
                disabled={disabled}
                onCheckedChange={(checked) => updateAccount(index, { is_active: checked })}
              />
              <span className="text-sm">Active</span>
            </div>
          </div>
        </div>
      ))}

      {!disabled ? (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addAccount}>
          <Plus className="h-4 w-4" aria-hidden />
          Add bank account
        </Button>
      ) : null}
    </div>
  );
}
