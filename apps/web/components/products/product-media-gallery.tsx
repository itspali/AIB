"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Share2, Star, Trash2, Upload } from "lucide-react";
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
  getProductMediaSignedUrl,
  PRODUCT_MEDIA_BUCKET,
} from "@/lib/products/media";
import {
  filterSharedMedia,
  filterVariantSpecificMedia,
  findMasterVariant,
  listMediaVariantRows,
  formatMediaSkuBadgeLabel,
  resolveMediaVariantSkuBadge,
  type MediaVariantRow,
} from "@/lib/products/media-variants";
import {
  resolveEffectivePrimaryMediaId,
  type EffectivePrimaryMediaContext,
} from "@/lib/products/primary-image";
import type { ProductMediaSnapshot, ProductVariantSnapshot } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ProductMediaGalleryLayout = "scope-select" | "variant-stack" | "variant-rows";
export type ProductMediaGalleryDensity = "default" | "compact";

type MediaScope = "parent" | string;

type Props = {
  tenantId: string;
  itemId: string;
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly?: boolean;
  onChanged: () => void;
  layout?: ProductMediaGalleryLayout;
  density?: ProductMediaGalleryDensity;
  /** When set, shows one variant row (shared + variant-owned) for variant edit flows. */
  focusedVariantId?: string | null;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const INITIAL_MEDIA_COUNT = 2;
const THUMB_HOVER_SCALE = 2.5;

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
  media,
  onChanged,
  onMediaCreated,
}: {
  tenantId: string;
  itemId: string;
  media: ProductMediaSnapshot[];
  onChanged: () => void;
  onMediaCreated?: (entry: ProductMediaSnapshot) => void;
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

      const localPreviewUrl = URL.createObjectURL(file);

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
          URL.revokeObjectURL(localPreviewUrl);
          await supabase.storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
          toast.error(result.error ?? "Unable to save media record.");
          return;
        }

        const signedPreviewUrl = await getProductMediaSignedUrl(supabase, path);
        onMediaCreated?.({
          id: result.mediaId,
          item_id: itemId,
          variant_id: variantId,
          storage_url: path,
          preview_url: signedPreviewUrl ?? localPreviewUrl,
          sort_order: existingCount,
          is_primary: existingCount === 0,
          show_on_storefront: true,
          show_in_digital_catalog: true,
          show_on_internal_transactions: false,
          created_at: new Date().toISOString(),
        });

        toast.success("Image uploaded.");
        onChanged();
        router.refresh();
      });
    },
    [itemId, onChanged, onMediaCreated, router, tenantId]
  );

  const uploadFiles = useCallback(
    async (
      files: File[],
      variantId: string | null,
      existingCount: number,
      scopeKey: string
    ) => {
      const valid = files.filter((file) => ALLOWED_TYPES.has(file.type) && file.size <= MAX_BYTES);
      if (valid.length === 0) {
        setUploadError("Use JPEG, PNG, or WebP images up to 5MB each.");
        return;
      }
      if (valid.length < files.length) {
        setUploadError("Some files were skipped — only JPEG, PNG, or WebP up to 5MB each.");
      }
      let sortOrder = existingCount;
      for (const file of valid) {
        await uploadFile(file, variantId, sortOrder, scopeKey);
        sortOrder += 1;
      }
    },
    [uploadFile]
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

  const setScopePrimary = useCallback(
    (entry: ProductMediaSnapshot, scopeVariantId: string | null) => {
      const scopeId = scopeVariantId?.trim() || null;
      const entryVariantId = entry.variant_id?.trim() || null;

      const savePrimary = (target: ProductMediaSnapshot) => {
        startTransition(async () => {
          const result = await saveItemMedia({
            media_id: target.id,
            item_id: itemId,
            variant_id: target.variant_id,
            storage_url: target.storage_url,
            sort_order: target.sort_order,
            is_primary: true,
            show_on_storefront: target.show_on_storefront,
            show_in_digital_catalog: target.show_in_digital_catalog,
            show_on_internal_transactions: target.show_on_internal_transactions,
          });

          if ("error" in result) {
            toast.error(result.error ?? "Unable to set primary image.");
            return;
          }

          toast.success("Primary image updated.");
          onChanged();
          router.refresh();
        });
      };

      if (entryVariantId === scopeId) {
        savePrimary(entry);
        return;
      }

      if (!scopeId) {
        savePrimary(entry);
        return;
      }

      const existingVariantLink = media.find(
        (candidate) =>
          candidate.variant_id === scopeId && candidate.storage_url === entry.storage_url
      );
      if (existingVariantLink) {
        savePrimary(existingVariantLink);
        return;
      }

      const variantMediaCount = media.filter((candidate) => candidate.variant_id === scopeId).length;
      startTransition(async () => {
        const result = await saveItemMedia({
          media_id: null,
          item_id: itemId,
          variant_id: scopeId,
          storage_url: entry.storage_url,
          sort_order: variantMediaCount,
          is_primary: true,
          show_on_storefront: entry.show_on_storefront,
          show_in_digital_catalog: entry.show_in_digital_catalog,
          show_on_internal_transactions: entry.show_on_internal_transactions,
        });

        if ("error" in result) {
          toast.error(result.error ?? "Unable to set variant primary image.");
          return;
        }

        toast.success("Variant primary image updated.");
        onChanged();
        router.refresh();
      });
    },
    [itemId, media, onChanged, router]
  );

  return {
    isPending,
    isUploading,
    uploadError,
    uploadScopeKey,
    uploadFile,
    uploadFiles,
    updateMedia,
    removeMedia,
    setScopePrimary,
    setUploadError,
  };
}

