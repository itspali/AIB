"use client";

import { Pencil, Trash2 } from "lucide-react";
import { AttributeTemplatePreview } from "@/components/categories/attribute-template-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { CategoryRow } from "@/lib/categories/types";
import { resolveEffectiveAttributeTemplates, resolveLineage } from "@/lib/categories/tree";

type Props = {
  category: CategoryRow;
  allRows: CategoryRow[];
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
};

function schemaForItemsDescription(category: CategoryRow): string {
  if (category.parent_id && category.inherit_parent_attributes) {
    return "Merged inherited parent fields and this category's attributes. Local definitions override matching labels.";
  }
  return "Attribute fields used when creating or editing items in this category.";
}

export function CategoryDetailViewport({
  category,
  allRows,
  onEdit,
  onDelete,
}: Props) {
  const lineage = resolveLineage(category.id, allRows);
  const schemaForItems = resolveEffectiveAttributeTemplates(category.id, allRows);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">{category.name}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant={category.is_active ? "completed" : "locked"}>
              {category.is_active ? "ACTIVE" : "INACTIVE"}
            </Badge>
            {category.parent_id ? (
              <Badge variant="administrative">
                {category.inherit_parent_attributes
                  ? "Inherits parent attributes"
                  : "Standalone attributes"}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(category)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(category)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
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
        <h3 className="text-sm font-medium text-muted-foreground">Schema for items</h3>
        <p className="text-xs text-muted-foreground">{schemaForItemsDescription(category)}</p>
        <AttributeTemplatePreview
          templates={schemaForItems}
          emptyMessage="No attributes in this category's item schema yet."
        />
      </section>
    </div>
  );
}
