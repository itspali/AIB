"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DocumentLayoutFieldList } from "@/components/settings/document-layout/document-layout-field-list";
import {
  PO_BUILTIN_ITEM_COLUMN_KEYS,
  VARIANT_ATTRIBUTES_ALL_ID,
  buildCatalogFieldId,
  defaultLabelForBuiltinItemColumn,
  isCatalogFieldId,
} from "@/lib/documents/catalog-field-ids";
import {
  addPoCatalogField,
  createPoCatalogFieldPref,
  movePoCatalogLineFieldOrder,
  removePoCatalogField,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentCatalogFieldSource, DocumentLayoutTemplate } from "@/lib/documents/types";

type CatalogFieldSuggestion = {
  source: DocumentCatalogFieldSource;
  key: string;
  label: string;
};

type Props = {
  layout: DocumentLayoutTemplate;
  canEdit?: boolean;
  customFieldKeys?: string[];
  variantAttributeKeys?: string[];
  onLayoutChange: (layout: DocumentLayoutTemplate) => void;
};

const BUILTIN_SUGGESTIONS: CatalogFieldSuggestion[] = [
  {
    source: "variant_attributes_all",
    key: "__all__",
    label: "All variant attributes",
  },
  ...PO_BUILTIN_ITEM_COLUMN_KEYS.map((key) => ({
    source: "item_column" as const,
    key,
    label: defaultLabelForBuiltinItemColumn(key),
  })),
];

function suggestionId(suggestion: CatalogFieldSuggestion): string {
  return buildCatalogFieldId(suggestion.source, suggestion.key);
}

export function DocumentLayoutCatalogFieldsSection({
  layout,
  canEdit = true,
  customFieldKeys = [],
  variantAttributeKeys = [],
  onLayoutChange,
}: Props) {
  const [customKey, setCustomKey] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState("");

  const existingIds = useMemo(
    () => new Set(layout.catalogLineFieldOrder),
    [layout.catalogLineFieldOrder]
  );

  const dynamicSuggestions = useMemo(() => {
    const suggestions: CatalogFieldSuggestion[] = [];
    for (const key of variantAttributeKeys) {
      suggestions.push({
        source: "variant_attribute",
        key,
        label: key,
      });
    }
    for (const key of customFieldKeys) {
      suggestions.push({
        source: "item_custom_field",
        key,
        label: key,
      });
    }
    return suggestions;
  }, [customFieldKeys, variantAttributeKeys]);

  const addableSuggestions = useMemo(
    () =>
      [...BUILTIN_SUGGESTIONS, ...dynamicSuggestions].filter(
        (suggestion) => !existingIds.has(suggestionId(suggestion))
      ),
    [dynamicSuggestions, existingIds]
  );

  const patchColumn = (id: string, patch: Partial<(typeof layout.columns)[number]>) => {
    onLayoutChange({
      ...layout,
      columns: layout.columns.map((column) =>
        column.id === id ? { ...column, ...patch, id: column.id } : column
      ),
    });
  };

  const handleAddSuggestion = () => {
    const suggestion = addableSuggestions.find(
      (entry) => suggestionId(entry) === selectedSuggestion
    );
    if (!suggestion) return;
    const pref = createPoCatalogFieldPref(suggestion.source, suggestion.key, suggestion.label);
    onLayoutChange(addPoCatalogField(layout, pref));
    setSelectedSuggestion("");
  };

  const handleAddCustomField = () => {
    const key = customKey.trim();
    if (!key) return;
    const id = buildCatalogFieldId("item_custom_field", key);
    if (existingIds.has(id)) {
      setCustomKey("");
      return;
    }
    const pref = createPoCatalogFieldPref("item_custom_field", key);
    onLayoutChange(addPoCatalogField(layout, pref));
    setCustomKey("");
  };

  const handleRemoveField = (fieldId: string) => {
    onLayoutChange(removePoCatalogField(layout, fieldId));
  };

  return (
    <div className="space-y-2">
      <DocumentLayoutFieldList
        order={layout.catalogLineFieldOrder}
        getColumn={(id) => layout.columns.find((column) => column.id === id)}
        showPresentationColumns
        showTypographyColumns
        getMeta={(id) => ({
          draggable: true,
          disabled: !canEdit,
          lockLineSlot: "item_detail",
        })}
        onPatch={patchColumn}
        onMove={(fromId, toId) =>
          onLayoutChange(movePoCatalogLineFieldOrder(layout, fromId, toId))
        }
      />

      {canEdit && layout.catalogLineFieldOrder.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {layout.catalogLineFieldOrder.map((fieldId) => {
            const column = layout.columns.find((entry) => entry.id === fieldId);
            if (!column) return null;
            return (
              <Button
                key={fieldId}
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-2 text-[10px] text-muted-foreground"
                onClick={() => handleRemoveField(fieldId)}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Remove {column.label}
              </Button>
            );
          })}
        </div>
      ) : null}

      {layout.catalogLineFieldOrder.length === 0 ? (
        <p className="text-[10px] text-muted-foreground">
          No catalog fields — variant attributes and item custom fields can appear under the item cell.
        </p>
      ) : null}

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2">
          {addableSuggestions.length > 0 ? (
            <div className="flex min-w-[12rem] flex-1 items-end gap-1.5">
              <div className="min-w-0 flex-1 space-y-0.5">
                <label className="text-[10px] text-muted-foreground">Add catalog field</label>
                <Select value={selectedSuggestion} onValueChange={setSelectedSuggestion}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Choose field…" />
                  </SelectTrigger>
                  <SelectContent>
                    {addableSuggestions.map((suggestion) => {
                      const id = suggestionId(suggestion);
                      return (
                        <SelectItem key={id} value={id} className="text-xs">
                          {suggestion.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 shrink-0 px-2"
                disabled={!selectedSuggestion}
                onClick={handleAddSuggestion}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add
              </Button>
            </div>
          ) : null}

          <div className="flex min-w-[12rem] flex-1 items-end gap-1.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <label className="text-[10px] text-muted-foreground">Item custom field key</label>
              <Input
                value={customKey}
                onChange={(event) => setCustomKey(event.target.value)}
                placeholder="e.g. brand"
                className="h-7 text-xs"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddCustomField();
                  }
                }}
              />
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 px-2"
              disabled={!customKey.trim()}
              onClick={handleAddCustomField}
            >
              Add
            </Button>
          </div>
        </div>
      ) : null}

      {existingIds.has(VARIANT_ATTRIBUTES_ALL_ID) ? null : (
        <p className="text-[10px] text-muted-foreground/80">
          Tip: enable &quot;All variant attributes&quot; to show category-driven SKU attributes (Color, Size, etc.).
        </p>
      )}
    </div>
  );
}
