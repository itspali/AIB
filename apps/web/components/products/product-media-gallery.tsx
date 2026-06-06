"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { deleteItemMedia, saveItemMedia } from "@/app/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldLabelInfo, fieldHelpText } from "@/components/ui/field-label-info";
import { MEDIA_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  buildProductMediaStoragePath,
  PRODUCT_MEDIA_BUCKET,
} from "@/lib/products/media";
import {
  filterSharedMedia,
  filterVariantSpecificMedia,
  findMasterVariant,
  listMediaVariantRows,
  type MediaVariantRow,
} from "@/lib/products/media-variants";
import type { ProductMediaSnapshot, ProductVariantSnapshot } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ProductMediaGalleryLayout = "scope-select" | "variant-stack";

type MediaScope = "parent" | string;

type Props = {
  tenantId: string;
  itemId: string;
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly?: boolean;
  onChanged: () => void;
  layout?: ProductMediaGalleryLayout;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const INITIAL_MEDIA_COUNT = 2;

function scopeLabel(scope: MediaScope, variants: ProductVariantSnapshot[]): string {
  if (scope === "parent") return "Product (parent)";
  const variant = variants.find((entry) => entry.id === scope);
  return variant ? `Variant: ${variant.sku}` : "Variant";
}

function filterMediaForScope(media: ProductMediaSnapshot[], scope: MediaScope): ProductMediaSnapshot[] {
  if (scope === "parent") {
    return media.filter((entry) => entry.variant_id === null);
  }
  return media.filter((entry) => entry.variant_id === scope);
}

function useProductMediaActions({
  tenantId,
  itemId,
  onChanged,
}: {
  tenantId: string;
  itemId: string;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadScopeKey, setUploadScopeKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const uploadFile = useCallback(
    async (
      file: File,
      variantId: string | null,
      existingCount: number,
      scopeKey: string
    ) => {
      setUploadError(null);

      if (!ALLOWED_TYPES.has(file.type)) {
        setUploadError("Use JPEG, PNG, or WebP images only.");
        return;
      }

      if (file.size > MAX_BYTES) {
        setUploadError("Image must be 5MB or smaller.");
        return;
      }

      const mediaId = crypto.randomUUID();
      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = buildProductMediaStoragePath(
        tenantId,
        itemId,
        mediaId,
        extension,
        variantId
      );

      setUploadScopeKey(scopeKey);
      setIsUploading(true);
      const supabase = createClient();

      const { error: uploadErrorResult } = await supabase.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

      setIsUploading(false);
      setUploadScopeKey(null);

      if (uploadErrorResult) {
        setUploadError(uploadErrorResult.message);
        return;
      }

      startTransition(async () => {
        const result = await saveItemMedia({
          media_id: null,
          item_id: itemId,
          variant_id: variantId,
          storage_url: path,
          sort_order: existingCount,
          is_primary: existingCount === 0,
          show_on_storefront: true,
          show_in_digital_catalog: true,
          show_on_internal_transactions: false,
        });

        if ("error" in result) {
          await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
          toast.error(result.error ?? "Unable to save media record.");
          return;
        }

        toast.success("Image uploaded.");
        onChanged();
        router.refresh();
      });
    },
    [itemId, onChanged, router, tenantId]
  );

  const updateMedia = useCallback(
    (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => {
      startTransition(async () => {
        const result = await saveItemMedia({
          media_id: entry.id,
          item_id: itemId,
          variant_id: entry.variant_id,
          storage_url: entry.storage_url,
          sort_order: patch.sort_order ?? entry.sort_order,
          is_primary: patch.is_primary ?? entry.is_primary,
          show_on_storefront: patch.show_on_storefront ?? entry.show_on_storefront,
          show_in_digital_catalog:
            patch.show_in_digital_catalog ?? entry.show_in_digital_catalog,
          show_on_internal_transactions:
            patch.show_on_internal_transactions ?? entry.show_on_internal_transactions,
        });

        if ("error" in result) {
          toast.error(result.error ?? "Unable to update media.");
          return;
        }

        onChanged();
        router.refresh();
      });
    },
    [itemId, onChanged, router]
  );

  const removeMedia = useCallback(
    (entry: ProductMediaSnapshot) => {
      if (!window.confirm("Delete this image? This cannot be undone.")) return;

      startTransition(async () => {
        const result = await deleteItemMedia(entry.id, entry.storage_url);
        if ("error" in result) {
          toast.error(result.error ?? "Unable to delete media.");
          return;
        }
        toast.success("Image deleted.");
        onChanged();
        router.refresh();
      });
    },
    [onChanged, router]
  );

  return {
    isPending,
    isUploading,
    uploadError,
    uploadScopeKey,
    uploadFile,
    updateMedia,
    removeMedia,
    setUploadError,
  };
}

export function ProductMediaGallery({
  tenantId,
  itemId,
  variants,
  media,
  readOnly = false,
  onChanged,
  layout = "scope-select",
}: Props) {
  const actions = useProductMediaActions({ tenantId, itemId, onChanged });

  if (layout === "variant-stack") {
    return (
      <VariantMediaStack
        variants={variants}
        media={media}
        readOnly={readOnly}
        actions={actions}
      />
    );
  }

  return (
    <ScopeSelectMediaGallery
      variants={variants}
      media={media}
      readOnly={readOnly}
      actions={actions}
    />
  );
}

function ScopeSelectMediaGallery({
  variants,
  media,
  readOnly,
  actions,
}: {
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly: boolean;
  actions: ReturnType<typeof useProductMediaActions>;
}) {
  const [scope, setScope] = useState<MediaScope>("parent");
  const [showAllMedia, setShowAllMedia] = useState(false);
  const { isPending, isUploading, uploadError, uploadScopeKey, uploadFile, updateMedia, removeMedia } =
    actions;

  const scopedMedia = useMemo(
    () => filterMediaForScope(media, scope).sort((a, b) => a.sort_order - b.sort_order),
    [media, scope]
  );

  useEffect(() => {
    setShowAllMedia(false);
  }, [scope]);

  const hiddenMediaCount = Math.max(0, scopedMedia.length - INITIAL_MEDIA_COUNT);
  const visibleMedia = showAllMedia ? scopedMedia : scopedMedia.slice(0, INITIAL_MEDIA_COUNT);
  const variantIdForScope = scope === "parent" ? null : scope;

  const handleUploadInput = (file: File | undefined) => {
    if (file) void uploadFile(file, variantIdForScope, scopedMedia.length, scope);
  };

  return (
    <section className="surface-panel space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Image Management
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload product-level images or variant-specific galleries. Control storefront, catalog,
            and internal document visibility per image.
          </p>
        </div>

        <div className="w-full space-y-1.5 sm:w-64">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Image scope</Label>
            <FieldLabelInfo label="Image scope">
              {fieldHelpText(MEDIA_FIELD_HELP.imageScope)}
            </FieldLabelInfo>
          </div>
          <Select
            value={scope}
            disabled={isPending || isUploading}
            onValueChange={(value) => setScope(value as MediaScope)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="parent">Product (parent)</SelectItem>
              {variants.map((variant) => (
                <SelectItem key={variant.id} value={variant.id}>
                  {variant.is_master ? `Master: ${variant.sku}` : variant.sku}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Viewing images for:{" "}
        <span className="font-medium text-foreground">{scopeLabel(scope, variants)}</span>
      </p>

      <MediaGrid
        entries={visibleMedia.map((entry) => ({ entry, inherited: false }))}
        readOnly={readOnly}
        isPending={isPending}
        isUploading={isUploading && uploadScopeKey === scope}
        showUpload={!readOnly}
        onUploadFile={handleUploadInput}
        onUpdate={updateMedia}
        onRemove={removeMedia}
      />

      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

      {readOnly && scopedMedia.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images uploaded for this scope yet.</p>
      ) : null}

      {hiddenMediaCount > 0 && !showAllMedia ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAllMedia(true)}
        >
          Show {hiddenMediaCount} more
        </Button>
      ) : null}

      {showAllMedia && hiddenMediaCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setShowAllMedia(false)}
        >
          Show less
        </Button>
      ) : null}
    </section>
  );
}

function VariantMediaStack({
  variants,
  media,
  readOnly,
  actions,
}: {
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly: boolean;
  actions: ReturnType<typeof useProductMediaActions>;
}) {
  const masterVariant = useMemo(() => findMasterVariant(variants), [variants]);
  const variantRows = useMemo(() => listMediaVariantRows(variants), [variants]);
  const sharedMedia = useMemo(
    () => filterSharedMedia(media, masterVariant),
    [masterVariant, media]
  );
  const { isPending, isUploading, uploadError, uploadScopeKey, uploadFile, updateMedia, removeMedia } =
    actions;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Variant images
        </h3>
        <p className="text-xs text-muted-foreground">
          Attach images to the master variant to share them across every SKU. Add extra images on a
          variant row for SKU-specific galleries.
        </p>
      </div>

      <div className="space-y-4">
        {variantRows.map((row) => (
          <VariantMediaSection
            key={row.key}
            row={row}
            sharedMedia={sharedMedia}
            variantMedia={
              row.isMaster ? sharedMedia : filterVariantSpecificMedia(media, row.uploadVariantId!)
            }
            readOnly={readOnly}
            isPending={isPending}
            isUploading={isUploading && uploadScopeKey === row.key}
            onUploadFile={(file) =>
              void uploadFile(
                file,
                row.uploadVariantId,
                row.isMaster
                  ? sharedMedia.length
                  : filterVariantSpecificMedia(media, row.uploadVariantId!).length,
                row.key
              )
            }
            onUpdate={updateMedia}
            onRemove={removeMedia}
          />
        ))}
      </div>

      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
    </section>
  );
}

function VariantMediaSection({
  row,
  sharedMedia,
  variantMedia,
  readOnly,
  isPending,
  isUploading,
  onUploadFile,
  onUpdate,
  onRemove,
}: {
  row: MediaVariantRow;
  sharedMedia: ProductMediaSnapshot[];
  variantMedia: ProductMediaSnapshot[];
  readOnly: boolean;
  isPending: boolean;
  isUploading: boolean;
  onUploadFile: (file: File) => void;
  onUpdate: (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => void;
  onRemove: (entry: ProductMediaSnapshot) => void;
}) {
  const entries = useMemo(() => {
    if (row.isMaster) {
      return variantMedia.map((entry) => ({ entry, inherited: false }));
    }

    return [
      ...sharedMedia.map((entry) => ({ entry, inherited: true })),
      ...variantMedia.map((entry) => ({ entry, inherited: false })),
    ];
  }, [row.isMaster, sharedMedia, variantMedia]);

  return (
    <section className="rounded-md border border-border/60 bg-muted/10 px-3 py-3 dark:bg-muted/5">
      <div className="mb-3 space-y-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-medium text-foreground">{row.label}</h4>
          {row.isMaster ? (
            <Badge variant="active" className="text-[10px]">
              All variants
            </Badge>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">{row.subtitle}</p>
      </div>

      {entries.length === 0 && readOnly ? (
        <p className="text-sm text-muted-foreground">No images yet.</p>
      ) : (
        <MediaGrid
          entries={entries}
          readOnly={readOnly}
          isPending={isPending}
          isUploading={isUploading}
          showUpload={!readOnly && row.isMaster}
          onUploadFile={(file) => file && onUploadFile(file)}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      )}

      {!readOnly && !row.isMaster ? (
        <div className="mt-3">
          <MediaUploadTile
            disabled={isPending || isUploading}
            isUploading={isUploading}
            compact
            onUploadFile={(file) => file && onUploadFile(file)}
          />
        </div>
      ) : null}
    </section>
  );
}

type MediaGridEntry = {
  entry: ProductMediaSnapshot;
  inherited: boolean;
};

function MediaGrid({
  entries,
  readOnly,
  isPending,
  isUploading,
  showUpload,
  onUploadFile,
  onUpdate,
  onRemove,
}: {
  entries: MediaGridEntry[];
  readOnly: boolean;
  isPending: boolean;
  isUploading: boolean;
  showUpload: boolean;
  onUploadFile: (file: File | undefined) => void;
  onUpdate: (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => void;
  onRemove: (entry: ProductMediaSnapshot) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
      {entries.map(({ entry, inherited }) => (
        <MediaCard
          key={`${entry.id}-${inherited ? "shared" : "own"}`}
          entry={entry}
          inherited={inherited}
          readOnly={readOnly || inherited}
          isPending={isPending}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}

      {showUpload ? (
        <MediaUploadTile
          disabled={isPending || isUploading}
          isUploading={isUploading}
          onUploadFile={onUploadFile}
        />
      ) : null}
    </div>
  );
}

function MediaCard({
  entry,
  inherited,
  readOnly,
  isPending,
  onUpdate,
  onRemove,
}: {
  entry: ProductMediaSnapshot;
  inherited: boolean;
  readOnly: boolean;
  isPending: boolean;
  onUpdate: (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => void;
  onRemove: (entry: ProductMediaSnapshot) => void;
}) {
  return (
    <article
      className={cn(
        "surface-inset flex min-w-0 flex-col gap-1 overflow-hidden p-1.5",
        inherited && "opacity-90"
      )}
    >
      <div className="relative aspect-square max-h-[5.5rem] overflow-hidden rounded-sm bg-muted/30">
        {entry.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.preview_url} alt="Product media" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            N/A
          </div>
        )}
        {entry.is_primary && !inherited ? (
          <Badge
            className="absolute left-1 top-1 px-1 py-0 text-[9px] leading-tight"
            variant="active"
          >
            Primary
          </Badge>
        ) : null}
        {inherited ? (
          <Badge
            className="absolute right-1 top-1 px-1 py-0 text-[9px] leading-tight"
            variant="administrative"
          >
            Shared
          </Badge>
        ) : null}
      </div>

      {!readOnly ? (
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            size="sm"
            variant={entry.is_primary ? "secondary" : "outline"}
            className="h-6 min-w-0 flex-1 px-1.5 text-[10px]"
            disabled={isPending || entry.is_primary}
            title={entry.is_primary ? "Primary image" : "Set as primary image"}
            onClick={() => onUpdate(entry, { is_primary: true })}
          >
            <Star className="h-3 w-3 shrink-0" />
            <span className="truncate">{entry.is_primary ? "Primary" : "Set"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 w-6 shrink-0 px-0 text-destructive hover:text-destructive"
            title="Delete image"
            disabled={isPending}
            onClick={() => onRemove(entry)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ) : null}

      {!inherited ? (
        <div className="space-y-0">
          <VisibilityRow
            label="Storefront"
            description={MEDIA_FIELD_HELP.storefront}
            checked={entry.show_on_storefront}
            disabled={readOnly || isPending}
            onCheckedChange={(checked) => onUpdate(entry, { show_on_storefront: checked })}
          />
          <VisibilityRow
            label="Catalog"
            description={MEDIA_FIELD_HELP.digitalCatalog}
            checked={entry.show_in_digital_catalog}
            disabled={readOnly || isPending}
            onCheckedChange={(checked) => onUpdate(entry, { show_in_digital_catalog: checked })}
          />
          <VisibilityRow
            label="Internal"
            description={MEDIA_FIELD_HELP.internalDocs}
            checked={entry.show_on_internal_transactions}
            disabled={readOnly || isPending}
            onCheckedChange={(checked) =>
              onUpdate(entry, { show_on_internal_transactions: checked })
            }
          />
        </div>
      ) : null}
    </article>
  );
}

function MediaUploadTile({
  disabled,
  isUploading,
  compact = false,
  onUploadFile,
}: {
  disabled: boolean;
  isUploading: boolean;
  compact?: boolean;
  onUploadFile: (file: File | undefined) => void;
}) {
  return (
    <article
      className={cn(
        "surface-inset flex min-w-0 flex-col gap-1 overflow-hidden p-1.5",
        compact && "max-w-[7rem]"
      )}
    >
      <label
        className={cn(
          "relative flex aspect-square max-h-[5.5rem] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-border bg-muted/20 px-1 text-center transition-colors",
          !disabled && "hover:border-primary/40 hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-50"
        )}
        title="JPEG, PNG, or WebP up to 5MB"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled) return;
          onUploadFile(event.dataTransfer.files?.[0]);
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            onUploadFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        {isUploading ? (
          <p className="text-[11px] text-muted-foreground">Uploading…</p>
        ) : (
          <>
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">Add</span>
          </>
        )}
      </label>
      {!compact ? (
        <p className="text-center text-[9px] leading-tight text-muted-foreground">Upload</p>
      ) : null}
    </article>
  );
}

function VisibilityRow({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-1 py-px">
      <div className="flex min-w-0 items-center gap-0.5">
        <p className="truncate text-[10px] font-medium leading-none text-muted-foreground">
          {label}
        </p>
        <FieldLabelInfo label={label}>{fieldHelpText(description)}</FieldLabelInfo>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3"
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
