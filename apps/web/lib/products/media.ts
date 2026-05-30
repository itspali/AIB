import type { SupabaseClient } from "@supabase/supabase-js";

const PRODUCT_MEDIA_BUCKET = "product-media";

export function buildProductMediaStoragePath(
  tenantId: string,
  itemId: string,
  mediaId: string,
  extension: string,
  variantId?: string | null
): string {
  if (variantId) {
    return `${tenantId}/items/${itemId}/variants/${variantId}/${mediaId}.${extension}`;
  }
  return `${tenantId}/items/${itemId}/${mediaId}.${extension}`;
}

export async function getProductMediaSignedUrl(
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
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolveProductMediaSignedUrls(
  supabase: SupabaseClient,
  storagePaths: string[],
  expiresIn = 3600
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const uniquePaths = [...new Set(storagePaths.map((path) => path.trim()).filter(Boolean))];
  if (!uniquePaths.length) return map;

  const remoteUrls = uniquePaths.filter(
    (path) => path.startsWith("http://") || path.startsWith("https://")
  );
  for (const path of remoteUrls) {
    map.set(path, path);
  }

  const bucketPaths = uniquePaths.filter(
    (path) => !path.startsWith("http://") && !path.startsWith("https://")
  );
  if (!bucketPaths.length) return map;

  const { data, error } = await supabase.storage
    .from(PRODUCT_MEDIA_BUCKET)
    .createSignedUrls(bucketPaths, expiresIn);

  if (error || !data?.length) {
    await Promise.all(
      bucketPaths.map(async (path) => {
        const url = await getProductMediaSignedUrl(supabase, path, expiresIn);
        if (url) map.set(path, url);
      })
    );
    return map;
  }

  for (const entry of data) {
    if (!entry.path || !entry.signedUrl || entry.error) continue;
    map.set(entry.path, entry.signedUrl);
  }

  return map;
}

export { PRODUCT_MEDIA_BUCKET };
