"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { deleteProductTag, ensureProductTag, updateProductTag } from "@/app/items/actions";
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
import type { ProductCatalogContext, ProductMasterFormValues } from "@/lib/products/types";
import { editorCatalogBlockClass, editorGridClass, editorSwitchSize } from "@/lib/products/editor-chrome";
import {
  VISIBILITY_CHANNELS_SUBSECTION,
  VISIBILITY_SECTION_HELP,
} from "@/lib/products/product-user-labels";

export type CatalogExtensionBlock = "custom_fields" | "tags" | "channels";

type Props = {
  catalogContext: ProductCatalogContext;
  blocks?: CatalogExtensionBlock[];
  values: Pick<
    ProductMasterFormValues,
    "custom_fields" | "tag_ids" | "storefront_visibility"
  >;
  disabled?: boolean;
  compact?: boolean;
  onChange: <K extends keyof Props["values"]>(key: K, value: Props["values"][K]) => void;
  onTagsChanged?: (tags: ProductCatalogContext["tags"]) => void;
};

function resolveBlocks(blocks?: CatalogExtensionBlock[]): Set<CatalogExtensionBlock> {
  if (!blocks?.length) {
    return new Set<CatalogExtensionBlock>(["custom_fields", "tags", "channels"]);
  }
  return new Set(blocks);
}

