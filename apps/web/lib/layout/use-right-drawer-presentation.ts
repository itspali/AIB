"use client";

import { useListWorkspaceSplitDetailHost } from "@/lib/layout/list-workspace-split-detail-context";
import { useOptionalListWorkspace } from "@/lib/layout/list-workspace";
import { useListWorkspaceSplitDesktop } from "@/components/layout/list-workspace-split-layout";

export type RightDrawerPresentation = "overlay" | "inline-panel" | "matrix-panel";

type Options = {
  peekMode: boolean;
};

export function useRightDrawerPresentation({ peekMode }: Options): RightDrawerPresentation {
  const workspace = useOptionalListWorkspace();
  const isSplitDesktop = useListWorkspaceSplitDesktop();
  const splitDetail = useListWorkspaceSplitDetailHost();
  const layout = workspace?.layout ?? "matrix";

  if (!peekMode) return "overlay";

  if (layout === "split" && isSplitDesktop && splitDetail?.hostRef) {
    return "inline-panel";
  }

  if (layout === "matrix") {
    return "matrix-panel";
  }

  return "overlay";
}
