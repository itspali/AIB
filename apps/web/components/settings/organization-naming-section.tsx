"use client";

import type { UseFormReturn } from "react-hook-form";
import { DocumentSequenceReadout } from "@/components/settings/document-sequence-readout";
import { NamingSequenceEditor } from "@/components/settings/naming-sequence-editor";
import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import type {
  DocumentSequenceRow,
  OrganizationSettingsFormValues,
} from "@/lib/organization/types";

type Props = {
  form: UseFormReturn<OrganizationSettingsFormValues>;
  documentSequences: DocumentSequenceRow[];
  disabled?: boolean;
};

export function OrganizationNamingSection({ form, documentSequences, disabled }: Props) {
  const { watch, setValue } = form;
  const namingSequences = watch("naming_sequences");

  return (
    <OrgSettingsSection
      title="Document Naming Sequences"
      description="Tenant-wide voucher prefix and padding defaults."
    >
      <p className="text-sm text-muted-foreground">
        Tenant-wide defaults for all facility nodes. Override per location in the Location Command
        Center advanced settings when a site needs its own prefixes.
      </p>
      <NamingSequenceEditor
        values={namingSequences}
        disabled={disabled}
        onChange={(key, field, value) =>
          setValue(
            "naming_sequences",
            {
              ...namingSequences,
              [key]: {
                ...(namingSequences[key] ?? { prefix: "", digits: "5" }),
                [field]: value,
              },
            },
            { shouldDirty: true }
          )
        }
      />
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">Live sequence counters</h3>
        <DocumentSequenceReadout rows={documentSequences} />
      </div>
    </OrgSettingsSection>
  );
}