function mergeDisplayMedia(
  media: ProductMediaSnapshot[],
  pendingMedia: ProductMediaSnapshot[]
): ProductMediaSnapshot[] {
  if (!pendingMedia.length) return media;
  const byId = new Map(media.map((entry) => [entry.id, entry]));
  for (const entry of pendingMedia) {
    if (!byId.has(entry.id)) {
      byId.set(entry.id, entry);
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.created_at.localeCompare(b.created_at);
  });
}

export function ProductMediaGallery({
  tenantId,
  itemId,
  variants,
  media,
  readOnly = false,
  onChanged,
  layout = "scope-select",
  density = "default",
  focusedVariantId = null,
}: Props) {
  const [pendingMedia, setPendingMedia] = useState<ProductMediaSnapshot[]>([]);

  useEffect(() => {
    setPendingMedia((pending) =>
      pending.filter(
        (entry) =>
          !media.some(
            (serverEntry) =>
              serverEntry.id === entry.id ||
              serverEntry.storage_url === entry.storage_url
          )
      )
    );
  }, [media]);

  const displayMedia = useMemo(
    () => mergeDisplayMedia(media, pendingMedia),
    [media, pendingMedia]
  );

  const handleMediaCreated = useCallback(
    (entry: ProductMediaSnapshot) => setPendingMedia((current) => [...current, entry]),
    []
  );

  const actions = useProductMediaActions({
    tenantId,
    itemId,
    media: displayMedia,
    onChanged,
    onMediaCreated: handleMediaCreated,
  });

  if (focusedVariantId) {
    return (
      <FocusedVariantMediaGallery
        focusedVariantId={focusedVariantId}
        variants={variants}
        media={displayMedia}
        readOnly={readOnly}
        actions={actions}
      />
    );
  }

  if (layout === "variant-stack") {
    return (
      <VariantMediaStack
        variants={variants}
        media={displayMedia}
        readOnly={readOnly}
        density={density}
        actions={actions}
      />
    );
  }

  if (layout === "variant-rows") {
    return (
      <VariantMediaRows
        variants={variants}
        media={displayMedia}
        readOnly={readOnly}
        actions={actions}
      />
    );
  }

  return (
    <ScopeSelectMediaGallery
      variants={variants}
      media={displayMedia}
      readOnly={readOnly}
      density={density}
      actions={actions}
    />
  );
}

