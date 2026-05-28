const LOGO_BUCKET = "tenant-logos";

export function buildTenantLogoStoragePath(tenantId: string, extension: string): string {
  return `${tenantId}/logo.${extension}`;
}

export async function getTenantLogoSignedUrl(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  storagePath: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!storagePath?.trim()) return null;

  const path = storagePath.trim();
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export { LOGO_BUCKET };
