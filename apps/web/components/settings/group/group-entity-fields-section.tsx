"use client";

import { EntityCustomFieldsSettingsPanel } from "@/components/settings/entity-custom-fields-settings-panel";
import { saveGroupEntityCustomFields } from "@/app/settings/enterprise/actions";
import type { GroupSettingsAccess, GroupSettingsSnapshot } from "@/lib/group/types";

type Props = {
  snapshot: GroupSettingsSnapshot;
  access: GroupSettingsAccess | null;
};

export function GroupEntityFieldsSection({ snapshot, access }: Props) {
  return (
    <EntityCustomFieldsSettingsPanel
      title="Entity custom fields"
      description="Standard customer and supplier profile fields shared across all organizations in this group."
      entitySettings={snapshot.entity_settings}
      disabled={!access?.granted}
      onSave={async (workspace, definitions) =>
        saveGroupEntityCustomFields(snapshot.group_id, workspace, definitions)
      }
    />
  );
}
