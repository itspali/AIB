"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ensureProductTag } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabelInfo, fieldHelpText, SubsectionHeading } from "@/components/ui/field-label-info";
import { CATALOG_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import type { ProductCatalogContext, ProductMasterFormValues } from "@/lib/products/types";
import { suggestSkuMask } from "@/lib/products/sku-mask";
import { editorCatalogBlockClass, editorSwitchSize } from "@/lib/products/editor-chrome";

type Props = {
  catalogContext: ProductCatalogContext;
  categoryTemplates: AttributeTemplateEntry[];
  showSkuMask?: boolean;
  /**
   * Which blocks to render. "catalog" = SKU mask, custom fields, and tags;
   * "reach" = storefront channel visibility. Omit to render everything.
   */
  only?: "catalog" | "reach";
  values: Pick<
    ProductMasterFormValues,
    "sku_mask" | "custom_fields" | "tag_ids" | "storefront_visibility"
  >;
  disabled?: boolean;
  compact?: boolean;
  onChange: <K extends keyof Props["values"]>(key: K, value: Props["values"][K]) => void;
  onTagsChanged?: (tags: ProductCatalogContext["tags"]) => void;
};

export function ProductCatalogExtensions({
  catalogContext,
  categoryTemplates,
  showSkuMask = false,
  only,
  values,
  disabled,
  compact = false,
  onChange,
  onTagsChanged,
}: Props) {
  const showCatalogBlocks = only !== "reach";
  const showStorefrontBlock = only !== "catalog";
  const [newTagName, setNewTagName] = useState("");
  const [isCreatingTag, startCreateTag] = useTransition();

  const handleCreateTag = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    startCreateTag(async () => {
      const result = await ensureProductTag(trimmed);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to create tag.");
        return;
      }

      const existing = catalogContext.tags.find((tag) => tag.id === result.tagId);
      const nextTag = existing ?? { id: result.tagId, name: trimmed, slug: trimmed.toLowerCase() };
      if (!existing) {
        onTagsChanged?.([...catalogContext.tags, nextTag].sort((a, b) => a.name.localeCompare(b.name)));
      }
      if (!values.tag_ids.includes(result.tagId)) {
        onChange("tag_ids", [...values.tag_ids, result.tagId]);
      }
      setNewTagName("");
      toast.success("Tag added.");
    });
  };

  return (
    <div className={compact ? "space-y-0" : "space-y-6 border-t border-border pt-6"}>
      {showCatalogBlocks && showSkuMask ? (
        <div className={editorCatalogBlockClass(compact)}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <SubsectionHeading
              title="SKU composition mask"
              info={fieldHelpText(CATALOG_FIELD_HELP.skuMask)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || categoryTemplates.length === 0}
              onClick={() => onChange("sku_mask", suggestSkuMask(categoryTemplates))}
            >
              <Wand2 className="h-4 w-4" />
              Suggest from category
            </Button>
          </div>
          <Input
            disabled={disabled}
            className="font-mono"
            placeholder="{BASE}-{Option1}-{Option2}"
            value={values.sku_mask}
            onChange={(event) => onChange("sku_mask", event.target.value)}
          />
        </div>
      ) : null}

      {showCatalogBlocks ? (
        <>
      <div className={editorCatalogBlockClass(compact)}>
        <div className="flex items-center justify-between">
          <SubsectionHeading
            title="Custom fields"
            info={fieldHelpText(CATALOG_FIELD_HELP.customFields)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange("custom_fields", [...values.custom_fields, { key: "", value: "" }])
            }
          >
            <Plus className="h-4 w-4" />
            Add field
          </Button>
        </div>
        {values.custom_fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom fields configured.</p>
        ) : (
          <div className="space-y-2">
            {values.custom_fields.map((row, index) => (
              <div key={`custom-field-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  disabled={disabled}
                  placeholder="Field key"
                  value={row.key}
                  onChange={(event) => {
                    const next = [...values.custom_fields];
                    next[index] = { ...next[index], key: event.target.value };
                    onChange("custom_fields", next);
                  }}
                />
                <Input
                  disabled={disabled}
                  placeholder="Field value"
                  value={row.value}
                  onChange={(event) => {
                    const next = [...values.custom_fields];
                    next[index] = { ...next[index], value: event.target.value };
                    onChange("custom_fields", next);
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={() =>
                    onChange(
                      "custom_fields",
                      values.custom_fields.filter((_, rowIndex) => rowIndex !== index)
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={editorCatalogBlockClass(compact)}>
        <SubsectionHeading
          title="Discovery tags"
          info={fieldHelpText(CATALOG_FIELD_HELP.tags)}
        />
        <div className="flex flex-wrap gap-2">
          {catalogContext.tags.map((tag) => {
            const selected = values.tag_ids.includes(tag.id);
            return (
              <Button
                key={tag.id}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                disabled={disabled}
                onClick={() =>
                  onChange(
                    "tag_ids",
                    selected
                      ? values.tag_ids.filter((id) => id !== tag.id)
                      : [...values.tag_ids, tag.id]
                  )
                }
              >
                {tag.name}
              </Button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Input
            disabled={disabled || isCreatingTag}
            placeholder="Create new tag"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || isCreatingTag || !newTagName.trim()}
            onClick={handleCreateTag}
          >
            Add tag
          </Button>
        </div>
      </div>
        </>
      ) : null}

      {showStorefrontBlock ? (
      <div className={editorCatalogBlockClass(compact)}>
        <SubsectionHeading
          title="Storefront channel visibility"
          info={fieldHelpText(CATALOG_FIELD_HELP.storefront)}
        />
        {catalogContext.storefronts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active storefront channels configured. Complete onboarding channel setup first.
          </p>
        ) : (
          <div className="space-y-3">
            {values.storefront_visibility.map((row, index) => {
              const channel = catalogContext.storefronts.find(
                (entry) => entry.id === row.storefront_id
              );
              if (!channel) return null;

              return (
                <div
                  key={row.storefront_id}
                  className={
                    compact
                      ? "space-y-2.5 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
                      : "rounded-lg border border-border p-4 space-y-3"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">{channel.channel_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">Visible</Label>
                        <FieldLabelInfo label="Visible">
                          {fieldHelpText(CATALOG_FIELD_HELP.channelVisible)}
                        </FieldLabelInfo>
                      </div>
                      <Switch
                        size={editorSwitchSize}
                        checked={row.is_visible}
                        disabled={disabled}
                        onCheckedChange={(checked) => {
                          const next = [...values.storefront_visibility];
                          next[index] = { ...next[index], is_visible: checked };
                          onChange("storefront_visibility", next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Storefront display name override
                        </Label>
                        <FieldLabelInfo label="Storefront display name override">
                          {fieldHelpText(CATALOG_FIELD_HELP.displayName)}
                        </FieldLabelInfo>
                      </div>
                      <Input
                        disabled={disabled}
                        placeholder={channel.name}
                        value={row.store_custom_name}
                        onChange={(event) => {
                          const next = [...values.storefront_visibility];
                          next[index] = { ...next[index], store_custom_name: event.target.value };
                          onChange("storefront_visibility", next);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs font-medium text-muted-foreground">
                          Channel price book override
                        </Label>
                        <FieldLabelInfo label="Channel price book override">
                          {fieldHelpText(CATALOG_FIELD_HELP.priceBook)}
                        </FieldLabelInfo>
                      </div>
                      <Select
                        value={row.store_price_book_id ?? "inherit"}
                        disabled={disabled}
                        onValueChange={(value) => {
                          const next = [...values.storefront_visibility];
                          next[index] = {
                            ...next[index],
                            store_price_book_id: value === "inherit" ? null : value,
                          };
                          onChange("storefront_visibility", next);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Use tenant default" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inherit">Use tenant default</SelectItem>
                          {catalogContext.price_books.map((book) => (
                            <SelectItem key={book.id} value={book.id}>
                              {book.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      ) : null}
    </div>
  );
}
