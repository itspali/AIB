"use client";

import { useEffect, useState } from "react";
import { Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MfaSetupModal } from "@/components/settings/mfa-setup-modal";
import { PasswordFields } from "@/components/settings/password-fields";
import { SessionTelemetryGrid } from "@/components/settings/session-telemetry-grid";
import { createClient } from "@/lib/supabase/client";
import type { UseFormReturn } from "react-hook-form";
import type { AuthSessionRow, ProfileSettingsFormValues } from "@/lib/settings/types";

type Props = {
  form: UseFormReturn<ProfileSettingsFormValues>;
  sessions: AuthSessionRow[];
  timezone: string;
  authSessionId: string | null;
  mfaEnabled: boolean;
  disabled?: boolean;
  onMfaStatusChange?: (enabled: boolean) => void;
};

export function SecurityRail({
  form,
  sessions,
  timezone,
  authSessionId,
  mfaEnabled,
  disabled,
  onMfaStatusChange,
}: Props) {
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaActive, setMfaActive] = useState(mfaEnabled);

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return;

      const hasVerifiedTotp = (data.totp ?? []).some((factor) => factor.status === "verified");
      setMfaActive(hasVerifiedTotp);
    })();
  }, [mfaEnabled]);

  return (
    <aside className="space-y-4 lg:col-span-3">
      <section className="surface-panel space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-semibold">Credential Hardening</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Update your password when rotating credentials. Leave blank to keep your current password.
        </p>
        <PasswordFields form={form} disabled={disabled} />
      </section>

      <section className="surface-panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Multi-Factor Auth</h2>
          </div>
          <Badge variant={mfaActive ? "completed" : "action_required"}>
            {mfaActive ? "Enabled" : "Not configured"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Protect your workspace with a TOTP authenticator app.
        </p>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={disabled || mfaActive}
          onClick={() => setMfaOpen(true)}
        >
          Configure Authenticator App
        </Button>
      </section>

      <SessionTelemetryGrid
        sessions={sessions}
        timezone={timezone}
        authSessionId={authSessionId}
        disabled={disabled}
      />

      <MfaSetupModal
        open={mfaOpen}
        onOpenChange={setMfaOpen}
        onEnrolled={() => {
          setMfaActive(true);
          onMfaStatusChange?.(true);
          toast.success("Authenticator app configured successfully");
        }}
      />
    </aside>
  );
}
