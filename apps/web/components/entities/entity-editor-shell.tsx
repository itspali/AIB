"use client";

import { useCallback, useMemo, useState, type RefObject } from "react";
import { toast } from "sonner";
import { Landmark, MapPin, SlidersHorizontal, UserRound } from "lucide-react";
import { EntityBankAccountsSection } from "@/components/entities/entity-bank-accounts-section";
import { EntityAddressFields } from "@/components/entities/form/entity-address-fields";
import { EntityAdvancedDisclosure } from "@/components/entities/form/entity-advanced-disclosure";
import { EntityAdvancedFields } from "@/components/entities/form/entity-advanced-fields";
import { EntityCoreFields } from "@/components/entities/form/entity-core-fields";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import {
  applyGstinLookupToEntityForm,
  lookupGstinDetails,
  normalizeGstin,
  validateGstinFormat,
} from "@/lib/entities/gstin";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import {
  entitySectionCardClass,
  entitySectionStackClass,
  entityTwoPanelColumnClass,
  entityTwoPanelGridClass,
} from "@/lib/entities/entity-editor-chrome";
import { ENTITY_TYPE_LABELS } from "@/lib/entities/labels";
import { ENTITY_COMMERCIAL_TYPES, type EntityWorkspace } from "@/lib/entities/types";
import { useEntityFormTwoPanelLayout } from "@/lib/entities/use-entity-form-layout";
import {
  resolveWorkspaceEffectiveFieldDefinitions,
  workspaceCategoryIdField,
  workspaceCustomFieldBucket,
} from "@/lib/entities/use-entity-form";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";
import type { useEntityForm } from "@/lib/entities/use-entity-form";
import { cn } from "@/lib/utils";

type FormApi = ReturnType<typeof useEntityForm>;

export const ENTITY_SECTION_CORE_ID = "entity-core";
/** @deprecated Use ENTITY_SECTION_CORE_ID */
export const ENTITY_SECTION_ESSENTIALS_ID = ENTITY_SECTION_CORE_ID;
export const ENTITY_SECTION_ADDRESSES_ID = "entity-addresses";
export const ENTITY_SECTION_BANKING_ID = "entity-banking";
export const ENTITY_SECTION_ADVANCED_ID = "entity-advanced";

export type EntityDrawerSectionOptions = {
  workspace: EntityWorkspace;
  isOrganization: boolean;
  showBankAccounts: boolean;
};

const ENTITY_DRAWER_SECTION_DEFS = [
  {
    id: ENTITY_SECTION_CORE_ID,
    label: "Core",
    shortLabel: "Core",
    icon: UserRound,
  },
  {
    id: ENTITY_SECTION_ADDRESSES_ID,
    label: "Addresses",
    shortLabel: "Addr",
    icon: MapPin,
    organizationOnly: true,
  },
  {
    id: ENTITY_SECTION_BANKING_ID,
    label: "Banking",
    shortLabel: "Bank",
    icon: Landmark,
    requiresBankAccounts: true,
  },
  {
    id: ENTITY_SECTION_ADVANCED_ID,
    label: "Advanced",
    shortLabel: "More",
    icon: SlidersHorizontal,
    organizationOnly: true,
  },
] as const;

export function getEntityDrawerSections(options: EntityDrawerSectionOptions) {
  return ENTITY_DRAWER_SECTION_DEFS.filter((section) => {
    if ("requiresBankAccounts" in section && section.requiresBankAccounts) {
      return options.showBankAccounts;
    }
    if ("organizationOnly" in section && section.organizationOnly) {
      return options.isOrganization;
    }
    return true;
  });
}

function entityTypeSupportsBankAccounts(type: string): boolean {
  return type === "SUPPLIER" || type === "MUTUAL_PARTNER";
}

type Props = {
  workspace: EntityWorkspace;
  tenantId: string;
  formApi: FormApi;
  customFieldDefinitions?: EntityCustomFieldDefinition[];
  categoryRows?: EntityCategoryRow[];
  readOnly?: boolean;
  activeSection?: string;
  onActiveSectionChange?: (id: string) => void;
  onAdvancedSectionRequest?: () => void;
  scrollRootRef?: RefObject<HTMLElement | null>;
  chipBarRef?: RefObject<HTMLDivElement | null>;
};

