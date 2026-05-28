"use client";

import { Pencil } from "lucide-react";
import { attributeTypeLabel } from "@/lib/categories/attribute-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { CategoryRow } from "@/lib/categories/types";
import { resolveLineage } from "@/lib/categories/tree";

type Props = {
  category: CategoryRow;
  allRows: CategoryRow[];
  onEdit: (category: CategoryRow) => void;
};

export function CategoryDetailViewport({ category, allRows, onEdit }: Props) {
  const lineage = resolveLineage(category.id, allRows);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{category.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={category.is_active ? "completed" : "locked"}>
              {category.is_active ? "ACTIVE" : "INACTIVE"}
            </Badge>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => onEdit(category)}>
          <Pencil className="h-4 w-4" />
          Edit Category
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Parent lineage</h3>
        <p className="text-sm">{lineage.map((node) => node.name).join(" → ")}</p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
          <p className="text-sm">{formatDate(category.created_at)}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Last updated</h3>
          <p className="text-sm">{formatDate(category.updated_at)}</p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Dynamic attribute templates</h3>
        {category.attribute_templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No templates configured for this node.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/80 dark:border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th className="p-3 font-medium text-muted-foreground">Key</th>
                  <th className="p-3 font-medium text-muted-foreground">Label</th>
                  <th className="p-3 font-medium text-muted-foreground">Type</th>
                  <th className="p-3 font-medium text-muted-foreground">Required</th>
                  <th className="p-3 font-medium text-muted-foreground">Options</th>
                </tr>
              </thead>
              <tbody>
                {category.attribute_templates.map((entry) => (
                  <tr key={entry.key} className="border-b last:border-0">
                    <td className="p-3 font-medium">{entry.key}</td>
                    <td className="p-3">{entry.label}</td>
                    <td className="p-3">{attributeTypeLabel(entry.type)}</td>
                    <td className="p-3">{entry.required ? "Yes" : "No"}</td>
                    <td className="p-3 text-muted-foreground">
                      {entry.options?.length ? entry.options.join(", ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
