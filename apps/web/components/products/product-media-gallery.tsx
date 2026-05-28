"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

  const scopedMedia = useMemo(
    () => filterMediaForScope(media, scope).sort((a, b) => a.sort_order - b.sort_order),
    [media, scope]
  );

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

      {!readOnly && (
        <div
          className={cn(
            "surface-inset flex flex-col items-center justify-center gap-3 border-dashed px-4 py-6 text-center transition-colors duration-200",
            !isUploading && !isPending && "hover:border-primary/40 hover:bg-muted/30",
            (isUploading || isPending) && "opacity-50"
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (readOnly || isUploading || isPending) return;
            const file = event.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drag and drop product images</p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP up to 5MB</p>
          </div>
          <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
            Browse files
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={readOnly || isUploading || isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>
          {isUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
          {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </div>
      )}

      {scopedMedia.length === 0 ? (
        <p className="text-sm text-muted-foreground">No images uploaded for this scope yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {scopedMedia.map((entry) => (
            <article key={entry.id} className="surface-inset overflow-hidden">
              <div className="relative aspect-[4/3] bg-muted/30">
                {entry.preview_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.preview_url}
                    alt="Product media"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Preview unavailable
                  </div>
                )}
                {entry.is_primary && (
                  <Badge className="absolute left-2 top-2" variant="active">
                    Primary
                  </Badge>
                )}
              </div>

              <div className="space-y-3 p-4">
                {!readOnly && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={entry.is_primary ? "default" : "outline"}
                      disabled={isPending || entry.is_primary}
                      onClick={() => updateMedia(entry, { is_primary: true })}
                    >
                      <Star className="h-4 w-4" />
                      Set primary
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 px-0 text-destructive hover:text-destructive"
                      disabled={isPending}
                      onClick={() => removeMedia(entry)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
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
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
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
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <div>
        <p className="text-xs font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
