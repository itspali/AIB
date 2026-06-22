"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type FactorSummary = {
  id: string;
  friendlyName: string;
  status: string;
};

type ConsoleMfaEnrollProps = {
  redirectTo?: string;
};

export function ConsoleMfaEnroll({ redirectTo = "/console" }: ConsoleMfaEnrollProps) {
  const router = useRouter();
  const [factors, setFactors] = useState<FactorSummary[]>([]);
  const [enrollState, setEnrollState] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [isPending, startTransition] = useTransition();

  const loadFactors = () => {
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        return;
      }
      setFactors(
        (data.totp ?? []).map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name ?? "Authenticator",
          status: factor.status,
        }))
      );
    });
  };

  useEffect(() => {
    loadFactors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEnroll = () => {
    setError(null);
    setUnavailable(false);
    startTransition(async () => {
      const supabase = createClient();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (enrollError) {
        setUnavailable(true);
        setError(enrollError.message);
        return;
      }

      const totp = data.totp;
      if (!totp?.qr_code || !data.id) {
        setUnavailable(true);
        setError("Enrollment data was incomplete. Retry or check Supabase MFA settings.");
        return;
      }

      setEnrollState({
        factorId: data.id,
        qrCode: totp.qr_code,
        secret: totp.secret,
      });
    });
  };

  const handleVerify = (event: React.FormEvent) => {
    event.preventDefault();
    if (!enrollState || !code.trim()) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollState.factorId,
      });

      if (challengeError || !challenge?.id) {
        setError(challengeError?.message ?? "Unable to start MFA verification.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollState.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      setEnrollState(null);
      setCode("");
      loadFactors();
      router.push(redirectTo);
      router.refresh();
    });
  };

  const hasVerified = factors.some((factor) => factor.status === "verified");

  return (
    <div className="space-y-6">
      <div className="surface-panel space-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/25">
            <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold">Authenticator factors</h2>
            <p className="text-xs text-muted-foreground">
              TOTP enrollment for console access (AAL2).
            </p>
          </div>
        </div>

        {factors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No authenticator factors enrolled yet.</p>
        ) : (
          <ul className="space-y-2">
            {factors.map((factor) => (
              <li
                key={factor.id}
                className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2 text-sm"
              >
                <span>{factor.friendlyName}</span>
                <Badge variant={factor.status === "verified" ? "completed" : "action_required"}>
                  {factor.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {!enrollState && !hasVerified ? (
          <Button type="button" disabled={isPending} onClick={startEnroll}>
            {isPending ? "Preparing…" : "Enroll authenticator app"}
          </Button>
        ) : null}
      </div>

      {unavailable ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
          Multi-factor authentication may not be enabled for this Supabase project. Enable TOTP in
          the Supabase Auth dashboard, then retry enrollment.
        </div>
      ) : null}

      {enrollState ? (
        <form onSubmit={handleVerify} className="surface-panel space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Scan this QR code with your authenticator app, then enter the verification code.
          </p>

          <div
            className="mx-auto flex max-w-[220px] justify-center rounded-lg border border-border bg-white p-3 shadow-sm"
            dangerouslySetInnerHTML={{ __html: enrollState.qrCode }}
          />

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Manual entry secret</p>
            <p className="break-all font-mono text-xs">{enrollState.secret}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="console_mfa_code">Verification code</Label>
            <Input
              id="console_mfa_code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              disabled={isPending}
              onChange={(event) => setCode(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={isPending || !code.trim()}>
            {isPending ? "Verifying…" : "Verify and enable MFA"}
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
