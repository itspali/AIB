"use client";

import {
  useRightDrawerPresentation,
  type RightDrawerPresentation,
} from "@/lib/layout/use-right-drawer-presentation";

export type ModuleDrawerPeekPresentation = {
  presentation: RightDrawerPresentation;
  /** Peek renders inside the split detail column (Items/Categories split parity). */
  isSplitInlinePeek: boolean;
  /** Peek floats over the matrix registry (Items/Categories matrix parity). */
  isMatrixPeek: boolean;
  peekShellClassName: string | undefined;
  peekBodyClassName: string | undefined;
};

/** Align RightDrawer peek chrome with Items/Categories split vs matrix workspace modes. */
export function useModuleDrawerPeekPresentation(peekMode: boolean): ModuleDrawerPeekPresentation {
  const presentation = useRightDrawerPresentation({ peekMode });
  const isSplitInlinePeek = presentation === "inline-panel";
  const isMatrixPeek = presentation === "matrix-panel";

  return {
    presentation,
    isSplitInlinePeek,
    isMatrixPeek,
    peekShellClassName:
      peekMode && !isSplitInlinePeek ? "module-drawer-peek-shell" : undefined,
    peekBodyClassName:
      peekMode && !isSplitInlinePeek ? "module-drawer-peek-body" : undefined,
  };
}
