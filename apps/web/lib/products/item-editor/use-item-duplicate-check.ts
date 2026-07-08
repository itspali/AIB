"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import {
  findExactItemByName,
  findSimilarItems,
  type SimilarItem,
} from "@/app/items/actions";
import { EXACT_DUPLICATE_ITEM_NAME_MESSAGE } from "@/lib/products/item-name-uniqueness";
import type { ProductMasterFormValues } from "@/lib/products/types";

type Options = {
  itemId: string | null;
  readOnly: boolean;
  name: string;
  allowDuplicateItemNames: boolean;
  form: UseFormReturn<ProductMasterFormValues>;
};

function nameCheckKey(name: string, itemId: string | null): string {
  return `${name}|${itemId ?? ""}`;
}

export function useItemDuplicateCheck({
  itemId,
  readOnly,
  name,
  allowDuplicateItemNames,
  form,
}: Options) {
  const [similarItems, setSimilarItems] = useState<SimilarItem[]>([]);
  const [nameCheckLoading, setNameCheckLoading] = useState(false);
  const [similarExpanded, setSimilarExpanded] = useState(false);
  const requestIdRef = useRef(0);
  const lastCheckedKeyRef = useRef<string | null>(null);

  const trimmedName = (name ?? "").trim();

  const clearExactNameError = useCallback(() => {
    const current = form.getFieldState("name").error;
    if (current?.message === EXACT_DUPLICATE_ITEM_NAME_MESSAGE) {
      form.clearErrors("name");
    }
  }, [form]);

  const executeCheck = useCallback(
    async (query: string) => {
      if (readOnly) {
        setSimilarItems([]);
        setNameCheckLoading(false);
        return;
      }

      const trimmed = query.trim();
      if (trimmed.length < 1) {
        setSimilarItems([]);
        setNameCheckLoading(false);
        lastCheckedKeyRef.current = null;
        clearExactNameError();
        return;
      }

      if (!allowDuplicateItemNames && trimmed.length < 1) {
        return;
      }

      if (allowDuplicateItemNames && trimmed.length < 2) {
        setSimilarItems([]);
        setNameCheckLoading(false);
        lastCheckedKeyRef.current = null;
        return;
      }

      const requestId = ++requestIdRef.current;
      setNameCheckLoading(true);

      try {
        if (!allowDuplicateItemNames) {
          const result = await findExactItemByName(trimmed, itemId);
          if (requestId !== requestIdRef.current) return;

          if ("error" in result && result.error) {
            setSimilarItems([]);
            return;
          }

          if (result.match) {
            form.setError("name", {
              type: "manual",
              message: EXACT_DUPLICATE_ITEM_NAME_MESSAGE,
            });
          } else {
            clearExactNameError();
          }

          lastCheckedKeyRef.current = nameCheckKey(trimmed, itemId);
          return;
        }

        const result = await findSimilarItems(trimmed, { limit: 5 });
        if (requestId !== requestIdRef.current) return;

        if ("matches" in result) {
          setSimilarItems(result.matches ?? []);
          setSimilarExpanded(false);
          lastCheckedKeyRef.current = nameCheckKey(trimmed, itemId);
        } else {
          setSimilarItems([]);
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setNameCheckLoading(false);
        }
      }
    },
    [allowDuplicateItemNames, clearExactNameError, form, itemId, readOnly]
  );

  const checkDuplicatesOnNameBlur = useCallback(() => {
    if (readOnly) return;

    if (!allowDuplicateItemNames) {
      if (trimmedName.length < 1) {
        lastCheckedKeyRef.current = null;
        clearExactNameError();
        return;
      }
    } else if (trimmedName.length < 2) {
      lastCheckedKeyRef.current = null;
      setSimilarItems([]);
      return;
    }

    const key = nameCheckKey(trimmedName, itemId);
    if (lastCheckedKeyRef.current === key) {
      return;
    }

    void executeCheck(trimmedName);
  }, [allowDuplicateItemNames, clearExactNameError, executeCheck, itemId, readOnly, trimmedName]);

  useEffect(() => {
    if (readOnly) {
      setSimilarItems([]);
      setNameCheckLoading(false);
      lastCheckedKeyRef.current = null;
    }
  }, [readOnly]);

  useEffect(() => {
    if (!allowDuplicateItemNames) {
      clearExactNameError();
      lastCheckedKeyRef.current = null;
    }
  }, [trimmedName, allowDuplicateItemNames, clearExactNameError]);

  return {
    similarItems,
    nameCheckLoading,
    similarExpanded,
    setSimilarExpanded,
    checkDuplicatesOnNameBlur,
  };
}
