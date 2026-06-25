"use client";

import { AppearancePreviewBar } from "@/components/appearance/appearance-preview-bar";
import {
  AppearancePreviewProvider,
  useAppearancePreview,
} from "@/components/appearance/appearance-preview-provider";
import { cn } from "@/lib/utils";

type ModulePreviewShellProps = {
  classic: React.ReactNode;
  revamp: React.ReactNode;
  /** Optional module name shown in the preview bar hint on md+ screens. */
  moduleName?: string;
  previewMode?: "catalog" | "overview";
};

function ModulePreviewBody({ classic, revamp, moduleName, previewMode }: ModulePreviewShellProps) {
  const { state, isPreview } = useAppearancePreview();

  const content = state.generation === "classic" ? classic : revamp;

  return (
    <div
      data-appearance-root
      data-ui-generation={state.generation}
      data-visual={isPreview ? state.visual : undefined}
      data-density={isPreview ? state.density : undefined}
      className={cn(
        isPreview && "appearance-preview-active",
        isPreview && previewMode === "catalog" && "appearance-preview-catalog"
      )}
    >
      <AppearancePreviewBar moduleName={moduleName} previewMode={previewMode} />
      {content}
    </div>
  );
}

export function ModulePreviewShell({
  classic,
  revamp,
  moduleName,
  previewMode = "overview",
}: ModulePreviewShellProps) {
  return (
    <AppearancePreviewProvider>
      <ModulePreviewBody
        classic={classic}
        revamp={revamp}
        moduleName={moduleName}
        previewMode={previewMode}
      />
    </AppearancePreviewProvider>
  );
}
