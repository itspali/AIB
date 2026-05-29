"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveOrganizationSettings } from "@/app/settings/organization/actions";
import { FormSectionNav } from "@/components/settings/form-section-nav";
import { OrganizationAdvancedSection } from "@/components/settings/organization-advanced-section";
import { ProductFieldAccessMatrix } from "@/components/settings/product-field-access-matrix";
import { OrganizationBillingFiscalSection } from "@/components/settings/organization-billing-fiscal-section";
import { OrganizationGovernanceRail } from "@/components/settings/organization-governance-rail";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { OrganizationIdentitySection } from "@/components/settings/organization-identity-section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { OrganizationSettingsAccess } from "@/lib/organization/access";
import { organizationSettingsSchema } from "@/lib/organization/schemas";
import {
  ORG_SETTINGS_SECTION_IDS,
  ORG_SETTINGS_SECTIONS,
} from "@/lib/organization/section-nav";
import {
  snapshotToFormValues,
  type OrganizationSettingsFormValues,
  type OrganizationSettingsSnapshot,
} from "@/lib/organization/types";
import { useFormSectionSpy } from "@/lib/settings/form-section-spy";
import { cn } from "@/lib/utils";

const MODULE_HEADER_BLEED =
  "-mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8";

type Props = {
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  tenantId: string;
  logoPreviewUrl?: string | null;
};

export function OrganizationSettingsTerminal({
  snapshot,
  access,
  tenantId,
  logoPreviewUrl,
}: Props) {
  const router = useRouter();
  const omnibar = useOptionalOmnibarContext();
  const moduleHeaderRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const defaultValues = useMemo(() => snapshotToFormValues(snapshot), [snapshot]);

  const form = useForm<OrganizationSettingsFormValues>({
    resolver: zodResolver(organizationSettingsSchema),
    defaultValues,
  });

  const showAdvanced = form.watch("show_advanced");
  const formValues = form.watch();

  const visibleSections = useMemo(
    () => ORG_SETTINGS_SECTIONS.filter((section) => !section.advanced || showAdvanced),
    [showAdvanced]
  );
  const sectionIds = useMemo(() => visibleSections.map((section) => section.id), [visibleSections]);
  const { activeId, scrollToSection } = useFormSectionSpy(sectionIds, {
    headerRef: moduleHeaderRef,
  });

  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      const section = ORG_SETTINGS_SECTIONS.find((item) => item.id === sectionId);
      if (section?.advanced && !showAdvanced) {
        form.setValue("show_advanced", true);
        window.setTimeout(() => scrollToSection(sectionId), 100);
        return;
      }
      scrollToSection(sectionId);
    },
    [form, scrollToSection, showAdvanced]
  );

  useEffect(() => {
    form.reset(defaultValues);
    setIsEditing(false);
  }, [defaultValues, form]);

  const fieldsDisabled = !isEditing || isPending;

  const handleReset = () => {
    form.reset(defaultValues);
    setIsEditing(false);
  };

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveOrganizationSettings(values);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to save organization settings.");
        return;
      }
      toast.success("Workspace Governance Profiles Synchronized Safely");
      setIsEditing(false);
      await omnibar?.refreshSearchPermissions();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="min-w-0">
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
        Manage corporate identity, fiscal policy, workspace governance, and delegated admin access.
      </p>

      <div
        ref={moduleHeaderRef}
        className={cn(
          "sticky top-0 z-10 mb-4 border-b border-border/60 bg-background/95 pb-3 pt-1 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80",
          MODULE_HEADER_BLEED
        )}
      >
        <header className="mb-3 flex items-center justify-between gap-3 pt-2">
          <h1 className="min-w-0 text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            Organization Settings
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            {!isEditing ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={handleReset}
                >
                  Reset
                </Button>
                <Button type="submit" size="sm" disabled={isPending}>
                  Save
                </Button>
              </>
            )}
          </div>
        </header>

        <FormSectionNav
          sections={visibleSections}
          activeId={activeId}
          onSelect={handleSectionSelect}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-6 pb-8 lg:grid-cols-[minmax(0,13fr)_minmax(0,7fr)]">
        <main className="min-w-0 space-y-4">
          <OrganizationIdentitySection
            form={form}
            sectionId={ORG_SETTINGS_SECTION_IDS.identity}
            disabled={fieldsDisabled}
          />
          <OrganizationBillingFiscalSection
            form={form}
            billingSectionId={ORG_SETTINGS_SECTION_IDS.billing}
            fiscalSectionId={ORG_SETTINGS_SECTION_IDS.fiscal}
            baseCurrencyLocked={snapshot.base_currency_locked}
            disabled={fieldsDisabled}
          />

          <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Show Advanced Parameters</p>
              <p className="text-xs text-muted-foreground">
                Branding, location governance, naming sequences, accounting controls, and delegate
                directory.
              </p>
            </div>
            <Switch
              checked={showAdvanced}
              disabled={fieldsDisabled}
              onCheckedChange={(checked) => form.setValue("show_advanced", checked)}
            />
          </div>

          {showAdvanced && (
            <>
              <OrganizationAdvancedSection
                form={form}
                tenantId={tenantId}
                sectionIds={{
                  brand: ORG_SETTINGS_SECTION_IDS.brand,
                  location: ORG_SETTINGS_SECTION_IDS.location,
                  naming: ORG_SETTINGS_SECTION_IDS.naming,
                  accounting: ORG_SETTINGS_SECTION_IDS.accounting,
                }}
                logoPreviewUrl={logoPreviewUrl}
                locations={snapshot.locations}
                documentSequences={snapshot.document_sequences}
                snapshot={snapshot}
                disabled={fieldsDisabled}
              />
              {access.isOwner ? (
                <ProductFieldAccessMatrix
                  initialAccess={snapshot.product_fields_access}
                  disabled={false}
                />
              ) : null}
            </>
          )}
        </main>

        <OrganizationGovernanceRail
          snapshot={snapshot}
          access={access}
          formValues={formValues}
          showAdvanced={showAdvanced}
        />
      </div>
    </form>
  );
}
