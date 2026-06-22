"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlan } from "@/lib/console/actions/plan-management";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SubscriptionPlanInterval } from "@/lib/console/types";

export function ConsolePlanForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceAmount, setPriceAmount] = useState("0");
  const [billingInterval, setBillingInterval] = useState<SubscriptionPlanInterval>("MONTHLY");
  const [trialDays, setTrialDays] = useState("14");
  const [isPublic, setIsPublic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createPlan({
        code,
        name,
        description: description || undefined,
        price_amount: Number(priceAmount) || 0,
        billing_interval: billingInterval,
        trial_days: Number(trialDays) || 0,
        is_public: isPublic,
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      setCode("");
      setName("");
      setDescription("");
      setPriceAmount("0");
      setTrialDays("14");
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="surface-panel space-y-4 p-4"
      aria-label="Create subscription plan"
    >
      <h2 className="text-sm font-semibold">Create plan</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="plan_code">Code</Label>
          <Input
            id="plan_code"
            value={code}
            disabled={isPending}
            placeholder="PRO"
            onChange={(event) => setCode(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan_name">Name</Label>
          <Input
            id="plan_name"
            value={name}
            disabled={isPending}
            placeholder="Professional"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="plan_description">Description</Label>
          <Input
            id="plan_description"
            value={description}
            disabled={isPending}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan_price">Price (cents)</Label>
          <Input
            id="plan_price"
            type="number"
            min={0}
            value={priceAmount}
            disabled={isPending}
            onChange={(event) => setPriceAmount(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan_interval">Billing interval</Label>
          <Select
            value={billingInterval}
            disabled={isPending}
            onValueChange={(value) => setBillingInterval(value as SubscriptionPlanInterval)}
          >
            <SelectTrigger id="plan_interval">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="plan_trial_days">Trial days</Label>
          <Input
            id="plan_trial_days"
            type="number"
            min={0}
            value={trialDays}
            disabled={isPending}
            onChange={(event) => setTrialDays(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch
            id="plan_is_public"
            checked={isPublic}
            disabled={isPending}
            onCheckedChange={setIsPublic}
          />
          <Label htmlFor="plan_is_public">Public (visible on signup)</Label>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending || !code.trim() || !name.trim()}>
        {isPending ? "Creating…" : "Create plan"}
      </Button>
    </form>
  );
}
