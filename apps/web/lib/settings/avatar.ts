import type { SupabaseClient } from "@supabase/supabase-js";

const AVATAR_BUCKET = "user-avatars";

export function buildAvatarStoragePath(
  tenantId: string,
  userId: string,
  extension: string
): string {
  return `${tenantId}/${userId}/avatar.${extension}`;
}

export async function getAvatarSignedUrl(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!storagePath?.trim()) return null;

  const path = storagePath.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export { AVATAR_BUCKET };
