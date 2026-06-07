"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ACCENT_HUE_PRESETS,
  findHuePreset,
  hueFromPreset,
  PRIMARY_HUE_PRESETS,
} from "@/lib/theme/brand-colors";
import { THEME_LABELS, THEMES, type Theme } from "@/lib/theme/themes";
import { cn } from "@/lib/utils";

type ThemeSettingsValue = {
  default_theme: Theme;
  primary_hue: number | null;
  accent_hue: number | null;
  allow_location_theme_override: boolean;
  allow_user_theme_override: boolean;
};

type Props = {
  value: ThemeSettingsValue;
  disabled?: boolean;
  showGovernanceToggles?: boolean;
  onChange: (next: ThemeSettingsValue) => void;
};

function HuePresetSelect({
  id,
  label,
  presets,
  hue,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  presets: typeof PRIMARY_HUE_PRESETS;
  hue: number | null;
  disabled?: boolean;
  onChange: (hue: number | null) => void;
}) {
  const selected = findHuePreset(presets, hue);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-muted-foreground">
        {label}
      </Label>
      <Select
        value={selected}
        disabled={disabled}
        onValueChange={(presetId) => onChange(hueFromPreset(presets, presetId))}
      >
        <SelectTrigger id={id} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Theme default</SelectItem>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-1 ring-border"
                  style={{ backgroundColor: preset.preview }}
                  aria-hidden
                />
                {preset.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function GovernanceSwitch({
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function ThemeSettingsFields({
  value,
  disabled,
  showGovernanceToggles = true,
  onChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="workspace-theme-mode" className="text-sm font-medium text-muted-foreground">
            Workspace theme
          </Label>
          <Select
            value={value.default_theme}
            disabled={disabled}
            onValueChange={(theme) => onChange({ ...value, default_theme: theme as Theme })}
          >
            <SelectTrigger id="workspace-theme-mode" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((theme) => (
                <SelectItem key={theme} value={theme}>
                  {THEME_LABELS[theme]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <HuePresetSelect
          id="workspace-primary-hue"
          label="Primary color"
          presets={PRIMARY_HUE_PRESETS}
          hue={value.primary_hue}
          disabled={disabled}
          onChange={(primary_hue) => onChange({ ...value, primary_hue })}
        />

        <HuePresetSelect
          id="workspace-accent-hue"
          label="Accent color"
          presets={ACCENT_HUE_PRESETS}
          hue={value.accent_hue}
          disabled={disabled}
          onChange={(accent_hue) => onChange({ ...value, accent_hue })}
        />
      </div>

      <div
        className={cn(
          "rounded-lg border border-border p-3",
          value.default_theme === "dark" ? "dark" : "theme-light-warm"
        )}
        aria-hidden
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
            Primary
          </span>
          <span className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
            Accent
          </span>
          <span className="rounded-md border border-border bg-card px-2 py-1 text-xs text-card-foreground">
            Card surface
          </span>
        </div>
      </div>

      {showGovernanceToggles ? (
        <div className="space-y-3">
          <GovernanceSwitch
            label="Allow locations to customize theme"
            description="Location admins can override the workspace theme and brand colors per facility."
            checked={value.allow_location_theme_override}
            disabled={disabled}
            onCheckedChange={(allow_location_theme_override) =>
              onChange({ ...value, allow_location_theme_override })
            }
          />
          <GovernanceSwitch
            label="Allow users to change theme"
            description="When disabled, users see the workspace or location theme and cannot switch modes."
            checked={value.allow_user_theme_override}
            disabled={disabled}
            onCheckedChange={(allow_user_theme_override) =>
              onChange({ ...value, allow_user_theme_override })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
