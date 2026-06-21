"use client";

import { Loader2 } from "lucide-react";
import { EntityCategoryCombobox } from "@/components/entities/entity-category-combobox";
import { EntityFormSubsection } from "@/components/entities/form/entity-form-subsection";
import { EntityLogoUploader } from "@/components/entities/entity-logo-uploader";
import { DrawerFormField, DrawerFormGrid } from "@/components/layout/drawer-form-grid";
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
import { PARTY_NATURE_LABELS, TAX_TREATMENT_LABELS } from "@/lib/entities/labels";
import { entityToggleRowClass } from "@/lib/entities/entity-editor-chrome";
import { PARTY_NATURE_TYPES, taxRegistrationRequired } from "@/lib/entities/types";
import type { EntityFormValues, EntityWorkspace } from "@/lib/entities/types";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";

type Props = {
  workspace: EntityWorkspace;
  tenantId: string;
  form: EntityFormValues;
  categoryField: "customer_category_id" | "supplier_category_id";
  categoryRows: EntityCategoryRow[];
  typeOptions: { value: string; label: string }[];
  logoPreviewUrl: string | null;
  fieldsDisabled: boolean;
  gstinLookupPending: boolean;
  onPartyNatureChange: (value: EntityFormValues["party_nature"]) => void;
  onEntityNameChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onFormChange: (updater: (current: EntityFormValues) => EntityFormValues) => void;
  onPrimaryContactChange: (
    updater: (contact: EntityFormValues["primary_contact"]) => EntityFormValues["primary_contact"]
  ) => void;
  onWhatsappSameAsMobileChange: (checked: boolean) => void;
  onLogoUploaded: (storagePath: string) => void;
  onGstinBlur: (rawGstin: string) => void;
};

export function EntityCoreFields({
  workspace,
  tenantId,
  form,
  categoryField,
  categoryRows,
  typeOptions,
  logoPreviewUrl,
  fieldsDisabled,
  gstinLookupPending,
  onPartyNatureChange,
  onEntityNameChange,
  onCategoryChange,
  onFormChange,
  onPrimaryContactChange,
  onWhatsappSameAsMobileChange,
  onLogoUploaded,
  onGstinBlur,
}: Props) {
  const isOrganization = form.party_nature === "ORGANIZATION";
  const showTaxId = taxRegistrationRequired(form.tax_treatment);

  return (
    <div className="space-y-6">
      <EntityFormSubsection title="Identity">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField>
            <Label htmlFor="entity-party-nature">Party nature</Label>
            <Select
              value={form.party_nature}
              disabled={fieldsDisabled}
              onValueChange={(value) =>
                onPartyNatureChange(value as EntityFormValues["party_nature"])
              }
            >
              <SelectTrigger id="entity-party-nature">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARTY_NATURE_TYPES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PARTY_NATURE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DrawerFormField>

          <DrawerFormField>
            <Label htmlFor="entity-type">Type</Label>
            <Select
              value={form.type}
              disabled={fieldsDisabled}
              onValueChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  type: value as EntityFormValues["type"],
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

          <DrawerFormField span="full">
            <Label htmlFor="entity-name">
              {isOrganization ? "Business name" : "Full name"}
            </Label>
            <Input
              id="entity-name"
              value={form.name}
              disabled={fieldsDisabled}
              onChange={(event) => onEntityNameChange(event.target.value)}
            />
          </DrawerFormField>

          <DrawerFormField>
            <EntityCategoryCombobox
              workspace={workspace}
              categoryRows={categoryRows}
              value={form[categoryField]}
              disabled={fieldsDisabled}
              onChange={onCategoryChange}
            />
          </DrawerFormField>

          <DrawerFormField>
            <Label htmlFor="entity-tax-treatment">Tax treatment</Label>
            <Select
              value={form.tax_treatment}
              disabled={fieldsDisabled}
              onValueChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  tax_treatment: value as EntityFormValues["tax_treatment"],
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
                    onFormChange((current) => ({
                      ...current,
                      tax_registration_number: event.target.value.toUpperCase(),
                    }))
                  }
                  onBlur={(event) => onGstinBlur(event.target.value)}
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
      </EntityFormSubsection>

      <EntityFormSubsection title={isOrganization ? "Primary contact" : "Contact details"}>
        <DrawerFormGrid maxColumns={2}>
          {isOrganization ? (
            <>
              <DrawerFormField>
                <Label htmlFor="primary-first-name">First name</Label>
                <Input
                  id="primary-first-name"
                  value={form.primary_contact.first_name}
                  disabled={fieldsDisabled}
                  onChange={(event) =>
                    onPrimaryContactChange((contact) => ({
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
                    onPrimaryContactChange((contact) => ({
                      ...contact,
                      last_name: event.target.value,
                    }))
                  }
                />
              </DrawerFormField>
            </>
          ) : null}

          <DrawerFormField>
            <Label htmlFor="primary-email">Email</Label>
            <Input
              id="primary-email"
              type="email"
              value={form.primary_contact.email}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onPrimaryContactChange((contact) => ({
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
                onPrimaryContactChange((contact) => ({
                  ...contact,
                  mobile: event.target.value,
                  whatsapp_number: contact.use_mobile_for_whatsapp
                    ? event.target.value
                    : contact.whatsapp_number,
                }))
              }
            />
          </DrawerFormField>

          <DrawerFormField span="full">
            <div className={entityToggleRowClass()}>
              <Label htmlFor="primary-whatsapp-same">Same number for WhatsApp</Label>
              <Switch
                id="primary-whatsapp-same"
                checked={form.primary_contact.use_mobile_for_whatsapp}
                disabled={fieldsDisabled}
                onCheckedChange={onWhatsappSameAsMobileChange}
              />
            </div>
          </DrawerFormField>

          {!form.primary_contact.use_mobile_for_whatsapp ? (
            <DrawerFormField span="full">
              <Label htmlFor="primary-whatsapp">WhatsApp number</Label>
              <Input
                id="primary-whatsapp"
                value={form.primary_contact.whatsapp_number}
                disabled={fieldsDisabled}
                onChange={(event) =>
                  onPrimaryContactChange((contact) => ({
                    ...contact,
                    whatsapp_number: event.target.value,
                  }))
                }
              />
            </DrawerFormField>
          ) : null}
        </DrawerFormGrid>
      </EntityFormSubsection>

      <EntityFormSubsection title="Commercial terms">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField>
            <Label htmlFor="entity-credit-limit">Credit limit</Label>
            <Input
              id="entity-credit-limit"
              value={form.credit_limit}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, credit_limit: event.target.value }))
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
                onFormChange((current) => ({
                  ...current,
                  payment_terms_days: event.target.value,
                }))
              }
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>

      <EntityFormSubsection title="Status">
        <div className={entityToggleRowClass()}>
          <Label htmlFor="entity-active">Active</Label>
          <Switch
            id="entity-active"
            checked={form.is_active}
            disabled={fieldsDisabled}
            onCheckedChange={(checked) =>
              onFormChange((current) => ({ ...current, is_active: checked }))
            }
          />
        </div>
      </EntityFormSubsection>

      <EntityFormSubsection title="Branding">
        <EntityLogoUploader
          tenantId={tenantId}
          entityId={form.entity_id}
          draftStorageKey={form.draft_storage_key}
          value={form.logo_url}
          previewUrl={logoPreviewUrl}
          disabled={fieldsDisabled}
          onUploaded={onLogoUploaded}
        />
      </EntityFormSubsection>
    </div>
  );
}
