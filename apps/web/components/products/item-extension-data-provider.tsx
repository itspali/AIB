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

type ExtensionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ItemDrawerExtensionData }
  | { status: "error"; error: string };

const ItemExtensionDataContext = createContext<ExtensionState | null>(null);

const inflightLoads = new Map<string, Promise<ItemDrawerExtensionData | { error: string }>>();

function fetchExtensionData(itemId: string): Promise<ItemDrawerExtensionData | { error: string }> {
  const existing = inflightLoads.get(itemId);
  if (existing) return existing;

  const request = getItemDrawerExtensionData(itemId).then((result) => {
    if ("error" in result) return { error: result.error ?? "Unable to load item data." };
    return result.data;
  });

  inflightLoads.set(itemId, request);
  void request.finally(() => {
    if (inflightLoads.get(itemId) === request) {
      inflightLoads.delete(itemId);
    }
  });

  return request;
}

export function ItemExtensionDataProvider({
  itemId,
  enabled = true,
  children,
}: {
  itemId: string | null | undefined;
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

    void fetchExtensionData(itemId).then((result) => {
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
  }, [enabled, itemId]);

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
