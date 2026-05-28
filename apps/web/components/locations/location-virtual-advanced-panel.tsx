"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VIRTUAL_FULFILLMENT_MODES,
  virtualFulfillmentModeLabel,
  webhookVerificationLabel,
  type RevenueAccountOption,
  type VirtualLocationConfiguration,
} from "@/lib/locations/virtual-config";
import { cn } from "@/lib/utils";

type Props = {
  value: VirtualLocationConfiguration;
  revenueAccounts: RevenueAccountOption[];
  onChange: (next: VirtualLocationConfiguration) => void;
};

export function LocationVirtualAdvancedPanel({ value, revenueAccounts, onChange }: Props) {
  const updateField = <K extends keyof VirtualLocationConfiguration>(
    key: K,
    fieldValue: VirtualLocationConfiguration[K]
  ) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="surface-panel space-y-4 p-4">
        <div>
          <h4 className="text-sm font-semibold">Omni-Channel Distributed Order Management</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Route digital demand to fulfillment nodes using per-location DOM policy.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Fulfillment assignment mode</Label>
          <Select
            value={value.fulfillment_assignment_mode}
            onValueChange={(mode) =>
              updateField(
                "fulfillment_assignment_mode",
                mode as VirtualLocationConfiguration["fulfillment_assignment_mode"]
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIRTUAL_FULFILLMENT_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {virtualFulfillmentModeLabel(mode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="digital-safety-stock-buffer">Digital safety stock threshold buffer</Label>
          <Input
            id="digital-safety-stock-buffer"
            type="number"
            min={0}
            className="text-right font-mono"
            value={value.digital_safety_stock_buffer}
            onChange={(event) =>
              updateField(
                "digital_safety_stock_buffer",
                Math.max(0, Number(event.target.value) || 0)
              )
            }
          />
        </div>
      </section>

      <section className="surface-panel space-y-4 p-4">
        <div>
          <h4 className="text-sm font-semibold">API Integration and Financial Clearing Hooks</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect downstream channel webhooks and revenue settlement accounts.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="channel-webhook-url">Channel webhook integration sync URL</Label>
            <Badge
              variant={
                value.webhook_verification_status === "VERIFIED"
                  ? "completed"
                  : value.webhook_verification_status === "PENDING"
                    ? "action_required"
                    : "locked"
              }
            >
              {webhookVerificationLabel(value.webhook_verification_status)}
            </Badge>
          </div>
          <Input
            id="channel-webhook-url"
            value={value.channel_webhook_sync_url}
            onChange={(event) => {
              const nextUrl = event.target.value;
              onChange({
                ...value,
                channel_webhook_sync_url: nextUrl,
                webhook_verification_status:
                  nextUrl.trim() === value.channel_webhook_sync_url.trim()
                    ? value.webhook_verification_status
                    : "UNVERIFIED",
              });
            }}
            placeholder="https://api.example.com/webhooks/orders"
            className="font-mono text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label>Default commercial revenue clearing settlement account</Label>
          <Select
            value={value.default_revenue_clearing_account_id ?? "none"}
            onValueChange={(accountId) =>
              updateField(
                "default_revenue_clearing_account_id",
                accountId === "none" ? null : accountId
              )
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select revenue account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No default account</SelectItem>
              {revenueAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.account_code} · {account.account_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {revenueAccounts.length === 0 && (
            <p className={cn("text-xs text-muted-foreground")}>
              No active REVENUE accounts found. Seed chart of accounts during onboarding.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
