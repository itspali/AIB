"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarClock, Percent } from "lucide-react";
import {
  updateAccountingPeriodClosingDate,
  updateAllowLineItemDiscounts,
} from "@/app/dashboard/actions";
import { HubPanel, HubSectionHeading } from "@/components/dashboard/hub-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toDateInputValue } from "@/lib/dashboard/format";
import type { WorkspaceControls } from "@/lib/dashboard/types";

type ControlPanelProps = {
  initial: WorkspaceControls;
};

export function ControlPanel({ initial }: ControlPanelProps) {
  const [allowDiscounts, setAllowDiscounts] = useState(initial.allowLineItemDiscounts);
  const [closingDate, setClosingDate] = useState(toDateInputValue(initial.accountingPeriodClosingDate));
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setAllowDiscounts(initial.allowLineItemDiscounts);
    setClosingDate(toDateInputValue(initial.accountingPeriodClosingDate));
  }, [initial]);

  const handleDiscountChange = (checked: boolean) => {
    setAllowDiscounts(checked);
    startTransition(async () => {
      const result = await updateAllowLineItemDiscounts(checked);
      if ("error" in result && result.error) {
        setAllowDiscounts(!checked);
      }
    });
  };

  const handleDateBlur = () => {
    startTransition(async () => {
      await updateAccountingPeriodClosingDate(closingDate || null);
    });
  };

  return (
    <section aria-label="Configuration control panel" className="mb-10">
      <HubSectionHeading
        step="02"
        title="Workspace Controls"
        description="Tune sales discount policy and fiscal period lockout gates."
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HubPanel accent="cyan" icon={Percent}>
          <div className="p-6 pr-16">
            <h3 className="text-xl font-semibold">Operational Feature Switches</h3>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-background/40 p-4">
              <Label htmlFor="allow-discounts" className="text-sm font-medium text-muted-foreground">
                Allow Line-Item Markdown Discounts
              </Label>
              <Switch
                id="allow-discounts"
                checked={allowDiscounts}
                disabled={isPending}
                onCheckedChange={handleDiscountChange}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Writes to <code className="text-primary/80">SALES_SETTINGS</code> registry metadata.
            </p>
          </div>
        </HubPanel>

        <HubPanel accent="amber" icon={CalendarClock}>
          <div className="p-6 pr-16">
            <h3 className="text-xl font-semibold">Fiscal Calendar Lockout Gate</h3>
            <div className="mt-5 space-y-2">
              <Label htmlFor="fiscal-closing" className="text-sm font-medium text-muted-foreground">
                Fiscal Closing Boundary Lockout
              </Label>
              <Input
                id="fiscal-closing"
                type="date"
                value={closingDate}
                disabled={isPending}
                className="border-white/10 bg-background/50"
                onChange={(e) => setClosingDate(e.target.value)}
                onBlur={handleDateBlur}
              />
              <p className="text-xs text-muted-foreground">
                Entries on or before this date are blocked by period lockout triggers.
              </p>
            </div>
          </div>
        </HubPanel>
      </div>
    </section>
  );
}
