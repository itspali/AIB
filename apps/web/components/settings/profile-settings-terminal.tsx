"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { applyProfileSecurityUpdates, registerSessionTelemetry } from "@/app/settings/profile/actions";
import { ProfileIdentitySection } from "@/components/settings/profile-identity-section";
import { ProfileLocalizationSection } from "@/components/settings/profile-localization-section";
import { SecurityRail } from "@/components/settings/security-rail";
import { Button } from "@/components/ui/button";
import { parseUserAgentSummary } from "@/lib/settings/format-datetime";
import { profileSettingsSchema } from "@/lib/settings/schemas";
import { getAuthSessionFingerprint } from "@/lib/settings/session-id";
import {
  snapshotToFormValues,
  type ProfileSettingsFormValues,
  type ProfileSettingsSnapshot,
} from "@/lib/settings/types";
import { createClient } from "@/lib/supabase/client";

type Props = {
  snapshot: ProfileSettingsSnapshot;
  tenantId: string;
  avatarPreviewUrl?: string | null;
};

export function ProfileSettingsTerminal({ snapshot, tenantId, avatarPreviewUrl }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sessionFingerprint, setSessionFingerprint] = useState<string | null>(null);
  const telemetryRegisteredRef = useRef(false);

  const defaultValues = useMemo(() => snapshotToFormValues(snapshot), [snapshot]);

  const form = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues,
  });

  const timezone = form.watch("timezone");

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    if (telemetryRegisteredRef.current) return;

    let cancelled = false;

    void (async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.refresh_token || cancelled) return;

      const fingerprint = await getAuthSessionFingerprint(session.refresh_token);
      if (cancelled) return;

      setSessionFingerprint(fingerprint);

      const osBrowser = parseUserAgentSummary(
        typeof navigator !== "undefined" ? navigator.userAgent : ""
      );

      await registerSessionTelemetry({
        authSessionId: fingerprint,
        osBrowser,
      });

      if (cancelled) return;

      telemetryRegisteredRef.current = true;
      router.refresh();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await applyProfileSecurityUpdates(values);

      if ("error" in result) {
        toast.error(result.error ?? "Unable to apply profile updates.");
        return;
      }

      toast.success("Profile Properties Synchronized Successfully");
      form.setValue("current_password", "");
      form.setValue("new_password", "");
      form.setValue("confirm_password", "");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="sticky top-0 z-10 -mx-1 flex flex-col gap-4 border-b border-border bg-background/95 px-1 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Account Settings &amp; Security</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage identity, regional preferences, credentials, MFA, and active sessions.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => form.reset(defaultValues)}
          >
            Reset Changes
          </Button>
          <Button type="submit" disabled={isPending}>
            Apply Profile &amp; Security Updates
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-10">
        <main className="space-y-4 lg:col-span-7">
          <ProfileIdentitySection
            form={form}
            email={snapshot.email}
            tenantId={tenantId}
            userId={snapshot.userId}
            avatarPreviewUrl={avatarPreviewUrl}
            disabled={isPending}
          />
          <ProfileLocalizationSection form={form} disabled={isPending} />
        </main>

        <SecurityRail
          form={form}
          sessions={snapshot.sessions}
          timezone={timezone}
          authSessionId={sessionFingerprint}
          mfaEnabled={snapshot.mfaEnabled}
          disabled={isPending}
        />
      </div>
    </form>
  );
}
