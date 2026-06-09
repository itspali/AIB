"use client";

import { useCallback, useMemo, useState, type ChangeEvent, type RefObject } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Building2,
  CreditCard,
  Landmark,
  MapPin,
  NotebookPen,
  Phone,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { EntityBankAccountsSection } from "@/components/entities/entity-bank-accounts-section";
import { EntityCustomFieldsSection } from "@/components/entities/entity-custom-fields-section";
import { EntityLogoUploader } from "@/components/entities/entity-logo-uploader";
import { DrawerFormField, DrawerFormGrid } from "@/components/layout/drawer-form-grid";
import { SectionScrollChipBar } from "@/components/layout/section-scroll-chip-bar";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  applyGstinLookupToEntityForm,
  lookupGstinDetails,
  normalizeGstin,
  validateGstinFormat,
} from "@/lib/entities/gstin";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import { ENTITY_TYPE_LABELS, TAX_TREATMENT_LABELS } from "@/lib/entities/labels";
import { ENTITY_COMMERCIAL_TYPES, taxRegistrationRequired } from "@/lib/entities/types";
import type { EntityWorkspace } from "@/lib/entities/types";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import {
  CURRENCY_OPTIONS,
  currencyLabel,
  type OrganizationCurrency,
} from "@/lib/organization/currency-options";
import type { useEntityForm } from "@/lib/entities/use-entity-form";

type FormApi = ReturnType<typeof useEntityForm>;

export const ENTITY_SECTION_ESSENTIALS_ID = "entity-essentials";
export const ENTITY_SECTION_COMMERCIAL_ID = "entity-commercial";
export const ENTITY_SECTION_BANKING_ID = "entity-banking";
export const ENTITY_SECTION_ADDRESSES_ID = "entity-addresses";
export const ENTITY_SECTION_COMPANY_ID = "entity-company";
export const ENTITY_SECTION_CONTACTS_ID = "entity-contacts";
export const ENTITY_SECTION_CUSTOM_FIELDS_ID = "entity-custom-fields";
export const ENTITY_SECTION_NOTES_ID = "entity-notes";

export const ENTITY_DRAWER_SECTIONS = [
  {
    id: ENTITY_SECTION_ESSENTIALS_ID,
    label: "Essentials",
    shortLabel: "Core",
    icon: UserRound,
  },
  {
    id: ENTITY_SECTION_COMMERCIAL_ID,
    label: "Commercial",
    shortLabel: "Terms",
    icon: CreditCard,
  },
  {
    id: ENTITY_SECTION_BANKING_ID,
    label: "Banking",
    shortLabel: "Bank",
    icon: Landmark,
    supplierOnly: true,
  },
  {
    id: ENTITY_SECTION_ADDRESSES_ID,
    label: "Addresses",
    shortLabel: "Addr",
    icon: MapPin,
  },
  {
    id: ENTITY_SECTION_COMPANY_ID,
    label: "Company",
    shortLabel: "Co",
    icon: Building2,
  },
  {
    id: ENTITY_SECTION_CONTACTS_ID,
    label: "Contacts",
    shortLabel: "People",
    icon: Phone,
  },
  {
    id: ENTITY_SECTION_CUSTOM_FIELDS_ID,
    label: "Custom fields",
    shortLabel: "Custom",
    icon: SlidersHorizontal,
    requiresDefinitions: true,
  },
  {
    id: ENTITY_SECTION_NOTES_ID,
    label: "Notes",
    shortLabel: "Notes",
    icon: NotebookPen,
  },
] as const;

