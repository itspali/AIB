"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { entityMasterSchema } from "@/lib/entities/schemas";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type {
  EntityDetailSnapshot,
  EntityFormContactValues,
  EntityFormValues,
  EntityWorkspace,
} from "@/lib/entities/types";
import { taxRegistrationRequired } from "@/lib/entities/types";

export const defaultEntityFormContactValues: EntityFormContactValues = {
  contact_id: null,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  mobile: "",
  whatsapp_number: "",
  department: "",
  job_title: "",
  use_mobile_for_whatsapp: true,
  is_primary: false,
  is_active: true,
};

export function createDefaultEntityFormValues(workspace: EntityWorkspace): EntityFormValues {
  const config = getEntityWorkspaceConfig(workspace);
  return {
    entity_id: null,
    name: "",
    type: config.defaultType,
    tax_treatment: "REGULAR_B2B",
    tax_registration_number: "",
    legal_name: "",
    code: "",
    credit_limit: "0",
    payment_terms_days: "0",
    base_currency_override: "",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_zip_postal: "",
    billing_country_code: "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_zip_postal: "",
    shipping_country_code: "",
    same_as_billing: true,
    incoterms_code: "",
    default_shipping_method: "",
    company_email: "",
    company_phone: "",
    website_url: "",
    internal_notes: "",
    custom_fields: {},
    is_active: true,
    primary_contact: {
      ...defaultEntityFormContactValues,
      is_primary: true,
    },
    extended_contacts: [],
  };
}

function contactFromRow(
  contact: EntityDetailSnapshot["contacts"][number] | null,
  isPrimary: boolean
): EntityFormContactValues {
  if (!contact) {
    return {
      ...defaultEntityFormContactValues,
      is_primary: isPrimary,
    };
  }

  const mobile = contact.mobile?.trim() ?? "";
  const whatsapp = contact.whatsapp_number?.trim() ?? "";
  const useMobileForWhatsapp = !whatsapp || whatsapp === mobile;

  return {
    contact_id: contact.id,
    first_name: contact.first_name,
    last_name: contact.last_name ?? "",
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    mobile,
    whatsapp_number: whatsapp,
    department: contact.department ?? "",
    job_title: contact.job_title ?? "",
    use_mobile_for_whatsapp: useMobileForWhatsapp,
    is_primary: contact.is_primary,
    is_active: contact.is_active,
  };
}

function addressesMatch(entity: EntityDetailSnapshot): boolean {
  const pairs: Array<[string | null, string | null]> = [
    [entity.billing_address_line1, entity.shipping_address_line1],
    [entity.billing_address_line2, entity.shipping_address_line2],
    [entity.billing_city, entity.shipping_city],
    [entity.billing_state, entity.shipping_state],
    [entity.billing_zip_postal, entity.shipping_zip_postal],
    [entity.billing_country_code, entity.shipping_country_code],
  ];

  return pairs.every(([billing, shipping]) => (billing ?? "") === (shipping ?? ""));
}

export function formFromEntityDetail(
  entity: EntityDetailSnapshot,
  workspace: EntityWorkspace
): EntityFormValues {
  const defaults = createDefaultEntityFormValues(workspace);
  const primaryContact = entity.contacts.find((contact) => contact.is_primary) ?? entity.primary_contact;

  return {
    ...defaults,
    entity_id: entity.id,
    name: entity.name,
    type: entity.type,
    tax_treatment: entity.tax_treatment,
    tax_registration_number: entity.tax_registration_number ?? "",
    legal_name: entity.legal_name ?? "",
    code: entity.code ?? "",
    credit_limit: entity.credit_limit,
    payment_terms_days: String(entity.payment_terms_days),
    base_currency_override: entity.base_currency_override ?? "",
    billing_address_line1: entity.billing_address_line1 ?? "",
    billing_address_line2: entity.billing_address_line2 ?? "",
    billing_city: entity.billing_city ?? "",
    billing_state: entity.billing_state ?? "",
    billing_zip_postal: entity.billing_zip_postal ?? "",
    billing_country_code: entity.billing_country_code ?? "",
    shipping_address_line1: entity.shipping_address_line1 ?? "",
    shipping_address_line2: entity.shipping_address_line2 ?? "",
    shipping_city: entity.shipping_city ?? "",
    shipping_state: entity.shipping_state ?? "",
    shipping_zip_postal: entity.shipping_zip_postal ?? "",
    shipping_country_code: entity.shipping_country_code ?? "",
    same_as_billing: addressesMatch(entity),
    incoterms_code: entity.incoterms_code ?? "",
    default_shipping_method: entity.default_shipping_method ?? "",
    company_email: entity.company_email ?? "",
    company_phone: entity.company_phone ?? "",
    website_url: entity.website_url ?? "",
    internal_notes: entity.internal_notes ?? "",
    custom_fields: Object.fromEntries(
      Object.entries(entity.custom_fields ?? {}).map(([key, value]) => [key, String(value ?? "")])
    ),
    is_active: entity.is_active,
    primary_contact: contactFromRow(primaryContact, true),
    extended_contacts: entity.contacts
      .filter((contact) => !contact.is_primary)
      .map((contact) => contactFromRow(contact, false)),
  };
}

