"use client";

import { attributeTypeLabel } from "@/lib/categories/attribute-types";
import type { AttributeTemplateEntry } from "@/lib/categories/types";

type Props = {
  templates: AttributeTemplateEntry[];
  emptyMessage?: string;
};

export function AttributeTemplatePreview({
  templates,
  emptyMessage = "None",
}: Props) {
  if (templates.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="table-chrome-frame overflow-x-auto rounded-lg border border-border/80 dark:border-white/10">
      <table data-header-tone="muted-50" className="table-chrome w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2 font-medium text-muted-foreground">Label</th>
            <th className="p-2 font-medium text-muted-foreground">Type</th>
            <th className="p-2 font-medium text-muted-foreground">Required</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((entry) => (
            <tr key={entry.key} className="border-b last:border-0">
              <td className="p-2 font-medium">{entry.label}</td>
              <td className="p-2">{attributeTypeLabel(entry.type)}</td>
              <td className="p-2">{entry.required ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
