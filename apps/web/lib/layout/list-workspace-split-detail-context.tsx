"use client";

import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

type ListWorkspaceSplitDetailContextValue = {
  hostRef: RefObject<HTMLDivElement | null>;
  peekOpen: boolean;
};

const ListWorkspaceSplitDetailContext =
  createContext<ListWorkspaceSplitDetailContextValue | null>(null);

type ProviderProps = {
  peekOpen: boolean;
  children: ReactNode;
};

export function ListWorkspaceSplitDetailProvider({ peekOpen, children }: ProviderProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ hostRef, peekOpen }), [peekOpen]);
  return (
    <ListWorkspaceSplitDetailContext.Provider value={value}>
      {children}
    </ListWorkspaceSplitDetailContext.Provider>
  );
}

export function useListWorkspaceSplitDetailHost() {
  return useContext(ListWorkspaceSplitDetailContext);
}