function SectionCard({
  id,
  title,
  help,
  children,
}: {
  id: string;
  title: string;
  help: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn(entitySectionCardClass(), "scroll-mt-24")}>
      <div className="mb-4 flex items-center gap-1.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <FieldLabelInfo label={title}>{fieldHelpText(help)}</FieldLabelInfo>
      </div>
      {children}
    </section>
  );
}

export function EntityEditorShell({
  workspace,
  tenantId,
  formApi,
  customFieldDefinitions = [],
  categoryRows = [],
  readOnly = false,
  activeSection = ENTITY_SECTION_CORE_ID,
  onActiveSectionChange,
  onAdvancedSectionRequest,
  scrollRootRef,
  chipBarRef,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const twoPanel = useEntityFormTwoPanelLayout();
  const {
    form,
    setForm,
    setFormWithBillingMirror,
    setEntityName,
    setPartyNature,
    setCategoryId,
    error,
    isPending,
    showAdvanced,
    setShowAdvanced,
    setSameAsBilling,
    setPrimaryContact,
    setPrimaryContactWhatsappSameAsMobile,
    setBankAccounts,
    setLogoUrl,
    logoPreviewUrl,
  } = formApi;

  const [gstinLookupPending, setGstinLookupPending] = useState(false);
  const fieldsDisabled = isPending || readOnly || gstinLookupPending;
  const isOrganization = form.party_nature === "ORGANIZATION";
  const categoryField = workspaceCategoryIdField(workspace);
  const customFieldBucket = workspaceCustomFieldBucket(workspace);
  const effectiveFieldDefinitions = useMemo(
    () =>
      resolveWorkspaceEffectiveFieldDefinitions(
        workspace,
        form,
        categoryRows,
        customFieldDefinitions
      ),
    [categoryRows, customFieldDefinitions, form, workspace]
  );

  const handleGstinBlur = useCallback(
    async (rawGstin: string) => {
      const normalized = normalizeGstin(rawGstin);
      if (!normalized) return;

      if (normalized !== form.tax_registration_number) {
        setForm((current) => ({ ...current, tax_registration_number: normalized }));
      }

      const validationError = validateGstinFormat(normalized);
      if (validationError) {
        if (normalized.length === 15) {
          toast.error(validationError);
        }
        return;
      }

      setGstinLookupPending(true);
      try {
        const lookup = await lookupGstinDetails(normalized);
        if (!lookup) {
          toast.error("Could not fetch GSTIN details. Try again.");
          return;
        }

        setForm((current) => applyGstinLookupToEntityForm(current, lookup));

        if (lookup.legalName || lookup.tradeName) {
          setShowAdvanced(true);
        }

        if (lookup.status && !lookup.status.toLowerCase().includes("active")) {
          toast.warning(`GSTIN status: ${lookup.status}`);
        } else if (lookup.source === "remote") {
          toast.success("Business details updated from GSTIN");
        } else {
          toast.message("State updated from GSTIN", {
            description: "Legal name and address need a connected GST lookup service.",
          });
        }
      } finally {
        setGstinLookupPending(false);
      }
    },
    [form.tax_registration_number, setForm, setShowAdvanced]
  );

  const showBankAccounts =
    workspace === "supplier" && entityTypeSupportsBankAccounts(form.type);

  const drawerSections = getEntityDrawerSections({
    workspace,
    isOrganization,
    showBankAccounts,
  });

  const typeOptions = useMemo(
    () =>
      ENTITY_COMMERCIAL_TYPES.filter((type) => config.typeFilter.includes(type)).map((type) => ({
        value: type,
        label: ENTITY_TYPE_LABELS[type],
      })),
    [config.typeFilter]
  );

  const coreFieldProps = {
    workspace,
    form,
    categoryField,
    categoryRows,
    typeOptions,
    fieldsDisabled,
    gstinLookupPending,
    onPartyNatureChange: setPartyNature,
    onEntityNameChange: setEntityName,
    onCategoryChange: setCategoryId,
    onFormChange: setForm,
    onPrimaryContactChange: setPrimaryContact,
    onWhatsappSameAsMobileChange: setPrimaryContactWhatsappSameAsMobile,
    onGstinBlur: (raw: string) => void handleGstinBlur(raw),
  };

  const addressFieldProps = {
    form,
    fieldsDisabled,
    onFormChange: setForm,
    onFormChangeWithBillingMirror: setFormWithBillingMirror,
    onSameAsBillingChange: setSameAsBilling,
  };

  const handleSectionSelect = useCallback(
    (sectionId: string) => {
      if (sectionId === ENTITY_SECTION_ADVANCED_ID && isOrganization && !showAdvanced) {
        setShowAdvanced(true);
        onAdvancedSectionRequest?.();
      }
      onActiveSectionChange?.(sectionId);
    },
    [isOrganization, onActiveSectionChange, onAdvancedSectionRequest, setShowAdvanced, showAdvanced]
  );

  const organizationCoreBody =
    twoPanel && isOrganization ? (
      <div className={entityTwoPanelGridClass()}>
        <div className={entityTwoPanelColumnClass()}>
          <EntityCoreFields {...coreFieldProps} />
        </div>
        <div id={ENTITY_SECTION_ADDRESSES_ID} className={cn(entityTwoPanelColumnClass(), "scroll-mt-24")}>
          <EntityAddressFields {...addressFieldProps} />
        </div>
      </div>
    ) : (
      <div className="space-y-6">
        <EntityCoreFields {...coreFieldProps} />
        {isOrganization ? (
          <div id={ENTITY_SECTION_ADDRESSES_ID} className="scroll-mt-24">
            <EntityAddressFields {...addressFieldProps} />
          </div>
        ) : null}
      </div>
    );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {onActiveSectionChange ? (
        <SectionScrollChipBar
          barRef={chipBarRef}
          chips={drawerSections.map((section) => ({
            id: section.id,
            label: section.shortLabel,
            leading: <section.icon className="h-3.5 w-3.5" aria-hidden />,
          }))}
          activeId={activeSection}
          onSelect={handleSectionSelect}
          embedded
          dense
          className="mb-3 lg:hidden"
        />
      ) : null}

      <div
        ref={scrollRootRef as RefObject<HTMLDivElement>}
        className={cn("min-h-0 flex-1 px-1 pb-6", entitySectionStackClass())}
      >
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <SectionCard
          id={ENTITY_SECTION_CORE_ID}
          title="Core"
          help="Identity, contact, tax IDs, billing and shipping addresses, commercial terms, and status."
        >
          {organizationCoreBody}
        </SectionCard>

        {showBankAccounts ? (
          <SectionCard
            id={ENTITY_SECTION_BANKING_ID}
            title="Banking"
            help="Vendor payout accounts with IFSC lookup and UPI IDs. Bank logos update automatically from IFSC."
          >
            <EntityBankAccountsSection
              accounts={form.bank_accounts}
              disabled={fieldsDisabled}
              onChange={setBankAccounts}
            />
          </SectionCard>
        ) : null}

        {isOrganization ? (
          <section id={ENTITY_SECTION_ADVANCED_ID} className="scroll-mt-24">
            <EntityAdvancedDisclosure
              open={showAdvanced}
              onToggle={() => setShowAdvanced((current) => !current)}
              disabled={fieldsDisabled}
            >
              <EntityAdvancedFields
                tenantId={tenantId}
                form={form}
                logoPreviewUrl={logoPreviewUrl}
                customFieldBucket={customFieldBucket}
                effectiveFieldDefinitions={effectiveFieldDefinitions}
                fieldsDisabled={fieldsDisabled}
                onFormChange={setForm}
                onLogoUploaded={setLogoUrl}
              />
            </EntityAdvancedDisclosure>
          </section>
        ) : null}
      </div>
    </div>
  );
}
