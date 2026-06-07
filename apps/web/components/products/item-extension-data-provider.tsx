"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getItemDrawerExtensionData,
  type ItemDrawerExtensionData,
} from "@/app/items/actions";
import type { ProductCatalogContext } from "@/lib/products/types";

type ExtensionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ItemDrawerExtensionData }
  | { status: "error"; error: string };

const ItemExtensionDataContext = createContext<ExtensionState | null>(null);

const inflightLoads = new Map<string, Promise<ItemDrawerExtensionData | { error: string }>>();

function fetchExtensionData(
  itemId: string,
  catalogContext?: ProductCatalogContext | null
): Promise<ItemDrawerExtensionData | { error: string }> {
  const cacheKey = catalogContext ? `${itemId}:ctx` : itemId;
  const existing = inflightLoads.get(cacheKey);
  if (existing) return existing;

  const request = getItemDrawerExtensionData(itemId, catalogContext).then((result) => {
    if ("error" in result) return { error: result.error ?? "Unable to load item data." };
    return result.data;
  });

  inflightLoads.set(cacheKey, request);
  void request.finally(() => {
    if (inflightLoads.get(cacheKey) === request) {
      inflightLoads.delete(cacheKey);
    }
  });

  return request;
}

export function ItemExtensionDataProvider({
  itemId,
  catalogContext = null,
  enabled = true,
  children,
}: {
  itemId: string | null | undefined;
  catalogContext?: ProductCatalogContext | null;
  /** When false, skips the batched extension fetch until heavy sections need it. */
  enabled?: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<ExtensionState>({ status: "idle" });

  useEffect(() => {
    if (!enabled || !itemId) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    void fetchExtensionData(itemId, catalogContext).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setState({ status: "error", error: result.error });
        return;
      }
      setState({ status: "ready", data: result });
    });

    return () => {
      cancelled = true;
    };
  }, [catalogContext, enabled, itemId]);

  const value = useMemo(() => state, [state]);

  return (
    <ItemExtensionDataContext.Provider value={value}>{children}</ItemExtensionDataContext.Provider>
  );
}

export function useItemExtensionData(): ExtensionState {
  const ctx = useContext(ItemExtensionDataContext);
  if (!ctx) {
    return { status: "idle" };
  }
  return ctx;
}

export function useOptionalItemExtensionData(): ExtensionState | null {
  return useContext(ItemExtensionDataContext);
}
