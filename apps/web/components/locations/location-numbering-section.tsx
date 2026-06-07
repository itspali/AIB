"use client";

import { NamingSequenceEditor } from "@/components/settings/naming-sequence-editor";
import type { NamingSequenceEntry } from "@/lib/naming/sequences";

type Props = {
  keys: readonly string[];
  value: Record<string, NamingSequenceEntry>;
  onChange: (next: Record<string, NamingSequenceEntry>) => void;
};

export function LocationNumberingSection({ keys, value, onChange }: Props) {
  return (
    <section className="surface-panel space-y-4 p-4">
      <div>
        <h4 className="text-sm font-semibold">Document Numbering</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Configure document prefixes and next sequence numbers for vouchers issued at this
          facility. Only document types relevant to this location&apos;s capabilities are shown.
        </p>
      </div>
      <NamingSequenceEditor
        keys={keys}
        values={value}
        showNextValue
        onChange={(key, field, fieldValue) => {
          const current = value[key] ?? { prefix: "", digits: "5", next: "" };
          const nextEntry: NamingSequenceEntry = {
            ...current,
            [field]: fieldValue,
          };
          if (field === "prefix" && fieldValue.trim() && !current.next?.trim()) {
            nextEntry.next = "1";
          }
          onChange({
            ...value,
            [key]: nextEntry,
          });
        }}
      />
    </section>
  );
}
