type PreviewResult = { html: string } | { error: string };

const resultCache = new Map<string, PreviewResult>();
const inflightCache = new Map<string, Promise<PreviewResult>>();

export function getCachedDesignerPreview(draftKey: string): PreviewResult | null {
  return resultCache.get(draftKey) ?? null;
}

export function requestCachedDesignerPreview(
  draftKey: string,
  loader: () => Promise<PreviewResult>
): Promise<PreviewResult> {
  const cached = resultCache.get(draftKey);
  if (cached) return Promise.resolve(cached);

  const inflight = inflightCache.get(draftKey);
  if (inflight) return inflight;

  const promise = loader()
    .then((result) => {
      resultCache.set(draftKey, result);
      return result;
    })
    .finally(() => {
      inflightCache.delete(draftKey);
    });

  inflightCache.set(draftKey, promise);
  return promise;
}

export function seedDesignerPreviewCache(draftKey: string, result: PreviewResult): void {
  resultCache.set(draftKey, result);
  inflightCache.delete(draftKey);
}

export function invalidateDesignerPreviewCache(draftKey?: string): void {
  if (draftKey) {
    resultCache.delete(draftKey);
    inflightCache.delete(draftKey);
    return;
  }
  resultCache.clear();
  inflightCache.clear();
}
