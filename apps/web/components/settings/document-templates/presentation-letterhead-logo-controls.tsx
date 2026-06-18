"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRESENTATION_LOGO_HEIGHT_MAX_PX,
  PRESENTATION_LOGO_HEIGHT_MIN_PX,
  PRESENTATION_LOGO_WIDTH_MAX_PX,
  PRESENTATION_LOGO_WIDTH_MIN_PX,
} from "@/lib/documents/print/default-shell-config";
import type { PresentationLogoPlacement, PresentationShellConfig } from "@/lib/documents/print/types";

type HeaderConfig = PresentationShellConfig["header"];

type Props = {
  idPrefix: string;
  header: HeaderConfig;
  disabled?: boolean;
  onPatch: (patch: Partial<HeaderConfig>) => void;
};

function parseLogoDimension(
  raw: string,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function PresentationLetterheadLogoControls({
  idPrefix,
  header,
  disabled,
  onPatch,
}: Props) {
  const controlsDisabled = disabled || !header.showLogo;

  return (
    <div className="space-y-3 rounded-md border border-border/60 px-3 py-2.5">
      <p className="text-sm font-medium">Logo layout</p>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-logoPlacement`} className="text-xs font-medium text-muted-foreground">
          Placement
        </Label>
        <Select
          value={header.logoPlacement}
          disabled={controlsDisabled}
          onValueChange={(value) =>
            onPatch({ logoPlacement: value as PresentationLogoPlacement })
          }
        >
          <SelectTrigger id={`${idPrefix}-logoPlacement`} className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Above organization</SelectItem>
            <SelectItem value="left">Left of organization</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-logoMaxHeightPx`} className="text-xs font-medium text-muted-foreground">
            Max height (px)
          </Label>
          <Input
            id={`${idPrefix}-logoMaxHeightPx`}
            type="number"
            min={PRESENTATION_LOGO_HEIGHT_MIN_PX}
            max={PRESENTATION_LOGO_HEIGHT_MAX_PX}
            value={header.logoMaxHeightPx}
            disabled={controlsDisabled}
            onChange={(event) =>
              onPatch({
                logoMaxHeightPx: parseLogoDimension(
                  event.target.value,
                  header.logoMaxHeightPx,
                  PRESENTATION_LOGO_HEIGHT_MIN_PX,
                  PRESENTATION_LOGO_HEIGHT_MAX_PX
                ),
              })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-logoMaxWidthPx`} className="text-xs font-medium text-muted-foreground">
            Max width (px)
          </Label>
          <Input
            id={`${idPrefix}-logoMaxWidthPx`}
            type="number"
            min={PRESENTATION_LOGO_WIDTH_MIN_PX}
            max={PRESENTATION_LOGO_WIDTH_MAX_PX}
            value={header.logoMaxWidthPx}
            disabled={controlsDisabled}
            onChange={(event) =>
              onPatch({
                logoMaxWidthPx: parseLogoDimension(
                  event.target.value,
                  header.logoMaxWidthPx,
                  PRESENTATION_LOGO_WIDTH_MIN_PX,
                  PRESENTATION_LOGO_WIDTH_MAX_PX
                ),
              })
            }
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Height {PRESENTATION_LOGO_HEIGHT_MIN_PX}–{PRESENTATION_LOGO_HEIGHT_MAX_PX}px, width{" "}
        {PRESENTATION_LOGO_WIDTH_MIN_PX}–{PRESENTATION_LOGO_WIDTH_MAX_PX}px.
      </p>
    </div>
  );
}
