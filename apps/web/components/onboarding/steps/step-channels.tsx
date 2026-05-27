"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveChannel } from "@/app/onboarding/actions";
import type { ChannelFormValues, StepSubmitHandle } from "@/lib/onboarding/types";

type Props = {
  completed: boolean;
  channelCount: number;
  returnPolicies: { id: string; policy_name: string }[];
  defaultValues?: Partial<ChannelFormValues>;
  showAdvanced: boolean;
};

export const StepChannels = forwardRef<StepSubmitHandle, Props>(function StepChannels(
  { completed, channelCount, returnPolicies, defaultValues, showAdvanced },
  ref
) {
  const [values, setValues] = useState<ChannelFormValues>({
    name: defaultValues?.name || "",
    slug: defaultValues?.slug || "",
    channel_type: defaultValues?.channel_type || "B2C_ECOMMERCE",
    domain_url: defaultValues?.domain_url || "",
    return_policy_id: defaultValues?.return_policy_id || "",
    new_policy_name: "",
    return_window_days: "30",
  });

  useImperativeHandle(ref, () => ({
    submit: async () => saveChannel(values),
  }));

  if (completed) {
    return (
      <p className="text-sm text-muted-foreground">
        {channelCount} storefront channel{channelCount === 1 ? "" : "s"} connected with return policy bindings.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Channel Name</Label>
          <Input
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            placeholder="Main Storefront"
          />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <Input
            value={values.slug}
            onChange={(e) => setValues((v) => ({ ...v, slug: e.target.value }))}
            placeholder="main-store"
          />
        </div>
        <div className="space-y-2">
          <Label>Channel Type</Label>
          <Select
            value={values.channel_type}
            onValueChange={(v) => setValues((prev) => ({ ...prev, channel_type: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="B2C_ECOMMERCE">B2C E-Commerce Storefront</SelectItem>
              <SelectItem value="B2B_PORTAL">B2B Portal</SelectItem>
              <SelectItem value="MARKETPLACE_FEED">Marketplace Feed</SelectItem>
              <SelectItem value="PHYSICAL_POS">Physical POS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {showAdvanced && (
          <div className="space-y-2">
            <Label>Domain URL</Label>
            <Input
              value={values.domain_url}
              onChange={(e) => setValues((v) => ({ ...v, domain_url: e.target.value }))}
              placeholder="https://shop.example.com"
            />
          </div>
        )}
        <div className="space-y-2 md:col-span-2">
          <Label>Return Policy</Label>
          {returnPolicies.length > 0 ? (
            <Select
              value={values.return_policy_id}
              onValueChange={(v) => setValues((prev) => ({ ...prev, return_policy_id: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select return policy" />
              </SelectTrigger>
              <SelectContent>
                {returnPolicies.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.policy_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                placeholder="New policy name"
                value={values.new_policy_name}
                onChange={(e) => setValues((v) => ({ ...v, new_policy_name: e.target.value }))}
              />
              <Input
                placeholder="Return window (days)"
                value={values.return_window_days}
                onChange={(e) => setValues((v) => ({ ...v, return_window_days: e.target.value }))}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});