function ScopeSelectMediaGallery({
  variants,
  media,
  readOnly,
  density = "default",
  actions,
}: {
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly: boolean;
  density?: ProductMediaGalleryDensity;
  actions: ReturnType<typeof useProductMediaActions>;
}) {
  const compact = density === "compact";
  const [scope, setScope] = useState<MediaScope>("parent");
  const [showAllMedia, setShowAllMedia] = useState(false);
  const {
    isPending,
    isUploading,
    uploadError,
    uploadScopeKey,
    uploadFiles,
    updateMedia,
    removeMedia,
    setScopePrimary,
  } = actions;

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
  const masterVariant = useMemo(() => findMasterVariant(variants), [variants]);
  const primaryContext = useMemo((): EffectivePrimaryMediaContext => {
    if (scope === "parent") {
      return { masterVariantId: masterVariant?.id ?? null };
    }
    return { variantId: scope, masterVariantId: masterVariant?.id ?? null };
  }, [masterVariant?.id, scope]);

  const handleUploadInput = (files: FileList | File[] | undefined) => {
    if (!files?.length) return;
    void uploadFiles(Array.from(files), variantIdForScope, scopedMedia.length, scope);
  };

  return (
    <section className={cn(compact ? "space-y-2" : "surface-panel space-y-4")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!compact ? (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Image Management
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload product-level images or variant-specific galleries. Control storefront, catalog,
              and internal document visibility per image.
            </p>
          </div>
        ) : null}

        <div className={cn("w-full space-y-1", compact ? "sm:w-56" : "sm:w-64")}>
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
        entries={visibleMedia.map((entry) =>
          toMediaGridEntry(entry, variants, { masterVariant })
        )}
        primaryContext={primaryContext}
        readOnly={readOnly}
        isPending={isPending}
        isUploading={isUploading && uploadScopeKey === scope}
        showUpload={!readOnly}
        compact={compact}
        onUploadFiles={handleUploadInput}
        onUpdate={updateMedia}
        onRemove={removeMedia}
        onSetScopePrimary={setScopePrimary}
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

function FocusedVariantMediaGallery({
  focusedVariantId,
  variants,
  media,
  readOnly,
  actions,
}: {
  focusedVariantId: string;
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly: boolean;
  actions: ReturnType<typeof useProductMediaActions>;
}) {
  const masterVariant = useMemo(() => findMasterVariant(variants), [variants]);
  const row = useMemo(() => {
    const rows = listMediaVariantRows(variants);
    return (
      rows.find((entry) => entry.uploadVariantId === focusedVariantId) ??
      rows.find((entry) => entry.key === focusedVariantId) ??
      null
    );
  }, [focusedVariantId, variants]);
  const sharedMedia = useMemo(
    () => filterSharedMedia(media, masterVariant),
    [masterVariant, media]
  );
  const {
    isPending,
    isUploading,
    uploadError,
    uploadScopeKey,
    uploadFiles,
    updateMedia,
    removeMedia,
    setScopePrimary,
  } = actions;

  if (!row) return null;

  const variantMedia = row.isMaster
    ? sharedMedia
    : filterVariantSpecificMedia(media, row.uploadVariantId!);

  return (
    <section className="space-y-3">
      <VariantMediaSection
        row={row}
        variants={variants}
        masterVariant={masterVariant}
        sharedMedia={sharedMedia}
        variantMedia={variantMedia}
        readOnly={readOnly}
        isPending={isPending}
        isUploading={isUploading && uploadScopeKey === row.key}
        onUploadFiles={(files) =>
          void uploadFiles(
            Array.from(files ?? []),
            row.uploadVariantId,
            row.isMaster
              ? sharedMedia.length
              : filterVariantSpecificMedia(media, row.uploadVariantId!).length,
            row.key
          )
        }
        onUpdate={updateMedia}
        onRemove={removeMedia}
        onSetScopePrimary={setScopePrimary}
      />
      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
    </section>
  );
}

function VariantMediaRows({
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
  const {
    isPending,
    isUploading,
    uploadError,
    uploadScopeKey,
    uploadFiles,
    updateMedia,
    removeMedia,
    setScopePrimary,
  } = actions;

  return (
    <section className="divide-y divide-border/60">
      {variantRows.map((row) => {
        const variantMedia = row.isMaster
          ? sharedMedia
          : filterVariantSpecificMedia(media, row.uploadVariantId!);
        const entries = row.isMaster
          ? variantMedia.map((entry) =>
              toMediaGridEntry(entry, variants, { masterVariant, inherited: false })
            )
          : [
              ...sharedMedia.map((entry) =>
                toMediaGridEntry(entry, variants, { masterVariant, inherited: true })
              ),
              ...variantMedia.map((entry) =>
                toMediaGridEntry(entry, variants, { masterVariant, inherited: false })
              ),
            ];
        const primaryContext: EffectivePrimaryMediaContext = row.isMaster
          ? { masterVariantId: masterVariant?.id ?? null, variantId: row.uploadVariantId }
          : { variantId: row.uploadVariantId, masterVariantId: masterVariant?.id ?? null };

        return (
          <div
            key={row.key}
            className="grid grid-cols-[minmax(6.5rem,10rem)_minmax(0,1fr)] items-start gap-x-3 py-1.5 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 pt-0.5">
              <p
                className="break-all text-[11px] font-medium leading-snug text-foreground"
                title={row.label}
              >
                {row.label}
              </p>
              {row.isMaster ? (
                <Badge variant="active" className="mt-0.5 text-[9px]">
                  Shared
                </Badge>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {entries.length === 0 && readOnly ? (
                <p className="text-xs text-muted-foreground">No images</p>
              ) : (
                <MediaGrid
                  entries={entries}
                  primaryContext={primaryContext}
                  readOnly={readOnly}
                  isPending={isPending}
                  isUploading={isUploading && uploadScopeKey === row.key}
                  showUpload={!readOnly}
                  compact
                  onUploadFiles={(files) =>
                    void uploadFiles(
                      Array.from(files ?? []),
                      row.uploadVariantId,
                      row.isMaster
                        ? sharedMedia.length
                        : filterVariantSpecificMedia(media, row.uploadVariantId!).length,
                      row.key
                    )
                  }
                  onUpdate={updateMedia}
                  onRemove={removeMedia}
                  onSetScopePrimary={setScopePrimary}
                />
              )}
            </div>
          </div>
        );
      })}
      {uploadError ? <p className="pt-1 text-xs text-destructive">{uploadError}</p> : null}
    </section>
  );
}

function VariantMediaStack({
  variants,
  media,
  readOnly,
  density = "default",
  actions,
}: {
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly: boolean;
  density?: ProductMediaGalleryDensity;
  actions: ReturnType<typeof useProductMediaActions>;
}) {
  const masterVariant = useMemo(() => findMasterVariant(variants), [variants]);
  const variantRows = useMemo(() => listMediaVariantRows(variants), [variants]);
  const sharedMedia = useMemo(
    () => filterSharedMedia(media, masterVariant),
    [masterVariant, media]
  );
  const {
    isPending,
    isUploading,
    uploadError,
    uploadScopeKey,
    uploadFiles,
    updateMedia,
    removeMedia,
    setScopePrimary,
  } = actions;

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
            variants={variants}
            masterVariant={masterVariant}
            sharedMedia={sharedMedia}
            variantMedia={
              row.isMaster ? sharedMedia : filterVariantSpecificMedia(media, row.uploadVariantId!)
            }
            readOnly={readOnly}
            isPending={isPending}
            isUploading={isUploading && uploadScopeKey === row.key}
            onUploadFiles={(files) =>
              void uploadFiles(
                Array.from(files ?? []),
                row.uploadVariantId,
                row.isMaster
                  ? sharedMedia.length
                  : filterVariantSpecificMedia(media, row.uploadVariantId!).length,
                row.key
              )
            }
            onUpdate={updateMedia}
            onRemove={removeMedia}
            onSetScopePrimary={setScopePrimary}
          />
        ))}
      </div>

      {uploadError ? <p className="text-xs text-destructive">{uploadError}</p> : null}
    </section>
  );
}

function VariantMediaSection({
  row,
  variants,
  masterVariant,
  sharedMedia,
  variantMedia,
  readOnly,
  isPending,
  isUploading,
  onUploadFiles,
  onUpdate,
  onRemove,
  onSetScopePrimary,
}: {
  row: MediaVariantRow;
  variants: ProductVariantSnapshot[];
  masterVariant: ProductVariantSnapshot | null;
  sharedMedia: ProductMediaSnapshot[];
  variantMedia: ProductMediaSnapshot[];
  readOnly: boolean;
  isPending: boolean;
  isUploading: boolean;
  onUploadFiles: (files: FileList | File[] | undefined) => void;
  onUpdate: (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => void;
  onRemove: (entry: ProductMediaSnapshot) => void;
  onSetScopePrimary: (entry: ProductMediaSnapshot, scopeVariantId: string | null) => void;
}) {
  const entries = useMemo(() => {
    if (row.isMaster) {
      return variantMedia.map((entry) =>
        toMediaGridEntry(entry, variants, { masterVariant, inherited: false })
      );
    }

    return [
      ...sharedMedia.map((entry) =>
        toMediaGridEntry(entry, variants, { masterVariant, inherited: true })
      ),
      ...variantMedia.map((entry) =>
        toMediaGridEntry(entry, variants, { masterVariant, inherited: false })
      ),
    ];
  }, [masterVariant, row.isMaster, sharedMedia, variantMedia, variants]);

  const primaryContext = useMemo((): EffectivePrimaryMediaContext => {
    const masterVariantId = masterVariant?.id ?? null;
    if (row.isMaster) {
      return { masterVariantId, variantId: row.uploadVariantId };
    }
    return { variantId: row.uploadVariantId, masterVariantId };
  }, [masterVariant?.id, row.isMaster, row.uploadVariantId]);

  return (
    <section className="rounded-md border border-border/60 bg-muted/20 px-3 py-3 dark:bg-muted/5">
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
          primaryContext={primaryContext}
          readOnly={readOnly}
          isPending={isPending}
          isUploading={isUploading}
          showUpload={!readOnly && row.isMaster}
          onUploadFiles={onUploadFiles}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSetScopePrimary={onSetScopePrimary}
        />
      )}

      {!readOnly && !row.isMaster ? (
        <div className="mt-3">
          <MediaUploadTile
            disabled={isPending || isUploading}
            isUploading={isUploading}
            compact
            onUploadFiles={onUploadFiles}
          />
        </div>
      ) : null}
    </section>
  );
}

