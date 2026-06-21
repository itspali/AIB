"use client";

import { EntityFormSubsection } from "@/components/entities/form/entity-form-subsection";
import { DrawerFormField, DrawerFormGrid } from "@/components/layout/drawer-form-grid";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { entityToggleRowClass } from "@/lib/entities/entity-editor-chrome";
import type { EntityFormValues } from "@/lib/entities/types";

type AddressBlockProps = {
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
}: AddressBlockProps) {
  const line1Key =
    prefix === "Billing" ? "billing_address_line1" : "shipping_address_line1";
  const line2Key =
    prefix === "Billing" ? "billing_address_line2" : "shipping_address_line2";
  const cityKey = prefix === "Billing" ? "billing_city" : "shipping_city";
  const stateKey = prefix === "Billing" ? "billing_state" : "shipping_state";
  const postalKey = prefix === "Billing" ? "billing_zip_postal" : "shipping_zip_postal";
  const countryKey =
    prefix === "Billing" ? "billing_country_code" : "shipping_country_code";

  const addressLabel = prefix === "Billing" ? "Address" : "Shipping address";

  return (
    <DrawerFormGrid maxColumns={2}>
      <DrawerFormField span="full">
        <Label htmlFor={line1Id}>{addressLabel}</Label>
        <Input
          id={line1Id}
          value={form[line1Key]}
          disabled={fieldsDisabled}
          placeholder="Street, area, building"
          onChange={(event) => onLine1Change(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField span="full">
        <Label htmlFor={line2Id}>Address line 2</Label>
        <Input
          id={line2Id}
          value={form[line2Key]}
          disabled={fieldsDisabled}
          placeholder="Optional"
          onChange={(event) => onLine2Change(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={cityId}>City</Label>
        <Input
          id={cityId}
          value={form[cityKey]}
          disabled={fieldsDisabled}
          placeholder="City"
          onChange={(event) => onCityChange(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={stateId}>State</Label>
        <Input
          id={stateId}
          value={form[stateKey]}
          disabled={fieldsDisabled}
          placeholder="State"
          onChange={(event) => onStateChange(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={postalId}>Postal code</Label>
        <Input
          id={postalId}
          value={form[postalKey]}
          disabled={fieldsDisabled}
          placeholder="Pincode / ZIP"
          onChange={(event) => onPostalChange(event.target.value)}
        />
      </DrawerFormField>
      <DrawerFormField>
        <Label htmlFor={countryId}>Country</Label>
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

type Props = {
  form: EntityFormValues;
  fieldsDisabled: boolean;
  onFormChange: (updater: (current: EntityFormValues) => EntityFormValues) => void;
  onFormChangeWithBillingMirror: (
    updater: (current: EntityFormValues) => EntityFormValues
  ) => void;
  onSameAsBillingChange: (checked: boolean) => void;
};

export function EntityAddressFields({
  form,
  fieldsDisabled,
  onFormChange,
  onFormChangeWithBillingMirror,
  onSameAsBillingChange,
}: Props) {
  return (
    <div className="space-y-6">
      <EntityFormSubsection title="Billing address">
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
      </EntityFormSubsection>

      <EntityFormSubsection title="Shipping">
        <div className={entityToggleRowClass()}>
          <Label htmlFor="shipping-same-as-billing">Same as billing address</Label>
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
    </div>
  );
}