export function getEntityDrawerSections(
  workspace: EntityWorkspace,
  customFieldDefinitions: EntityCustomFieldDefinition[] = []
) {
  return ENTITY_DRAWER_SECTIONS.filter((section) => {
    if ("supplierOnly" in section && section.supplierOnly && workspace !== "supplier") {
      return false;
    }
    if ("requiresDefinitions" in section && section.requiresDefinitions) {
      return customFieldDefinitions.length > 0;
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
  readOnly?: boolean;
  activeSection?: string;
  onActiveSectionChange?: (id: string) => void;
  scrollRootRef?: RefObject<HTMLElement | null>;
  chipBarRef?: RefObject<HTMLDivElement | null>;
};

function SectionHeading({ title, help }: { title: string; help: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <FieldLabelInfo label={title}>{fieldHelpText(help)}</FieldLabelInfo>
    </div>
  );
}

function Section({
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
    <section id={id} className="scroll-mt-24 space-y-4">
      <SectionHeading title={title} help={help} />
      {children}
    </section>
  );
}

export function EntityEditorShell({
  workspace,
  tenantId,
  formApi,
  customFieldDefinitions = [],
  readOnly = false,
  activeSection = ENTITY_SECTION_ESSENTIALS_ID,
  onActiveSectionChange,
  scrollRootRef,
  chipBarRef,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const {
    form,
    setForm,
    setFormWithBillingMirror,
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
  const showTaxId = taxRegistrationRequired(form.tax_treatment);

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

        if (
          lookup.legalName ||
          lookup.billingAddressLine1 ||
          lookup.tradeName ||
          lookup.billingCity
        ) {
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
  const drawerSections = getEntityDrawerSections(workspace, customFieldDefinitions);
  const typeOptions = useMemo(
    () =>
      ENTITY_COMMERCIAL_TYPES.filter((type) => config.typeFilter.includes(type)).map((type) => ({
        value: type,
        label: ENTITY_TYPE_LABELS[type],
      })),
    [config.typeFilter]
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
          onSelect={onActiveSectionChange}
          embedded
          dense
          className="mb-3 lg:hidden"
        />
      ) : null}

      <div ref={scrollRootRef as RefObject<HTMLDivElement>} className="min-h-0 flex-1 space-y-8 px-1 pb-6">
        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Section
          id={ENTITY_SECTION_ESSENTIALS_ID}
          title="Essentials"
          help="Core identity, tax treatment, profile photo, and primary contact details."
        >
          <EntityLogoUploader
            tenantId={tenantId}
            entityId={form.entity_id}
            draftStorageKey={form.draft_storage_key}
            value={form.logo_url}
            previewUrl={logoPreviewUrl}
            disabled={fieldsDisabled}
            onUploaded={(storagePath) => setLogoUrl(storagePath)}
          />

          <DrawerFormGrid>
            <DrawerFormField span="full">
              <Label htmlFor="entity-name">Name</Label>
              <Input
                id="entity-name"
                value={form.name}
                disabled={fieldsDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </DrawerFormField>

            <DrawerFormField>
              <Label htmlFor="entity-type">Type</Label>
              <Select
                value={form.type}
                disabled={fieldsDisabled}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    type: value as typeof form.type,
                  }))
                }
              >
                <SelectTrigger id="entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DrawerFormField>

            <DrawerFormField>
              <Label htmlFor="entity-tax-treatment">Tax treatment</Label>
              <Select
                value={form.tax_treatment}
                disabled={fieldsDisabled}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    tax_treatment: value as typeof form.tax_treatment,
                  }))
                }
              >
                <SelectTrigger id="entity-tax-treatment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TAX_TREATMENT_LABELS).map(([value, entry]) => (
                    <SelectItem key={value} value={value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DrawerFormField>

            {showTaxId ? (
              <DrawerFormField span="full">
                <Label htmlFor="entity-tax-id">Tax registration number (GSTIN)</Label>
                <div className="relative">
                  <Input
                    id="entity-tax-id"
                    value={form.tax_registration_number}
                    disabled={fieldsDisabled}
                    placeholder="15-character GSTIN"
                    autoComplete="off"
                    spellCheck={false}
                    className={gstinLookupPending ? "pr-10" : undefined}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        tax_registration_number: event.target.value.toUpperCase(),
                      }))
                    }
                    onBlur={(event) => void handleGstinBlur(event.target.value)}
                  />
                  {gstinLookupPending ? (
                    <Loader2
                      className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Tab out after entering a valid GSTIN to auto-fill legal name and billing address.
                </p>
              </DrawerFormField>
            ) : null}
          </DrawerFormGrid>

          <Separator />

          <div className="space-y-3">
            <p className="text-sm font-medium">Primary contact</p>
            <DrawerFormGrid>
              <DrawerFormField>
                <Label htmlFor="primary-first-name">First name</Label>
                <Input
                  id="primary-first-name"
                  value={form.primary_contact.first_name}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setPrimaryContact((contact) => ({
                      ...contact,
                      first_name: event.target.value,
                    }))
                  }
                />
              </DrawerFormField>
              <DrawerFormField>
                <Label htmlFor="primary-last-name">Last name</Label>
                <Input
                  id="primary-last-name"
                  value={form.primary_contact.last_name}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setPrimaryContact((contact) => ({
                      ...contact,
                      last_name: event.target.value,
                    }))
                  }
                />
              </DrawerFormField>
              <DrawerFormField>
                <Label htmlFor="primary-email">Email</Label>
                <Input
                  id="primary-email"
                  type="email"
                  value={form.primary_contact.email}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setPrimaryContact((contact) => ({
                      ...contact,
                      email: event.target.value,
                    }))
                  }
                />
              </DrawerFormField>
              <DrawerFormField>
                <Label htmlFor="primary-mobile">Mobile</Label>
                <Input
                  id="primary-mobile"
                  value={form.primary_contact.mobile}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    setPrimaryContact((contact) => ({
                      ...contact,
                      mobile: event.target.value,
                      whatsapp_number: contact.use_mobile_for_whatsapp
                        ? event.target.value
                        : contact.whatsapp_number,
                    }))
                  }
                />
              </DrawerFormField>
            </DrawerFormGrid>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/80 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Show advanced fields</p>
              <p className="text-xs text-muted-foreground">
                Legal name, addresses, extended contacts, and company profile.
              </p>
            </div>
            <Switch
              checked={showAdvanced}
              disabled={fieldsDisabled}
              onCheckedChange={setShowAdvanced}
              aria-label="Show advanced fields"
            />
          </div>
        </Section>

        <Section
          id={ENTITY_SECTION_COMMERCIAL_ID}
          title="Commercial"
          help="Credit limit, trading currency, and payment terms for this partner."
        >
          <DrawerFormGrid>
            <DrawerFormField>
              <Label htmlFor="entity-credit-limit">Credit limit</Label>
              <Input
                id="entity-credit-limit"
                value={form.credit_limit}
                disabled={fieldsDisabled}
                onChange={(event) =>
                  setForm((current) => ({ ...current, credit_limit: event.target.value }))
                }
              />
            </DrawerFormField>
            <DrawerFormField>
              <Label htmlFor="entity-payment-terms">Payment terms (days)</Label>
              <Input
                id="entity-payment-terms"
                value={form.payment_terms_days}
                disabled={fieldsDisabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    payment_terms_days: event.target.value,
                  }))
                }
              />
            </DrawerFormField>
            <DrawerFormField span="full">
              <Label htmlFor="entity-trading-currency">Trading currency</Label>
              <Select
                value={form.base_currency_override || "__workspace_default__"}
                disabled={fieldsDisabled}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    base_currency_override:
                      value === "__workspace_default__" ? "" : (value as OrganizationCurrency),
                  }))
                }
              >
                <SelectTrigger id="entity-trading-currency" className="w-full">
                  <SelectValue placeholder="Workspace default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__workspace_default__">Workspace default</SelectItem>
                  {CURRENCY_OPTIONS.map((code) => (
                    <SelectItem key={code} value={code}>
                      {currencyLabel(code)} ({code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Used as the default currency on purchase orders for this supplier. Leave unset to
                use the workspace base currency.
              </p>
            </DrawerFormField>
          </DrawerFormGrid>
        </Section>

        {showBankAccounts ? (
          <Section
            id={ENTITY_SECTION_BANKING_ID}
            title="Bank accounts"
            help="Vendor payout accounts with IFSC lookup and UPI IDs. Bank logos update automatically from IFSC."
          >
            <EntityBankAccountsSection
              accounts={form.bank_accounts}
              disabled={fieldsDisabled}
              onChange={setBankAccounts}
            />
          </Section>
        ) : null}

        {showAdvanced ? (
          <>
            <Section
              id={ENTITY_SECTION_ADDRESSES_ID}
              title="Addresses"
              help="Billing and shipping address blocks."
            >
              <DrawerFormGrid>
                <DrawerFormField span="full">
                  <Label htmlFor="billing-line1">Billing address line 1</Label>
                  <Input
                    id="billing-line1"
                    value={form.billing_address_line1}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setFormWithBillingMirror((current) => ({
                        ...current,
                        billing_address_line1: event.target.value,
                      }))
                    }
                  />
                </DrawerFormField>
                <DrawerFormField span="full">
                  <Label htmlFor="billing-city">Billing city</Label>
                  <Input
                    id="billing-city"
                    value={form.billing_city}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setFormWithBillingMirror((current) => ({
                        ...current,
                        billing_city: event.target.value,
                      }))
                    }
                  />
                </DrawerFormField>
              </DrawerFormGrid>

              <div className="flex items-center gap-2">
                <Switch
                  checked={form.same_as_billing}
                  disabled={fieldsDisabled}
                  onCheckedChange={setSameAsBilling}
                  aria-label="Shipping same as billing"
                />
                <Label>Shipping same as billing</Label>
              </div>

              {!form.same_as_billing ? (
                <DrawerFormGrid>
                  <DrawerFormField span="full">
                    <Label htmlFor="shipping-line1">Shipping address line 1</Label>
                    <Input
                      id="shipping-line1"
                      value={form.shipping_address_line1}
                      disabled={fieldsDisabled}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          shipping_address_line1: event.target.value,
                        }))
                      }
                    />
                  </DrawerFormField>
                </DrawerFormGrid>
              ) : null}
            </Section>

            <Section
              id={ENTITY_SECTION_COMPANY_ID}
              title="Company"
              help="Legal identity and company contact channels."
            >
              <DrawerFormGrid>
                <DrawerFormField>
                  <Label htmlFor="entity-legal-name">Legal name</Label>
                  <Input
                    id="entity-legal-name"
                    value={form.legal_name}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, legal_name: event.target.value }))
                    }
                  />
                </DrawerFormField>
                <DrawerFormField>
                  <Label htmlFor="entity-code">Code</Label>
                  <Input
                    id="entity-code"
                    value={form.code}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, code: event.target.value }))
                    }
                  />
                </DrawerFormField>
                <DrawerFormField>
                  <Label htmlFor="entity-company-email">Company email</Label>
                  <Input
                    id="entity-company-email"
                    type="email"
                    value={form.company_email}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, company_email: event.target.value }))
                    }
                  />
                </DrawerFormField>
                <DrawerFormField>
                  <Label htmlFor="entity-company-phone">Company phone</Label>
                  <Input
                    id="entity-company-phone"
                    value={form.company_phone}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, company_phone: event.target.value }))
                    }
                  />
                </DrawerFormField>
                <DrawerFormField span="full">
                  <Label htmlFor="entity-website">Website</Label>
                  <Input
                    id="entity-website"
                    value={form.website_url}
                    disabled={fieldsDisabled}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, website_url: event.target.value }))
                    }
                  />
                </DrawerFormField>
              </DrawerFormGrid>
            </Section>

            <Section
              id={ENTITY_SECTION_CONTACTS_ID}
              title="Contacts"
              help="Extended contacts directory beyond the primary contact."
            >
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.primary_contact.use_mobile_for_whatsapp}
                  disabled={fieldsDisabled}
                  onCheckedChange={setPrimaryContactWhatsappSameAsMobile}
                  aria-label="Same number for WhatsApp"
                />
                <Label>Same number for WhatsApp</Label>
              </div>
              {!form.primary_contact.use_mobile_for_whatsapp ? (
                <DrawerFormGrid>
                  <DrawerFormField>
                    <Label htmlFor="primary-whatsapp">WhatsApp number</Label>
                    <Input
                      id="primary-whatsapp"
                      value={form.primary_contact.whatsapp_number}
                      disabled={fieldsDisabled}
                      onChange={(event) =>
                        setPrimaryContact((contact) => ({
                          ...contact,
                          whatsapp_number: event.target.value,
                        }))
                      }
                    />
                  </DrawerFormField>
                </DrawerFormGrid>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Extended contacts repeater will be expanded in a follow-up pass.
              </p>
            </Section>
          </>
        ) : null}

        {customFieldDefinitions.length > 0 ? (
          <Section
            id={ENTITY_SECTION_CUSTOM_FIELDS_ID}
            title="Custom fields"
            help="Organization-defined profile fields for this workspace."
          >
            <EntityCustomFieldsSection
              definitions={customFieldDefinitions}
              values={form.custom_fields}
              disabled={fieldsDisabled}
              onChange={(values) => setForm((current) => ({ ...current, custom_fields: values }))}
            />
          </Section>
        ) : null}

        <Section
          id={ENTITY_SECTION_NOTES_ID}
          title="Notes"
          help="Internal notes visible only inside your workspace."
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/80 px-3 py-2">
              <Label htmlFor="entity-active">Active</Label>
              <Switch
                id="entity-active"
                checked={form.is_active}
                disabled={fieldsDisabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, is_active: checked }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="entity-notes">Internal notes</Label>
              <textarea
                id="entity-notes"
                value={form.internal_notes}
                disabled={fieldsDisabled}
                rows={4}
                className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setForm((current) => ({ ...current, internal_notes: event.target.value }))
                }
              />
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