export function ProductCatalogExtensions({
  catalogContext,
  blocks,
  values,
  disabled,
  compact = false,
  onChange,
  onTagsChanged,
}: Props) {
  const activeBlocks = resolveBlocks(blocks);
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null);
  const [isCreatingTag, startCreateTag] = useTransition();
  const [isUpdatingTag, startUpdateTag] = useTransition();
  const [isDeletingTag, startDeleteTag] = useTransition();

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

  const startEditingTag = (tagId: string, name: string) => {
    setEditingTagId(tagId);
    setEditingTagName(name);
    setDeletingTagId(null);
  };

  const cancelEditingTag = () => {
    setEditingTagId(null);
    setEditingTagName("");
  };

  const handleSaveTag = () => {
    if (!editingTagId) return;
    const trimmed = editingTagName.trim();
    if (!trimmed) return;

    startUpdateTag(async () => {
      const result = await updateProductTag(editingTagId, trimmed);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to update tag.");
        return;
      }

      onTagsChanged?.(
        catalogContext.tags
          .map((tag) => (tag.id === editingTagId ? result.tag : tag))
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      cancelEditingTag();
      toast.success("Tag updated.");
    });
  };

  const handleDeleteTag = (tagId: string) => {
    startDeleteTag(async () => {
      const result = await deleteProductTag(tagId);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete tag.");
        return;
      }

      onTagsChanged?.(catalogContext.tags.filter((tag) => tag.id !== tagId));
      if (values.tag_ids.includes(tagId)) {
        onChange(
          "tag_ids",
          values.tag_ids.filter((id) => id !== tagId)
        );
      }
      if (editingTagId === tagId) cancelEditingTag();
      setDeletingTagId(null);
      toast.success("Tag deleted.");
    });
  };

  return (
    <div className={compact ? "space-y-0" : "space-y-4"}>
      {activeBlocks.has("custom_fields") ? (
        <div className={editorCatalogBlockClass(compact)}>
          <div className="flex items-center justify-between gap-2">
            <SubsectionHeading
              title="Custom fields"
              compact={compact}
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
              Add
            </Button>
          </div>
          {values.custom_fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">No custom fields configured.</p>
          ) : (
            <div className="space-y-1.5">
              {values.custom_fields.map((row, index) => (
                <div
                  key={`custom-field-${index}`}
                  className="grid grid-cols-1 gap-1.5 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <Input
                    disabled={disabled}
                    placeholder="Key"
                    value={row.key}
                    onChange={(event) => {
                      const next = [...values.custom_fields];
                      next[index] = { ...next[index], key: event.target.value };
                      onChange("custom_fields", next);
                    }}
                  />
                  <Input
                    disabled={disabled}
                    placeholder="Value"
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
      ) : null}

      {activeBlocks.has("tags") ? (
        <div className={editorCatalogBlockClass(compact)}>
          <SubsectionHeading
            title="Discovery tags"
            compact={compact}
            info={fieldHelpText(CATALOG_FIELD_HELP.tags)}
          />
          <div className="flex flex-wrap gap-1.5">
            {catalogContext.tags.map((tag) => {
              const selected = values.tag_ids.includes(tag.id);
              const isEditing = editingTagId === tag.id;
              const isConfirmingDelete = deletingTagId === tag.id;

              if (isEditing) {
                return (
                  <div
                    key={tag.id}
                    className="flex min-w-[12rem] items-center gap-1 rounded-md border border-border bg-background px-1.5 py-1"
                  >
                    <Input
                      className="h-7 flex-1 text-sm"
                      disabled={disabled || isUpdatingTag}
                      value={editingTagName}
                      onChange={(event) => setEditingTagName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleSaveTag();
                        if (event.key === "Escape") cancelEditingTag();
                      }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 p-0"
                      disabled={disabled || isUpdatingTag || !editingTagName.trim()}
                      onClick={handleSaveTag}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 p-0"
                      disabled={disabled || isUpdatingTag}
                      onClick={cancelEditingTag}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              }

              if (isConfirmingDelete) {
                return (
                  <div
                    key={tag.id}
                    className="flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1"
                  >
                    <span className="text-xs text-muted-foreground">Delete {tag.name}?</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={disabled || isDeletingTag}
                      onClick={() => handleDeleteTag(tag.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={disabled || isDeletingTag}
                      onClick={() => setDeletingTagId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                );
              }

              return (
                <div
                  key={tag.id}
                  className="inline-flex items-center overflow-hidden rounded-md border border-border"
                >
                  <Button
                    type="button"
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    className="rounded-none border-0"
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
                  {!disabled ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 shrink-0 rounded-none border-0 border-l border-border p-0"
                        aria-label={`Rename ${tag.name}`}
                        onClick={() => startEditingTag(tag.id, tag.name)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 shrink-0 rounded-none border-0 border-l border-border p-0 text-destructive hover:text-destructive"
                        aria-label={`Delete ${tag.name}`}
                        onClick={() => {
                          setDeletingTagId(tag.id);
                          cancelEditingTag();
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-2">
            <Input
              disabled={disabled || isCreatingTag}
              placeholder="New tag"
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
      ) : null}

      {activeBlocks.has("channels") ? (
        <div className={editorCatalogBlockClass(compact)}>
          <SubsectionHeading
            title={VISIBILITY_CHANNELS_SUBSECTION}
            compact={compact}
            info={fieldHelpText(`${CATALOG_FIELD_HELP.storefront} ${VISIBILITY_SECTION_HELP}`)}
          />
          {catalogContext.storefronts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active storefront channels configured. Complete onboarding channel setup first.
            </p>
          ) : (
            <div className="space-y-2">
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
                        ? "space-y-2 border-b border-border/50 pb-2 last:border-b-0 last:pb-0"
                        : "rounded-md border border-border/60 px-3 py-2.5 space-y-2"
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{channel.name}</p>
                        <p className="text-xs text-muted-foreground">{channel.channel_type}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Label className="text-xs text-muted-foreground">Listed</Label>
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
                    <div className={editorGridClass(Boolean(compact))}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Channel title</Label>
                          <FieldLabelInfo label="Channel title">
                            {fieldHelpText(CATALOG_FIELD_HELP.displayName(channel.name))}
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
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Label className="text-xs text-muted-foreground">Price book</Label>
                          <FieldLabelInfo label="Price book">
                            {fieldHelpText(
                              `${CATALOG_FIELD_HELP.priceBook} ${CATALOG_FIELD_HELP.priceBookSelect}`
                            )}
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
                            <SelectValue />
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
