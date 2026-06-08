"use client";

import { EntityCustomFieldsSettingsPanel } from "@/components/settings/entity-custom-fields-settings-panel";
import { saveOrganizationEntityCustomFields } from "@/app/settings/organization/actions";
import type { OrganizationSettingsAccess } from "@/lib/organization/access";
import type { OrganizationSettingsSnapshot } from "@/lib/organization/types";

type Props = {
  snapshot: OrganizationSettingsSnapshot;
  access: OrganizationSettingsAccess;
  inheritedGroupSettings?: OrganizationSettingsSnapshot["group_entity_settings"];
};

export function OrganizationEntityFieldsSection({
  snapshot,
  access,
  inheritedGroupSettings = null,
}: Props) {
  return (
    <EntityCustomFieldsSettingsPanel
      title="Entity custom fields"
      description="Define additional customer and supplier profile fields for this organization. Values are stored on each entity record."
      entitySettings={snapshot.entity_settings}
      inheritedGroupSettings={inheritedGroupSettings}
      disabled={!access.isOwner}
      onSave={async (workspace, definitions) =>
        saveOrganizationEntityCustomFields(workspace, definitions)
      }
    />
  );
}
