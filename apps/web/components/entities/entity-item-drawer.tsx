"use client";

import { useEffect, useState } from "react";
import { loadEntityDetail } from "@/app/entities/actions";
import { EntityDrawerForm } from "@/components/entities/entity-drawer-form";
import type { EntityDetailSnapshot, EntityListRow, EntityWorkspace } from "@/lib/entities/types";
import type { EntityCustomFieldDefinition } from "@/lib/entities/custom-field-definitions";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";

type Props = {
  workspace: EntityWorkspace;
  tenantId: string;
  customFieldDefinitions: EntityCustomFieldDefinition[];
  open: boolean;
  surface: DrawerSurface;
  recordId: string | null;
  peekListRow: EntityListRow | null;
  onClose: () => void;
  onOpenEdit: (entityId: string) => void;
  onAfterSave: (entityId: string, entity: EntityDetailSnapshot) => void;
  onDelete?: (entity: EntityDetailSnapshot) => void;
};

export function EntityItemDrawer({
  workspace,
  tenantId,
  customFieldDefinitions,
  open,
  surface,
  recordId,
  peekListRow,
  onClose,
  onOpenEdit,
  onAfterSave,
  onDelete,
}: Props) {
  const [detail, setDetail] = useState<EntityDetailSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || surface === "create" || !recordId) {
      setDetail(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void loadEntityDetail(recordId).then((nextDetail) => {
      if (cancelled) return;
      setDetail(nextDetail);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, recordId, surface]);

  const editingEntity =
    surface === "create"
      ? null
      : detail ??
        (peekListRow && recordId === peekListRow.id
          ? ({
              id: peekListRow.id,
              name: peekListRow.name,
              legal_name: peekListRow.legal_name,
              code: peekListRow.code,
              type: peekListRow.type,
              tax_registration_number: peekListRow.tax_registration_number,
              tax_treatment: peekListRow.tax_treatment,
              base_currency_override: null,
              credit_limit: peekListRow.credit_limit,
              current_balance: peekListRow.current_balance,
              payment_terms_days: peekListRow.payment_terms_days,
              billing_address_line1: null,
              billing_address_line2: null,
              billing_city: null,
              billing_state: null,
              billing_zip_postal: null,
              billing_country_code: null,
              shipping_address_line1: null,
              shipping_address_line2: null,
              shipping_city: null,
              shipping_state: null,
              shipping_zip_postal: null,
              shipping_country_code: null,
              incoterms_code: null,
              default_shipping_method: null,
              company_email: peekListRow.company_email,
              company_phone: peekListRow.company_phone,
              website_url: null,
              internal_notes: null,
              logo_url: peekListRow.logo_url ?? null,
              custom_fields: {},
              is_active: peekListRow.is_active,
              created_at: peekListRow.created_at,
              updated_at: peekListRow.updated_at,
              contacts: [],
              primary_contact: null,
              bank_accounts: [],
            } satisfies EntityDetailSnapshot)
          : null);

  return (
    <EntityDrawerForm
      workspace={workspace}
      tenantId={tenantId}
      customFieldDefinitions={customFieldDefinitions}
      open={open}
      surface={surface}
      editingEntity={editingEntity}
      isLoading={isLoading}
      onClose={onClose}
      onOpenEdit={onOpenEdit}
      onAfterSave={onAfterSave}
      onDelete={onDelete}
    />
  );
}
