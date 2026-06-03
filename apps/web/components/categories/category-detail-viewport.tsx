"use client";

import { Pencil } from "lucide-react";
import { AttributeTemplatePreview } from "@/components/categories/attribute-template-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dashboard/format";
import type { CategoryRow } from "@/lib/categories/types";
import {
  resolveEffectiveAttributeTemplates,
  resolveInheritedAttributeTemplates,
  resolveLineage,
} from "@/lib/categories/tree";

type Props = {
  category: CategoryRow;
  allRows: CategoryRow[];
  onEdit: (category: CategoryRow) => void;
};

export function CategoryDetailViewport({ category, allRows, onEdit }: Props) {
  const lineage = resolveLineage(category.id, allRows);
  const inheritedTemplates = resolveInheritedAttributeTemplates(category.id, allRows);
  const effectiveTemplates = resolveEffectiveAttributeTemplates(category.id, allRows);

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

      {category.inherit_parent_attributes && inheritedTemplates.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Inherited from parent</h3>
          <AttributeTemplatePreview templates={inheritedTemplates} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Attributes on this category</h3>
        <AttributeTemplatePreview
          templates={category.attribute_templates}
          emptyMessage="No attributes defined on this category."
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">Effective for items</h3>
        <p className="text-xs text-muted-foreground">
          Merged attribute templates applied when creating or editing products in this category.
        </p>
        <AttributeTemplatePreview
          templates={effectiveTemplates}
          emptyMessage="No effective attribute templates."
        />
      </section>
    </div>
  );
}
