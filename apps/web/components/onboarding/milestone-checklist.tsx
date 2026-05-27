"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MilestoneBadge } from "@/components/onboarding/milestone-badge";
import { AdvancedParametersPanel } from "@/components/onboarding/advanced-parameters-panel";
import { OnboardingActionBar } from "@/components/onboarding/onboarding-action-bar";
import { StepLocationForm } from "@/components/onboarding/steps/step-location-form";
import { StepCoa } from "@/components/onboarding/steps/step-coa";
import { StepTaxRegistry } from "@/components/onboarding/steps/step-tax-registry";
import { StepChannels } from "@/components/onboarding/steps/step-channels";
import type { OnboardingSnapshot, OnboardingDraft } from "@/lib/onboarding/types";

type Props = {
  snapshot: OnboardingSnapshot;
};

export function MilestoneChecklist({ snapshot }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const draft = (snapshot.tenant.metadata_json?.onboarding_draft as OnboardingDraft | undefined) ?? {};

  const getDraft = (): OnboardingDraft => draft;

  const stepMap = Object.fromEntries(snapshot.steps.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Milestone Setup Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" defaultValue={["locations", "coa", "tax", "channels"]} className="w-full">
            <AccordionItem value="locations">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <span>Step 1 — Corporate Profile & Location Network</span>
                  <MilestoneBadge status={stepMap.locations.status} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <StepLocationForm
                  completed={stepMap.locations.completed}
                  primaryLocation={snapshot.primaryLocation}
                  defaultValues={draft.location}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="coa">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <span>Step 2 — Unified Chart of Accounts</span>
                  <MilestoneBadge status={stepMap.coa.status} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <StepCoa completed={stepMap.coa.completed} accountCount={snapshot.accountCount} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tax" disabled={stepMap.tax.status === "LOCKED"}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <span>Step 3 — Statutory Tax & Policy Slabs</span>
                  <MilestoneBadge status={stepMap.tax.status} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <StepTaxRegistry
                  completed={stepMap.tax.completed}
                  taxRateCount={snapshot.taxRateCount}
                  initialRows={draft.taxRates}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="channels" disabled={stepMap.channels.status === "LOCKED"}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex flex-1 items-center justify-between pr-4">
                  <span>Step 4 — Omnichannel Channels & Policies</span>
                  <MilestoneBadge status={stepMap.channels.status} />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <StepChannels
                  completed={stepMap.channels.completed}
                  channelCount={snapshot.channelCount}
                  returnPolicies={snapshot.returnPolicies}
                  defaultValues={draft.channel}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <AdvancedParametersPanel enabled={showAdvanced} onEnabledChange={setShowAdvanced} />

      <OnboardingActionBar canLaunch={snapshot.canLaunch} getDraft={getDraft} />
    </div>
  );
}
