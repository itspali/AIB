"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
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
} from "@/lib/documents/catalog-field-ids";
import {
  addPoCatalogField,
  createPoCatalogFieldPref,
  movePoCatalogLineFieldOrder,
  removePoCatalogField,
} from "@/lib/documents/purchase-order-layout";
import {
  GST_MANDATORY_HSN_DISABLED_REASON,
  isGstMandatoryCatalogFieldId,
} from "@/lib/documents/gst-document-layout-compliance";
import type { DocumentLayoutModuleAdapter } from "@/lib/documents/document-layout-module-adapters";
import type { DocumentCatalogFieldSource, DocumentLayoutTemplate } from "@/lib/documents/types";

type CatalogFieldSuggestion = {
  source: DocumentCatalogFieldSource;
  key: string;
  label: string;
};

type Props = {
  layout: DocumentLayoutTemplate;
  canEdit?: boolean;
  gstRegistered?: boolean;
  customFieldKeys?: string[];
  variantAttributeKeys?: string[];
  catalogAdapter?: DocumentLayoutModuleAdapter["catalog"];
  compactToolbar?: boolean;
  flush?: boolean;
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
  gstRegistered = false,
  customFieldKeys = [],
  variantAttributeKeys = [],
  catalogAdapter,
  compactToolbar = false,
  flush = false,
  onLayoutChange,
}: Props) {
  const catalog = catalogAdapter ?? {
    add: addPoCatalogField,
    createPref: createPoCatalogFieldPref,
    move: movePoCatalogLineFieldOrder,
    remove: removePoCatalogField,
  };
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
    if (isGstMandatoryCatalogFieldId(id, gstRegistered) && patch.defaultVisible === false) {
      return;
    }
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
    const pref = catalog.createPref(suggestion.source, suggestion.key, suggestion.label);
    onLayoutChange(catalog.add(layout, pref));
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
    const pref = catalog.createPref("item_custom_field", key);
    onLayoutChange(catalog.add(layout, pref));
    setCustomKey("");
  };

  const handleRemoveField = (fieldId: string) => {
    if (isGstMandatoryCatalogFieldId(fieldId, gstRegistered)) return;
    onLayoutChange(catalog.remove(layout, fieldId));
  };

  return (
    <div className="space-y-2">
      <DocumentLayoutFieldList
        order={layout.catalogLineFieldOrder}
        getColumn={(id) => layout.columns.find((column) => column.id === id)}
        showPresentationColumns
        showTypographyColumns={!compactToolbar}
        compactToolbar={compactToolbar}
        flush={flush}
        getMeta={(id) => ({
          draggable: true,
          disabled: !canEdit,
          pinned: isGstMandatoryCatalogFieldId(id, gstRegistered),
          removable: canEdit && !isGstMandatoryCatalogFieldId(id, gstRegistered),
          disabledReason: isGstMandatoryCatalogFieldId(id, gstRegistered)
            ? GST_MANDATORY_HSN_DISABLED_REASON
            : undefined,
          lockLineSlot: "item_detail",
        })}
        onPatch={patchColumn}
        onMove={(fromId, toId) =>
          onLayoutChange(catalog.move(layout, fromId, toId))
        }
        onRemove={canEdit ? handleRemoveField : undefined}
      />

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
