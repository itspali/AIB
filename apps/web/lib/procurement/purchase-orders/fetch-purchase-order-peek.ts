"use client";

import { loadPurchaseOrderPeek } from "@/app/procurement/purchase-orders/actions";
import type { PurchaseOrderPeekPayload } from "@/app/procurement/purchase-orders/actions";

type PeekResult = PurchaseOrderPeekPayload | { error: string };

const peekFetchInflight = new Map<string, Promise<PeekResult>>();

/** Dedupes concurrent peek loads (e.g. React Strict Mode) into one server action call. */
export function fetchPurchaseOrderPeek(purchaseOrderId: string): Promise<PeekResult> {
  const id = purchaseOrderId.trim();
  if (!id) {
    return Promise.resolve({ error: "Purchase order id is required." });
  }

  const pending = peekFetchInflight.get(id);
  if (pending) return pending;

  const request = loadPurchaseOrderPeek(id).finally(() => {
    peekFetchInflight.delete(id);
  });
  peekFetchInflight.set(id, request);
  return request;
}
