const ENTITY_LOGO_BUCKET = "entity-logos";

export function buildEntityLogoStoragePath(
  tenantId: string,
  entityId: string,
  extension: string
): string {
  return `${tenantId}/entities/${entityId}/profile.${extension}`;
}

export async function getEntityLogoSignedUrl(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  storagePath: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!storagePath?.trim()) return null;

  const path = storagePath.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const { data, error } = await supabase.storage
    .from(ENTITY_LOGO_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export { ENTITY_LOGO_BUCKET };
