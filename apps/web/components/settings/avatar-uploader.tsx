"use client";

import { useCallback, useState } from "react";
import { Upload } from "lucide-react";
import { AVATAR_BUCKET, buildAvatarStoragePath } from "@/lib/settings/avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Props = {
  tenantId: string;
  userId: string;
  value: string;
  previewUrl?: string | null;
  disabled?: boolean;
  onUploaded: (storagePath: string) => void;
};

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function AvatarUploader({
  tenantId,
  userId,
  value,
  previewUrl,
  disabled,
  onUploaded,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const displayPreview = localPreview || previewUrl;

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

      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = buildAvatarStoragePath(tenantId, userId, extension);

      setIsUploading(true);
      const supabase = createClient();

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      setIsUploading(false);

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      setLocalPreview(URL.createObjectURL(file));
      onUploaded(path);
    },
    [tenantId, userId, onUploaded]
  );

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center transition-colors duration-200 dark:border-white/10",
          !disabled && "hover:border-primary/40 hover:bg-muted/30",
          disabled && "opacity-50"
        )}
        onDragOver={(event) => {
          event.preventDefault();
        }}
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
            alt="Avatar preview"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-border/80"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted ring-2 ring-border/80">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div>
          <p className="text-sm font-medium">Drag and drop your avatar</p>
          <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP up to 2MB</p>
        </div>

        <label className="cursor-pointer text-sm font-medium text-primary hover:underline">
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

        {value && !isUploading && (
          <p className="max-w-full truncate text-xs text-muted-foreground">{value}</p>
        )}
        {isUploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