type MediaGridEntry = {
  entry: ProductMediaSnapshot;
  inherited: boolean;
  variantSku?: string | null;
};

function toMediaGridEntry(
  entry: ProductMediaSnapshot,
  variants: ProductVariantSnapshot[],
  options?: { inherited?: boolean; masterVariant?: ProductVariantSnapshot | null }
): MediaGridEntry {
  const inherited = options?.inherited ?? false;
  const masterVariant = options?.masterVariant ?? findMasterVariant(variants);
  return {
    entry,
    inherited,
    variantSku: inherited
      ? null
      : resolveMediaVariantSkuBadge(entry.variant_id, variants, masterVariant),
  };
}

function MediaStatusIcons({
  isPrimary,
  inherited,
  variantSku,
}: {
  isPrimary?: boolean;
  inherited?: boolean;
  variantSku?: string | null;
}) {
  const skuLabel = variantSku ? formatMediaSkuBadgeLabel(variantSku) : null;

  return (
    <>
      {isPrimary ? (
        <Star
          className="absolute left-0.5 top-0.5 h-3 w-3 fill-amber-400 text-amber-500 drop-shadow-sm"
          aria-label="Primary image"
        />
      ) : null}
      {inherited ? (
        <Share2
          className="absolute right-0.5 top-0.5 h-3 w-3 text-muted-foreground drop-shadow-sm"
          aria-label="Shared from master"
        />
      ) : null}
      {skuLabel ? (
        <span
          className="absolute bottom-0 left-0 right-0 truncate bg-background/85 px-0.5 text-center font-mono text-[8px] leading-tight text-foreground"
          title={variantSku ?? undefined}
        >
          {skuLabel}
        </span>
      ) : null}
    </>
  );
}

