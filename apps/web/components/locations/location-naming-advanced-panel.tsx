"use client";

import { NamingSequenceEditor } from "@/components/settings/naming-sequence-editor";
import type { NamingSequenceEntry } from "@/lib/naming/sequences";

type Props = {
  value: Record<string, NamingSequenceEntry>;
  tenantDefaults: Record<string, NamingSequenceEntry>;
  onChange: (next: Record<string, NamingSequenceEntry>) => void;
};

export function LocationNamingAdvancedPanel({ value, tenantDefaults, onChange }: Props) {
  return (
    <section className="surface-panel space-y-4 p-4">
      <div>
        <h4 className="text-sm font-semibold">Document Naming Overrides</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Override organization-wide document prefixes for this facility node. Leave a prefix empty
          to inherit the tenant default from Organization Settings.
        </p>
      </div>
      <NamingSequenceEditor
        values={value}
        tenantDefaults={tenantDefaults}
        onChange={(key, field, fieldValue) =>
          onChange({
            ...value,
            [key]: {
              ...(value[key] ?? { prefix: "", digits: "5" }),
              [field]: fieldValue,
            },
          })
        }
      />
    </section>
  );
}
