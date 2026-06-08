"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload } from "lucide-react";
import { buildEntityLogoStoragePath, ENTITY_LOGO_BUCKET } from "@/lib/entities/logo";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  tenantId: string;
  entityId: string | null;
  draftStorageKey: string;
  value: string;
  previewUrl?: string | null;
  disabled?: boolean;
  onUploaded: (storagePath: string) => void;
};

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function EntityLogoUploader({
  tenantId,
  entityId,
  draftStorageKey,
  value,
  previewUrl,
  disabled,
  onUploaded,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    setLocalPreview(null);
  }, [previewUrl, value]);

  const displayPreview = localPreview || previewUrl;
  const storageEntityKey = entityId ?? draftStorageKey;

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ALLOWED_TYPES.has(file.type)) {
        setError("Use JPEG, PNG, or WebP images only.");
        return;
      }

      if (file.size > MAX_BYTES) {
        setError("Image must be 2MB or smaller.");
        return;
      }

      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = buildEntityLogoStoragePath(tenantId, storageEntityKey, extension);

      setIsUploading(true);
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from(ENTITY_LOGO_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      setIsUploading(false);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      setLocalPreview(URL.createObjectURL(file));
      onUploaded(path);
    },
    [onUploaded, storageEntityKey, tenantId]
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "surface-inset flex items-center gap-4 border-dashed px-4 py-4 transition-colors duration-200",
          !disabled && "hover:border-primary/40 hover:bg-muted/30",
          disabled && "opacity-50"
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (disabled) return;
          const file = event.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
      >
        {displayPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayPreview}
            alt="Entity profile preview"
            className="h-16 w-16 shrink-0 rounded-lg object-cover ring-2 ring-border/80"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted ring-2 ring-border/80">
            <Upload className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Profile photo / logo</p>
          <p className="text-xs text-muted-foreground">
            Shown on lists and the entity drawer. JPEG, PNG, or WebP up to 2MB.
          </p>
          <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-primary hover:underline">
            Browse files
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={disabled || isUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadFile(file);
              }}
            />
          </label>
          {isUploading ? (
            <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
