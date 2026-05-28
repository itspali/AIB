"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateUserDutyStatus } from "@/app/account/actions";
import { useTheme } from "@/components/theme/theme-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DUTY_STATUS_OPTIONS } from "@/lib/user/duty-status";
import type { DutyStatus, OperatorProfile } from "@/lib/user/types";

type Props = {
  profile: OperatorProfile;
  onDutyStatusChange: (status: DutyStatus) => void;
};

export function UserProfileControls({ profile, onDutyStatusChange }: Props) {
  const { theme, setTheme } = useTheme();
  const [isPending, startTransition] = useTransition();

  const handleDutyChange = (value: DutyStatus) => {
    onDutyStatusChange(value);
    startTransition(async () => {
      const result = await updateUserDutyStatus(value);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to update duty status.");
        onDutyStatusChange(profile.dutyStatus);
      }
    });
  };

  return (
    <div className="space-y-3 px-1 py-2">
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-muted-foreground">Duty availability</Label>
        <Select
          value={profile.dutyStatus}
          onValueChange={(value) => handleDutyChange(value as DutyStatus)}
          disabled={isPending}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUTY_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex h-10 items-center justify-between gap-3 rounded-md border border-input bg-background px-3">
        <Label htmlFor="dark-theme-override" className="text-sm font-medium text-muted-foreground">
          Dark Theme Override
        </Label>
        <Switch
          id="dark-theme-override"
          checked={theme === "dark"}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        />
      </div>
      <p className="text-xs text-muted-foreground">Theme toggle is also available in the top bar.</p>
    </div>
  );
}
