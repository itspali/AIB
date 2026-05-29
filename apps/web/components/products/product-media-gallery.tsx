"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { deleteItemMedia, saveItemMedia } from "@/app/items/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import type { ProductMediaSnapshot, ProductVariantSnapshot } from "@/lib/products/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type MediaScope = "parent" | string;

type Props = {
  tenantId: string;
  itemId: string;
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly?: boolean;
  onChanged: () => void;
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

export function ProductMediaGallery({
  tenantId,
  itemId,
  variants,
  media,
  readOnly = false,
  onChanged,
}: Props) {
  const router = useRouter();
  const [scope, setScope] = useState<MediaScope>("parent");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showAllMedia, setShowAllMedia] = useState(false);
  const [isPending, startTransition] = useTransition();

  const scopedMedia = useMemo(
    () => filterMediaForScope(media, scope).sort((a, b) => a.sort_order - b.sort_order),
    [media, scope]
  );

  useEffect(() => {
    setShowAllMedia(false);
  }, [scope]);

  const hiddenMediaCount = Math.max(0, scopedMedia.length - INITIAL_MEDIA_COUNT);
  const visibleMedia = showAllMedia
    ? scopedMedia
    : scopedMedia.slice(0, INITIAL_MEDIA_COUNT);

  const variantIdForScope = scope === "parent" ? null : scope;

  const uploadFile = useCallback(
    async (file: File) => {
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
        variantIdForScope
      );

      setIsUploading(true);
      const supabase = createClient();

      const { error: uploadErrorResult } = await supabase.storage
        .from(PRODUCT_MEDIA_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type });

      setIsUploading(false);

      if (uploadErrorResult) {
        setUploadError(uploadErrorResult.message);
        return;
      }

      startTransition(async () => {
        const result = await saveItemMedia({
          media_id: null,
          item_id: itemId,
          variant_id: variantIdForScope,
          storage_url: path,
          sort_order: scopedMedia.length,
          is_primary: scopedMedia.length === 0,
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
    [tenantId, itemId, variantIdForScope, scopedMedia.length, onChanged, router]
  );

  const updateMedia = (entry: ProductMediaSnapshot, patch: Partial<ProductMediaSnapshot>) => {
    startTransition(async () => {
      const result = await saveItemMedia({
        media_id: entry.id,
        item_id: itemId,
        variant_id: entry.variant_id,
        storage_url: entry.storage_url,
        sort_order: patch.sort_order ?? entry.sort_order,
        is_primary: patch.is_primary ?? entry.is_primary,
        show_on_storefront: patch.show_on_storefront ?? entry.show_on_storefront,
        show_in_digital_catalog: patch.show_in_digital_catalog ?? entry.show_in_digital_catalog,
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
  };

  const removeMedia = (entry: ProductMediaSnapshot) => {
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
  };

  const handleUploadInput = (file: File | undefined) => {
    if (file) void uploadFile(file);
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

        <div className="w-full sm:w-64">
          <Label className="text-xs text-muted-foreground">Image scope</Label>
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
        Viewing images for: <span className="font-medium text-foreground">{scopeLabel(scope, variants)}</span>
      </p>

      {readOnly && scopedMedia.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images uploaded for this scope yet.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3">
            {visibleMedia.map((entry) => (
              <article key={entry.id} className="surface-inset flex min-w-0 flex-col gap-2 overflow-hidden p-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted/30">
                  {entry.preview_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={entry.preview_url}
                      alt="Product media"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      N/A
                    </div>
                  )}
                  {entry.is_primary && (
                    <Badge className="absolute left-1.5 top-1.5 px-1.5 py-0 text-[10px]" variant="active">
                      Primary
                    </Badge>
                  )}
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={entry.is_primary ? "secondary" : "outline"}
                      className="h-7 min-w-0 flex-1 px-2 text-[11px]"
                      disabled={isPending || entry.is_primary}
                      title={entry.is_primary ? "Primary image" : "Set as primary image"}
                      onClick={() => updateMedia(entry, { is_primary: true })}
                    >
                      <Star className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{entry.is_primary ? "Primary" : "Set primary"}</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 shrink-0 px-0 text-destructive hover:text-destructive"
                      title="Delete image"
                      disabled={isPending}
                      onClick={() => removeMedia(entry)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <div className="space-y-1">
                  <VisibilityRow
                    label="Storefront"
                    description="Show on B2C/B2B storefront renderers"
                    checked={entry.show_on_storefront}
                    disabled={readOnly || isPending}
                    onCheckedChange={(checked) =>
                      updateMedia(entry, { show_on_storefront: checked })
                    }
                  />
                  <VisibilityRow
                    label="Digital catalog"
                    description="Include in PDF/email catalog exports"
                    checked={entry.show_in_digital_catalog}
                    disabled={readOnly || isPending}
                    onCheckedChange={(checked) =>
                      updateMedia(entry, { show_in_digital_catalog: checked })
                    }
                  />
                  <VisibilityRow
                    label="Internal documents"
                    description="Show on PO/SO print layouts"
                    checked={entry.show_on_internal_transactions}
                    disabled={readOnly || isPending}
                    onCheckedChange={(checked) =>
                      updateMedia(entry, { show_on_internal_transactions: checked })
                    }
                  />
                </div>
              </article>
            ))}

            {!readOnly && (
              <MediaUploadTile
                disabled={isPending || isUploading}
                isUploading={isUploading}
                onUploadFile={handleUploadInput}
              />
            )}
          </div>

          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

          {hiddenMediaCount > 0 && !showAllMedia && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowAllMedia(true)}
            >
              Show {hiddenMediaCount} more
            </Button>
          )}

          {showAllMedia && hiddenMediaCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setShowAllMedia(false)}
            >
              Show less
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function MediaUploadTile({
  disabled,
  isUploading,
  onUploadFile,
}: {
  disabled: boolean;
  isUploading: boolean;
  onUploadFile: (file: File | undefined) => void;
}) {
  return (
    <article className="surface-inset flex min-w-0 flex-col gap-2 overflow-hidden p-2">
      <label
        className={cn(
          "relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/20 px-2 text-center transition-colors",
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
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Add image</span>
          </>
        )}
      </label>
      <p className="text-center text-[10px] leading-tight text-muted-foreground">
        Drop or browse
      </p>
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
    <div
      className="flex items-center justify-between gap-2 rounded-sm px-0.5 py-0.5"
      title={description}
    >
      <p className="truncate text-xs font-medium leading-none">{label}</p>
      <Switch
        checked={checked}
        disabled={disabled}
        className="scale-90"
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