export function mirrorBillingToShipping(
  form: EntityFormValues
): Pick<
  EntityFormValues,
  | "shipping_address_line1"
  | "shipping_address_line2"
  | "shipping_city"
  | "shipping_state"
  | "shipping_zip_postal"
  | "shipping_country_code"
> {
  return {
    shipping_address_line1: form.billing_address_line1,
    shipping_address_line2: form.billing_address_line2,
    shipping_city: form.billing_city,
    shipping_state: form.billing_state,
    shipping_zip_postal: form.billing_zip_postal,
    shipping_country_code: form.billing_country_code,
  };
}

export function resolveContactWhatsappNumber(contact: EntityFormContactValues): string {
  if (contact.use_mobile_for_whatsapp) {
    return contact.mobile.trim();
  }
  return contact.whatsapp_number.trim();
}

function normalizeContactForSave(contact: EntityFormContactValues): EntityFormContactValues {
  const whatsapp = resolveContactWhatsappNumber(contact);
  return {
    ...contact,
    whatsapp_number: whatsapp,
  };
}

export function buildEntitySavePayload(form: EntityFormValues): {
  entity: Record<string, unknown>;
  primary_contact: Record<string, unknown> | null;
  extended_contacts: Record<string, unknown>[];
} {
  const shipping = form.same_as_billing ? mirrorBillingToShipping(form) : form;
  const primaryContact = normalizeContactForSave(form.primary_contact);

  const entity: Record<string, unknown> = {
    entity_id: form.entity_id,
    name: form.name.trim(),
    type: form.type,
    tax_treatment: form.tax_treatment,
    tax_registration_number: taxRegistrationRequired(form.tax_treatment)
      ? form.tax_registration_number.trim()
      : null,
    legal_name: form.legal_name.trim() || null,
    code: form.code.trim() || null,
    credit_limit: form.credit_limit.trim() || "0",
    payment_terms_days: form.payment_terms_days.trim() || "0",
    base_currency_override: form.base_currency_override.trim() || null,
    billing_address_line1: form.billing_address_line1.trim() || null,
    billing_address_line2: form.billing_address_line2.trim() || null,
    billing_city: form.billing_city.trim() || null,
    billing_state: form.billing_state.trim() || null,
    billing_zip_postal: form.billing_zip_postal.trim() || null,
    billing_country_code: form.billing_country_code.trim() || null,
    shipping_address_line1: shipping.shipping_address_line1.trim() || null,
    shipping_address_line2: shipping.shipping_address_line2.trim() || null,
    shipping_city: shipping.shipping_city.trim() || null,
    shipping_state: shipping.shipping_state.trim() || null,
    shipping_zip_postal: shipping.shipping_zip_postal.trim() || null,
    shipping_country_code: shipping.shipping_country_code.trim() || null,
    incoterms_code: form.incoterms_code.trim() || null,
    default_shipping_method: form.default_shipping_method.trim() || null,
    company_email: form.company_email.trim() || null,
    company_phone: form.company_phone.trim() || null,
    website_url: form.website_url.trim() || null,
    internal_notes: form.internal_notes.trim() || null,
    custom_fields: form.custom_fields,
    is_active: form.is_active,
  };

  const primary_contact =
    primaryContact.first_name.trim().length > 0
      ? {
          contact_id: primaryContact.contact_id,
          first_name: primaryContact.first_name.trim(),
          last_name: primaryContact.last_name.trim() || null,
          email: primaryContact.email.trim() || null,
          phone: primaryContact.phone.trim() || null,
          mobile: primaryContact.mobile.trim() || null,
          whatsapp_number: primaryContact.whatsapp_number.trim() || null,
          department: primaryContact.department.trim() || null,
          job_title: primaryContact.job_title.trim() || null,
        }
      : null;

  const extended_contacts = form.extended_contacts
    .map((contact) => normalizeContactForSave(contact))
    .filter((contact) => contact.first_name.trim().length > 0)
    .map((contact) => ({
      contact_id: contact.contact_id,
      first_name: contact.first_name.trim(),
      last_name: contact.last_name.trim() || null,
      email: contact.email.trim() || null,
      phone: contact.phone.trim() || null,
      mobile: contact.mobile.trim() || null,
      whatsapp_number: contact.whatsapp_number.trim() || null,
      department: contact.department.trim() || null,
      job_title: contact.job_title.trim() || null,
      is_active: contact.is_active,
      is_primary: false,
    }));

  return { entity, primary_contact, extended_contacts };
}

