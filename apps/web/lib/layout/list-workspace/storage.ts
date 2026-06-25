import {
  DEFAULT_LIST_WORKSPACE_STATE,
  type ListWorkspaceLayout,
  type ListWorkspaceState,
} from "@/lib/layout/list-workspace/types";

export function listWorkspaceStorageKey(moduleId: string): string {
  return `aib-list-workspace:${moduleId}`;
}

function isListWorkspaceLayout(value: unknown): value is ListWorkspaceLayout {
  return value === "split" || value === "matrix";
}

export function parseListWorkspaceState(raw: unknown): ListWorkspaceState {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_LIST_WORKSPACE_STATE;
  }
  const source = raw as Record<string, unknown>;
  const layout = isListWorkspaceLayout(source.layout)
    ? source.layout
    : source.layout === "preview"
      ? "split"
      : DEFAULT_LIST_WORKSPACE_STATE.layout;
  return { layout };
}

export function readListWorkspaceState(moduleId: string): ListWorkspaceState {
  if (typeof window === "undefined") {
    return DEFAULT_LIST_WORKSPACE_STATE;
  }
  try {
    const raw = localStorage.getItem(listWorkspaceStorageKey(moduleId));
    if (!raw) return DEFAULT_LIST_WORKSPACE_STATE;
    return parseListWorkspaceState(JSON.parse(raw));
  } catch {
    return DEFAULT_LIST_WORKSPACE_STATE;
  }
}

export function persistListWorkspaceState(moduleId: string, state: ListWorkspaceState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(listWorkspaceStorageKey(moduleId), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}
