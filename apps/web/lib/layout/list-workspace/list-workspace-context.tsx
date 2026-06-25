"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  persistListWorkspaceState,
  readListWorkspaceState,
} from "@/lib/layout/list-workspace/storage";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace/types";

type ListWorkspaceContextValue = {
  moduleId: string;
  layout: ListWorkspaceLayout;
  setLayout: (layout: ListWorkspaceLayout) => void;
};

const ListWorkspaceContext = createContext<ListWorkspaceContextValue | null>(null);

type ListWorkspaceProviderProps = {
  moduleId: string;
  children: ReactNode;
};

export function ListWorkspaceProvider({ moduleId, children }: ListWorkspaceProviderProps) {
  const [layout, setLayoutState] = useState<ListWorkspaceLayout>("matrix");

  useEffect(() => {
    setLayoutState(readListWorkspaceState(moduleId).layout);
  }, [moduleId]);

  const setLayout = useCallback(
    (next: ListWorkspaceLayout) => {
      setLayoutState(next);
      persistListWorkspaceState(moduleId, { layout: next });
    },
    [moduleId]
  );

  const value = useMemo(
    () => ({
      moduleId,
      layout,
      setLayout,
    }),
    [layout, moduleId, setLayout]
  );

  return (
    <ListWorkspaceContext.Provider value={value}>{children}</ListWorkspaceContext.Provider>
  );
}

export function useListWorkspace() {
  const context = useContext(ListWorkspaceContext);
  if (!context) {
    throw new Error("useListWorkspace must be used within ListWorkspaceProvider");
  }
  return context;
}

export function useOptionalListWorkspace() {
  return useContext(ListWorkspaceContext);
}
