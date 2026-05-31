"use client";

import { NamingSequenceEditor } from "@/components/settings/naming-sequence-editor";
import { DocumentSequenceReadout } from "@/components/settings/document-sequence-readout";
import type { DocumentSequenceRow } from "@/lib/organization/types";
import type { NamingSequenceEntry } from "@/lib/naming/sequences";

type Props = {
  keys: readonly string[];
  value: Record<string, NamingSequenceEntry>;
  documentSequences?: DocumentSequenceRow[];
  onChange: (next: Record<string, NamingSequenceEntry>) => void;
};

export function LocationNumberingSection({
  keys,
  value,
  documentSequences = [],
  onChange,
}: Props) {
  return (
    <section className="surface-panel space-y-4 p-4">
      <div>
        <h4 className="text-sm font-semibold">Document Numbering</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure document prefixes for vouchers issued at this facility. Only document types
          relevant to this location&apos;s capabilities are shown.
        </p>
      </div>
      <NamingSequenceEditor
        keys={keys}
        values={value}
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
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Live sequence counters
        </p>
        <DocumentSequenceReadout rows={documentSequences} />
      </div>
    </section>
  );
}
