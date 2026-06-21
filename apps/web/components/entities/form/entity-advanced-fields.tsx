"use client";

import type { ChangeEvent } from "react";
import { EntityCustomFieldsSection } from "@/components/entities/entity-custom-fields-section";
import { EntityFormSubsection } from "@/components/entities/form/entity-form-subsection";
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
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import { entityToggleRowClass } from "@/lib/entities/entity-editor-chrome";
import type { EntityFormValues } from "@/lib/entities/types";
import {
  CURRENCY_OPTIONS,
  currencyLabel,
  type OrganizationCurrency,
} from "@/lib/organization/currency-options";

type Props = {
  form: EntityFormValues;
  customFieldBucket: "customer_custom_fields" | "supplier_custom_fields";
  effectiveFieldDefinitions: EntityCustomFieldDefinition[];
  fieldsDisabled: boolean;
  onFormChange: (updater: (current: EntityFormValues) => EntityFormValues) => void;
  onFormChangeWithBillingMirror: (
    updater: (current: EntityFormValues) => EntityFormValues
  ) => void;
  onSameAsBillingChange: (checked: boolean) => void;
};

function AddressBlock({
  prefix,
  line1Id,
  line2Id,
  cityId,
  stateId,
  postalId,
  countryId,
  form,
  fieldsDisabled,
  onLine1Change,
  onLine2Change,
  onCityChange,
  onStateChange,
  onPostalChange,
  onCountryChange,
}: {
  prefix: "Billing" | "Shipping";
  line1Id: string;
  line2Id: string;
  cityId: string;
  stateId: string;
  postalId: string;
  countryId: string;
  form: EntityFormValues;
  fieldsDisabled: boolean;
  onLine1Change: (value: string) => void;
  onLine2Change: (value: string) => void;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
  onPostalChange: (value: string) => void;
  onCountryChange: (value: string) => void;
}) {
  const line1Key =
    prefix === "Billing" ? "billing_address_line1" : "shipping_address_line1";
  const line2Key =
    prefix === "Billing" ? "billing_address_line2" : "shipping_address_line2";
  const cityKey = prefix === "Billing" ? "billing_city" : "shipping_city";
  const stateKey = prefix === "Billing" ? "billing_state" : "shipping_state";
  const postalKey = prefix === "Billing" ? "billing_zip_postal" : "shipping_zip_postal";
  const countryKey =
    prefix === "Billing" ? "billing_country_code" : "shipping_country_code";

  return (
    <DrawerFormGrid maxColumns={2}>
      <DrawerFormField span="full">
        <Label htmlFor={line1Id}>{prefix} address line 1</Label>
        <Input
          id={line1Id}
          value={form[line1Key]}
          disabled={fieldsDisabled}
          onChange={(event) => onLine1Change(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField span="full">
        <Label htmlFor={line2Id}>{prefix} address line 2</Label>
        <Input
          id={line2Id}
          value={form[line2Key]}
          disabled={fieldsDisabled}
          onChange={(event) => onLine2Change(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={cityId}>{prefix} city</Label>
        <Input
          id={cityId}
          value={form[cityKey]}
          disabled={fieldsDisabled}
          onChange={(event) => onCityChange(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={stateId}>{prefix} state</Label>
        <Input
          id={stateId}
          value={form[stateKey]}
          disabled={fieldsDisabled}
          onChange={(event) => onStateChange(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={postalId}>{prefix} postal code</Label>
        <Input
          id={postalId}
          value={form[postalKey]}
          disabled={fieldsDisabled}
          onChange={(event) => onPostalChange(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={countryId}>{prefix} country code</Label>
        <Input
          id={countryId}
          value={form[countryKey]}
          disabled={fieldsDisabled}
          placeholder="IN"
          onChange={(event) => onCountryChange(event.target.value.toUpperCase())}
        />
      </DrawerFormField>
    </DrawerFormGrid>
  );
}

export function EntityAdvancedFields({
  form,
  customFieldBucket,
  effectiveFieldDefinitions,
  fieldsDisabled,
  onFormChange,
  onFormChangeWithBillingMirror,
  onSameAsBillingChange,
}: Props) {
  return (
    <>
      <EntityFormSubsection title="Addresses">
        <AddressBlock
          prefix="Billing"
          line1Id="billing-line1"
          line2Id="billing-line2"
          cityId="billing-city"
          stateId="billing-state"
          postalId="billing-postal"
          countryId="billing-country"
          form={form}
          fieldsDisabled={fieldsDisabled}
          onLine1Change={(value) =>
            onFormChangeWithBillingMirror((current) => ({
              ...current,
              billing_address_line1: value,
            }))
          }
          onLine2Change={(value) =>
            onFormChangeWithBillingMirror((current) => ({
              ...current,
              billing_address_line2: value,
            }))
          }
          onCityChange={(value) =>
            onFormChangeWithBillingMirror((current) => ({
              ...current,
              billing_city: value,
            }))
          }
          onStateChange={(value) =>
            onFormChangeWithBillingMirror((current) => ({
              ...current,
              billing_state: value,
            }))
          }
          onPostalChange={(value) =>
            onFormChangeWithBillingMirror((current) => ({
              ...current,
              billing_zip_postal: value,
            }))
          }
          onCountryChange={(value) =>
            onFormChangeWithBillingMirror((current) => ({
              ...current,
              billing_country_code: value,
            }))
          }
        />

        <div className={entityToggleRowClass()}>
          <Label htmlFor="shipping-same-as-billing">Shipping same as billing</Label>
          <Switch
            id="shipping-same-as-billing"
            checked={form.same_as_billing}
            disabled={fieldsDisabled}
            onCheckedChange={onSameAsBillingChange}
          />
        </div>

        {!form.same_as_billing ? (
          <AddressBlock
            prefix="Shipping"
            line1Id="shipping-line1"
            line2Id="shipping-line2"
            cityId="shipping-city"
            stateId="shipping-state"
            postalId="shipping-postal"
            countryId="shipping-country"
            form={form}
            fieldsDisabled={fieldsDisabled}
            onLine1Change={(value) =>
              onFormChange((current) => ({
                ...current,
                shipping_address_line1: value,
              }))
            }
            onLine2Change={(value) =>
              onFormChange((current) => ({
                ...current,
                shipping_address_line2: value,
              }))
            }
            onCityChange={(value) =>
              onFormChange((current) => ({
                ...current,
                shipping_city: value,
              }))
            }
            onStateChange={(value) =>
              onFormChange((current) => ({
                ...current,
                shipping_state: value,
              }))
            }
            onPostalChange={(value) =>
              onFormChange((current) => ({
                ...current,
                shipping_zip_postal: value,
              }))
            }
            onCountryChange={(value) =>
              onFormChange((current) => ({
                ...current,
                shipping_country_code: value,
              }))
            }
          />
        ) : null}
      </EntityFormSubsection>

      <EntityFormSubsection title="Company profile">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField>
            <Label htmlFor="entity-legal-name">Legal name</Label>
            <Input
              id="entity-legal-name"
              value={form.legal_name}
              disabled={fieldsDisabled}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, legal_name: event.target.value }))
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
                onFormChange((current) => ({ ...current, code: event.target.value }))
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
                onFormChange((current) => ({ ...current, company_email: event.target.value }))
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
                onFormChange((current) => ({ ...current, company_phone: event.target.value }))
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
                onFormChange((current) => ({ ...current, website_url: event.target.value }))
              }
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>

      <EntityFormSubsection title="Trading currency">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField span="full">
            <Label htmlFor="entity-trading-currency">Trading currency</Label>
            <Select
              value={form.base_currency_override || "__workspace_default__"}
              disabled={fieldsDisabled}
              onValueChange={(value) =>
                onFormChange((current) => ({
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
              Used as the default currency on purchase orders for this supplier. Leave unset to use
              the workspace base currency.
            </p>
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>

      {effectiveFieldDefinitions.length > 0 ? (
        <EntityFormSubsection title="Custom fields">
          <EntityCustomFieldsSection
            definitions={effectiveFieldDefinitions}
            values={form[customFieldBucket]}
            disabled={fieldsDisabled}
            hideIntro
            onChange={(values) =>
              onFormChange((current) => ({ ...current, [customFieldBucket]: values }))
            }
          />
        </EntityFormSubsection>
      ) : null}

      <EntityFormSubsection title="Internal notes">
        <DrawerFormGrid maxColumns={2}>
          <DrawerFormField span="full">
            <Label htmlFor="entity-notes">Internal notes</Label>
            <textarea
              id="entity-notes"
              value={form.internal_notes}
              disabled={fieldsDisabled}
              rows={4}
              className="flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                onFormChange((current) => ({ ...current, internal_notes: event.target.value }))
              }
            />
          </DrawerFormField>
        </DrawerFormGrid>
      </EntityFormSubsection>
    </>
  );
}
