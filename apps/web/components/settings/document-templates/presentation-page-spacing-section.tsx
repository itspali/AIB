"use client";

import { OrgSettingsSection } from "@/components/settings/org-settings-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PresentationSpacingValues } from "@/lib/documents/print/types";

type SpacingSide = keyof PresentationSpacingValues;

const SPACING_SIDES: { id: SpacingSide; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "right", label: "Right" },
  { id: "bottom", label: "Bottom" },
  { id: "left", label: "Left" },
];

type SpacingFieldGridProps = {
  idPrefix: string;
  values: PresentationSpacingValues;
  disabled?: boolean;
  unitHint: string;
  onChange: (side: SpacingSide, value: string) => void;
};

function SpacingFieldGrid({
  idPrefix,
  values,
  disabled,
  unitHint,
  onChange,
}: SpacingFieldGridProps) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SPACING_SIDES.map((side) => (
          <div key={side.id} className="space-y-1.5">
            <Label htmlFor={`${idPrefix}-${side.id}`} className="text-xs font-medium text-muted-foreground">
              {side.label}
            </Label>
            <Input
              id={`${idPrefix}-${side.id}`}
              value={values[side.id]}
              disabled={disabled}
              placeholder={unitHint}
              onChange={(event) => onChange(side.id, event.target.value)}
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Use values like {unitHint}.</p>
    </div>
  );
}

type Props = {
  moduleKey: string;
  margins: PresentationSpacingValues;
  padding: PresentationSpacingValues;
  disabled?: boolean;
  onMarginsChange: (side: SpacingSide, value: string) => void;
  onPaddingChange: (side: SpacingSide, value: string) => void;
};

export function PresentationPageSpacingSection({
  moduleKey,
  margins,
  padding,
  disabled,
  onMarginsChange,
  onPaddingChange,
}: Props) {
  return (
    <OrgSettingsSection
      title="Page spacing"
      description="Control print page margins and inner content padding in the preview."
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-md border border-border/60 px-3 py-2.5">
          <p className="text-sm font-medium">Page margins</p>
          <p className="text-xs text-muted-foreground">
            Applied to the printable page area when generating PDFs.
          </p>
          <SpacingFieldGrid
            idPrefix={`${moduleKey}-page-margin`}
            values={margins}
            disabled={disabled}
            unitHint="12mm"
            onChange={onMarginsChange}
          />
        </div>
        <div className="space-y-2 rounded-md border border-border/60 px-3 py-2.5">
          <p className="text-sm font-medium">Content padding</p>
          <p className="text-xs text-muted-foreground">
            Space between the page edge and document content in the live preview.
          </p>
          <SpacingFieldGrid
            idPrefix={`${moduleKey}-content-padding`}
            values={padding}
            disabled={disabled}
            unitHint="24px"
            onChange={onPaddingChange}
          />
        </div>
      </div>
    </OrgSettingsSection>
  );
}