function MediaThumbnailFrame({
  previewUrl,
  isPrimary,
  inherited,
  variantSku,
  className,
  rounded = "sm",
  alt = "Product media",
}: {
  previewUrl?: string | null;
  isPrimary?: boolean;
  inherited?: boolean;
  variantSku?: string | null;
  className?: string;
  rounded?: "sm" | "md";
  alt?: string;
}) {
  const roundedClass = rounded === "md" ? "rounded-md" : "rounded-sm";

  return (
    <div
      className={cn(
        "group/thumb relative z-0 aspect-square w-full cursor-zoom-in hover:z-50",
        className
      )}
    >
      <div className="absolute inset-0 overflow-visible">
        <div
          className={cn(
            "relative h-full w-full origin-center bg-muted/30 transition-[transform,box-shadow] duration-200 ease-out",
            `group-hover/thumb:scale-[${THUMB_HOVER_SCALE}]`,
            "group-hover/thumb:bg-white group-hover/thumb:shadow-xl",
            "group-hover/thumb:ring-1 group-hover/thumb:ring-border/60",
            roundedClass,
            inherited && "ring-1 ring-border/60"
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={alt} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              N/A
            </div>
          )}
        </div>
      </div>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-10 transition-opacity duration-200",
          "[@media(hover:hover)]:group-hover/thumb:opacity-0"
        )}
      >
        <MediaStatusIcons
          isPrimary={isPrimary}
          inherited={inherited}
          variantSku={variantSku}
        />
      </div>
    </div>
  );
}

