export type ListWorkspaceLayout = "split" | "matrix";

export type ListWorkspaceState = {
  layout: ListWorkspaceLayout;
};

export const DEFAULT_LIST_WORKSPACE_STATE: ListWorkspaceState = {
  layout: "matrix",
};