export function validateEntityFormState(form: EntityFormValues): string | null {
  const parsed = entityMasterSchema.safeParse(form);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Unable to validate entity form.";
  }
  return null;
}

export type EntityPersistResult =
  | { entity: EntityDetailSnapshot }
  | { error: string };

export type UseEntityFormOptions = {
  workspace: EntityWorkspace;
  editingEntity?: EntityDetailSnapshot | null;
  onSaved: (entity: EntityDetailSnapshot) => void;
  onPersist: (payload: ReturnType<typeof buildEntitySavePayload>) => Promise<EntityPersistResult>;
  notifyOnSave?: boolean;
};

export function useEntityForm({
  workspace,
  editingEntity = null,
  onSaved,
  onPersist,
  notifyOnSave = true,
}: UseEntityFormOptions) {
  const isEditing = Boolean(editingEntity);
  const [form, setForm] = useState<EntityFormValues>(() => createDefaultEntityFormValues(workspace));
  const [baseline, setBaseline] = useState<EntityFormValues>(() =>
    createDefaultEntityFormValues(workspace)
  );
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const resetFromEditing = useCallback(() => {
    if (editingEntity) {
      const next = formFromEntityDetail(editingEntity, workspace);
      setForm(next);
      setBaseline(next);
      setShowAdvanced(
        Boolean(
          next.legal_name.trim() ||
            next.code.trim() ||
            next.company_email.trim() ||
            next.extended_contacts.length
        )
      );
    } else {
      const next = createDefaultEntityFormValues(workspace);
      setForm(next);
      setBaseline(next);
      setShowAdvanced(false);
    }
    setError(null);
  }, [editingEntity, workspace]);

  useEffect(() => {
    resetFromEditing();
  }, [resetFromEditing]);

  const setFormWithBillingMirror = useCallback(
    (updater: (current: EntityFormValues) => EntityFormValues) => {
      setForm((current) => {
        const next = updater(current);
        if (!next.same_as_billing) return next;
        return {
          ...next,
          ...mirrorBillingToShipping(next),
        };
      });
    },
    []
  );

  const setSameAsBilling = useCallback((checked: boolean) => {
    setForm((current) => {
      const next = { ...current, same_as_billing: checked };
      if (!checked) return next;
      return {
        ...next,
        ...mirrorBillingToShipping(next),
      };
    });
  }, []);

  const setPrimaryContact = useCallback(
    (updater: (current: EntityFormContactValues) => EntityFormContactValues) => {
      setForm((current) => ({
        ...current,
        primary_contact: updater(current.primary_contact),
      }));
    },
    []
  );

  const setPrimaryContactWhatsappSameAsMobile = useCallback((checked: boolean) => {
    setPrimaryContact((contact) => ({
      ...contact,
      use_mobile_for_whatsapp: checked,
      whatsapp_number: checked ? contact.mobile : contact.whatsapp_number,
    }));
  }, [setPrimaryContact]);

  const setExtendedContactWhatsappSameAsMobile = useCallback(
    (index: number, checked: boolean) => {
      setForm((current) => ({
        ...current,
        extended_contacts: current.extended_contacts.map((contact, contactIndex) =>
          contactIndex === index
            ? {
                ...contact,
                use_mobile_for_whatsapp: checked,
                whatsapp_number: checked ? contact.mobile : contact.whatsapp_number,
              }
            : contact
        ),
      }));
    },
    []
  );

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline]
  );

  const submit = useCallback(() => {
    setError(null);
    const validationError = validateEntityFormState(form);
    if (validationError) {
      setError(validationError);
      if (notifyOnSave) toast.error(validationError);
      return;
    }

    startTransition(async () => {
      const payload = buildEntitySavePayload(form);
      const result = await onPersist(payload);

      if ("error" in result) {
        const message = result.error ?? "Unable to save entity.";
        setError(message);
        if (notifyOnSave) toast.error(message);
        return;
      }

      if (notifyOnSave) {
        toast.success(
          isEditing ? "Entity updated successfully" : "Entity created successfully"
        );
      }
      const nextBaseline = formFromEntityDetail(result.entity, workspace);
      setBaseline(nextBaseline);
      setForm(nextBaseline);
      onSaved(result.entity);
    });
  }, [form, isEditing, notifyOnSave, onPersist, onSaved, workspace]);

  return {
    form,
    setForm,
    setFormWithBillingMirror,
    baseline,
    error,
    setError,
    isPending,
    isEditing,
    isDirty,
    showAdvanced,
    setShowAdvanced,
    setSameAsBilling,
    setPrimaryContact,
    setPrimaryContactWhatsappSameAsMobile,
    setExtendedContactWhatsappSameAsMobile,
    resetFromEditing,
    submit,
    validateForm: () => validateEntityFormState(form),
    buildSavePayload: () => buildEntitySavePayload(form),
  };
}