function MediaGrid({
  entries,
  primaryContext,
  readOnly,
  isPending,
  isUploading,
  showUpload,
  compact = false,
  onUploadFiles,
  onUpdate,
  onRemove,
  onSetScopePrimary,
}: {
  entries: MediaGridEntry[];
  primaryContext?: EffectivePrimaryMediaContext;
  readOnly: boolean;
  isPending: boolean;
  isUploading: boolean;
  showUpload: boolean;
  compact?: boolean;
  onUploadFiles: (files: FileList | File[] | undefined) => void;
  onUpdate: (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => void;
  onRemove: (entry: ProductMediaSnapshot) => void;
  onSetScopePrimary: (entry: ProductMediaSnapshot, scopeVariantId: string | null) => void;
}) {
  const effectivePrimaryId = useMemo(
    () => resolveEffectivePrimaryMediaId(entries.map(({ entry }) => entry), primaryContext),
    [entries, primaryContext]
  );
  const scopeVariantId = primaryContext?.variantId?.trim() || null;

  const thumbClass = compact ? "h-10 w-10" : "h-14 w-14";

  return (
    <div className={cn(compact ? "flex flex-wrap gap-1.5" : "flex flex-wrap gap-2")}>
      {entries.map(({ entry, inherited, variantSku }) => (
        <MediaThumbWithMenu
          key={`${entry.id}-${inherited ? "shared" : "own"}`}
          entry={entry}
          inherited={inherited}
          variantSku={variantSku}
          isEffectivePrimary={entry.id === effectivePrimaryId}
          scopeVariantId={scopeVariantId}
          readOnly={readOnly}
          isPending={isPending}
          thumbClass={thumbClass}
          onUpdate={onUpdate}
          onRemove={onRemove}
          onSetScopePrimary={onSetScopePrimary}
        />
      ))}
      {showUpload ? (
        <MediaUploadTile
          disabled={isPending || isUploading}
          isUploading={isUploading}
          compact
          onUploadFiles={onUploadFiles}
        />
      ) : null}
    </div>
  );
}

function MediaThumbWithMenu({
  entry,
  inherited,
  variantSku,
  isEffectivePrimary,
  scopeVariantId,
  readOnly,
  isPending,
  thumbClass,
  onUpdate,
  onRemove,
  onSetScopePrimary,
}: {
  entry: ProductMediaSnapshot;
  inherited: boolean;
  variantSku?: string | null;
  isEffectivePrimary: boolean;
  scopeVariantId: string | null;
  readOnly: boolean;
  isPending: boolean;
  thumbClass: string;
  onUpdate: (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => void;
  onRemove: (entry: ProductMediaSnapshot) => void;
  onSetScopePrimary: (entry: ProductMediaSnapshot, scopeVariantId: string | null) => void;
}) {
  const canEditOwned = !readOnly && !inherited;
  const canSetPrimary = !readOnly && !isEffectivePrimary;
  const primaryLabel = scopeVariantId
    ? inherited
      ? "Use as variant primary"
      : "Set variant primary"
    : "Set as primary";

  return (
    <article
      className={cn(
        "group/media relative shrink-0 rounded-sm border border-border/50 bg-card/40",
        inherited && "opacity-90"
      )}
    >
      <div className={cn("relative overflow-hidden rounded-sm", thumbClass)}>
        {entry.preview_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.preview_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            N/A
          </div>
        )}
        <MediaStatusIcons
          isPrimary={isEffectivePrimary}
          inherited={inherited}
          variantSku={variantSku}
        />
        {!readOnly ? (
          <MoreVertical
            className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 text-foreground/80 opacity-0 transition-opacity group-hover/media:opacity-100"
            aria-hidden
          />
        ) : null}
      </div>

      {!readOnly ? (
        <div className="pointer-events-none absolute left-0 top-full z-50 mt-0.5 hidden min-w-[10.5rem] flex-col gap-0.5 rounded-md border border-border bg-popover p-1 text-xs shadow-md group-hover/media:pointer-events-auto group-hover/media:flex">
          {canSetPrimary ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted"
              disabled={isPending}
              onClick={() => onSetScopePrimary(entry, scopeVariantId)}
            >
              <Star className="h-3.5 w-3.5 shrink-0" />
              {primaryLabel}
            </button>
          ) : null}
          {canEditOwned ? (
            <>
              <label className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                <span>Storefront</span>
                <Switch
                  checked={entry.show_on_storefront}
                  disabled={isPending}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3"
                  onCheckedChange={(checked) => onUpdate(entry, { show_on_storefront: checked })}
                />
              </label>
              <label className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                <span>Catalog</span>
                <Switch
                  checked={entry.show_in_digital_catalog}
                  disabled={isPending}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3"
                  onCheckedChange={(checked) =>
                    onUpdate(entry, { show_in_digital_catalog: checked })
                  }
                />
              </label>
              <label className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 hover:bg-muted">
                <span>Internal</span>
                <Switch
                  checked={entry.show_on_internal_transactions}
                  disabled={isPending}
                  className="h-4 w-7 shrink-0 [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-3"
                  onCheckedChange={(checked) =>
                    onUpdate(entry, { show_on_internal_transactions: checked })
                  }
                />
              </label>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                disabled={isPending}
                onClick={() => onRemove(entry)}
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function MediaUploadTile({
  disabled,
  isUploading,
  compact = false,
  onUploadFiles,
}: {
  disabled: boolean;
  isUploading: boolean;
  compact?: boolean;
  onUploadFiles: (files: FileList | File[] | undefined) => void;
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
          "relative flex aspect-square h-10 w-10 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-border bg-muted/20 px-1 text-center transition-colors",
          !disabled && "hover:border-primary/40 hover:bg-muted/30",
          disabled && "cursor-not-allowed opacity-50"
        )}
        title="JPEG, PNG, or WebP up to 5MB each — select multiple"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled) return;
          onUploadFiles(event.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            onUploadFiles(event.target.files ?? undefined);
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

const SUMMARY_INITIAL_COUNT = 8;

export function ProductMediaSummaryGallery({
  entries,
  effectivePrimaryId,
  maxVisible = SUMMARY_INITIAL_COUNT,
  className,
}: {
  entries: MediaGridEntry[];
  effectivePrimaryId?: string | null;
  maxVisible?: number;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = Math.max(0, entries.length - maxVisible);
  const visibleEntries = showAll ? entries : entries.slice(0, maxVisible);
  const resolvedPrimaryId =
    effectivePrimaryId ??
    resolveEffectivePrimaryMediaId(entries.map(({ entry }) => entry));

  if (!entries.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
        {visibleEntries.map(({ entry, inherited, variantSku }) => (
          <MediaThumbnailFrame
            key={`${entry.id}-${inherited ? "shared" : "own"}`}
            previewUrl={entry.preview_url}
            isPrimary={entry.id === resolvedPrimaryId}
            inherited={inherited}
            variantSku={variantSku}
            alt=""
            rounded="md"
            className="surface-inset"
          />
        ))}
      </div>
      {hiddenCount > 0 && !showAll ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more
        </Button>
      ) : null}
      {showAll && hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => setShowAll(false)}
        >
          Show less
        </Button>
      ) : null}
    </div>
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
