"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { saveSellingFocus } from "@/app/settings/organization/actions";
import { BusinessModelSelector } from "@/components/auth/business-model-selector";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Button } from "@/components/ui/button";
import {
  getMissingChannelSuggestions,
  type BusinessModel,
  type ChannelSuggestion,
} from "@/lib/onboarding/business-model";
import { isFinanceSetupComplete } from "@/lib/onboarding/finance-setup-gate";

type Props = {
  businessModel: BusinessModel;
  storefrontChannelTypes: string[];
  brandName: string;
  onboardingStatus: string;
  disabled?: boolean;
};

export function OrganizationSellingFocusSection({
  businessModel: initialModel,
  storefrontChannelTypes,
  brandName,
  onboardingStatus,
  disabled,
}: Props) {
  const [businessModel, setBusinessModel] = useState(initialModel);
  const [savedModel, setSavedModel] = useState(initialModel);
  const [suggestions, setSuggestions] = useState<ChannelSuggestion[]>(() =>
    getMissingChannelSuggestions(initialModel, storefrontChannelTypes, brandName)
  );
  const [isPending, startTransition] = useTransition();

  const financeComplete = isFinanceSetupComplete(onboardingStatus);
  const previewSuggestions = getMissingChannelSuggestions(
    businessModel,
    storefrontChannelTypes,
    brandName
  );
  const displaySuggestions = suggestions.length > 0 ? suggestions : previewSuggestions;

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveSellingFocus(businessModel);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setSavedModel(businessModel);
      setSuggestions(result.suggestions);
      toast.success("Selling focus updated");
    });
  };

  const hasUnsavedChanges = businessModel !== savedModel;

  return (
    <OrgSettingsSection
      title="Selling focus"
      description="Guides recommended sales channels and setup defaults. Does not change existing channels automatically."
    >
      <div className="space-y-4">
        <BusinessModelSelector
          value={businessModel}
          onChange={setBusinessModel}
          disabled={disabled || isPending}
          label="Main selling focus"
          helperText="Used for setup recommendations. You can change this anytime."
        />

        {!financeComplete ? (
          <p className="text-sm text-muted-foreground">
            Finance setup is not complete.{" "}
            <Link href="/onboarding" className="font-medium text-primary underline-offset-4 hover:underline">
              Finish onboarding
            </Link>{" "}
            to apply recommended accounts, tax, and channels.
          </p>
        ) : null}

        {displaySuggestions.length > 0 ? (
          <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-950">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">Suggested channels</p>
              <p className="text-blue-900/80">
                Based on your selling focus, you may want to add:
              </p>
              <ul className="list-disc pl-5 text-blue-900/80">
                {displaySuggestions.map((item) => (
                  <li key={item.channel_type}>
                    <span className="font-medium">{item.name}</span> ({item.label})
                  </li>
                ))}
              </ul>
              <p className="text-xs text-blue-900/70">
                Channels are not created automatically. Add them through your channel setup workflow
                or contact your administrator.
              </p>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={disabled || isPending || !hasUnsavedChanges}
            onClick={handleSave}
          >
            {isPending ? "Saving…" : "Save selling focus"}
          </Button>
        </div>
      </div>
    </OrgSettingsSection>
  );
}
