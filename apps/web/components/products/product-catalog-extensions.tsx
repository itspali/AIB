"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { ensureProductTag } from "@/app/items/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { UOM_OPTIONS } from "@/lib/products/uom-options";

type Props = {
  catalogContext: ProductCatalogContext;
  categoryTemplates: AttributeTemplateEntry[];
  values: Pick<
    ProductMasterFormValues,
    | "sku_mask"
    | "custom_fields"
    | "alternate_uoms"
    | "tag_ids"
    | "storefront_visibility"
    | "base_unit_of_measure"
  >;
  disabled?: boolean;
  onChange: <K extends keyof Props["values"]>(key: K, value: Props["values"][K]) => void;
  onTagsChanged?: (tags: ProductCatalogContext["tags"]) => void;
};

export function ProductCatalogExtensions({
  catalogContext,
  categoryTemplates,
  values,
  disabled,
  onChange,
  onTagsChanged,
}: Props) {
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
    <div className="space-y-6 border-t border-border pt-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h4 className="text-sm font-medium">SKU composition mask</h4>
            <p className="text-xs text-muted-foreground">
              Use {"{BASE}"} and attribute keys like {"{Size}"} to auto-compose variant SKUs.
            </p>
          </div>
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
          placeholder="{BASE}-{Size}-{Color}"
          value={values.sku_mask}
          onChange={(event) => onChange("sku_mask", event.target.value)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Custom fields</h4>
            <p className="text-xs text-muted-foreground">Flexible JSONB metadata stored on the parent item.</p>
          </div>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium">Alternate units of measure</h4>
            <p className="text-xs text-muted-foreground">
              Additional conversion factors beyond the base unit. Purchase unit in Commerce is synced automatically.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() =>
              onChange("alternate_uoms", [
                ...values.alternate_uoms,
                { uom_code: "BOX", conversion_factor: "1" },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Add UOM
          </Button>
        </div>
        {values.alternate_uoms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alternate units configured.</p>
        ) : (
          <div className="space-y-2">
            {values.alternate_uoms.map((row, index) => (
              <div key={`alternate-uom-${index}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <Select
                  value={row.uom_code}
                  disabled={disabled}
                  onValueChange={(value) => {
                    const next = [...values.alternate_uoms];
                    next[index] = { ...next[index], uom_code: value };
                    onChange("alternate_uoms", next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UOM_OPTIONS.filter((code) => code !== values.base_unit_of_measure).map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  disabled={disabled}
                  className="font-mono text-right"
                  inputMode="decimal"
                  placeholder="Conversion factor"
                  value={row.conversion_factor}
                  onChange={(event) => {
                    const next = [...values.alternate_uoms];
                    next[index] = { ...next[index], conversion_factor: event.target.value };
                    onChange("alternate_uoms", next);
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
                      "alternate_uoms",
                      values.alternate_uoms.filter((_, rowIndex) => rowIndex !== index)
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

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">Discovery tags</h4>
          <p className="text-xs text-muted-foreground">Assign catalog tags for search and storefront filtering.</p>
        </div>
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

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium">Storefront channel visibility</h4>
          <p className="text-xs text-muted-foreground">
            Control omnichannel exposure per storefront channel.
          </p>
        </div>
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
                <div key={row.storefront_id} className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{channel.name}</p>
                      <p className="text-xs text-muted-foreground">{channel.channel_type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Visible</Label>
                      <Switch
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
                      <Label className="text-xs text-muted-foreground">Storefront display name override</Label>
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
                      <Label className="text-xs text-muted-foreground">Channel price book override</Label>
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
    </div>
  );
}
