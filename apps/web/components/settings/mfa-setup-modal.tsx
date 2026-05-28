"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled: () => void;
};

type EnrollState = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function MfaSetupModal({ open, onOpenChange, onEnrolled }: Props) {
  const [enrollState, setEnrollState] = useState<EnrollState | null>(null);
  const [code, setCode] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setEnrollState(null);
      setCode("");
      setUnavailable(false);
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (error) {
        setUnavailable(true);
        return;
      }

      const totp = data.totp;
      if (!totp?.qr_code || !data.id) {
        setUnavailable(true);
        return;
      }

      setEnrollState({
        factorId: data.id,
        qrCode: totp.qr_code,
        secret: totp.secret,
      });
    });
  }, [open]);

  const handleVerify = () => {
    if (!enrollState || !code.trim()) {
      toast.error("Enter the 6-digit code from your authenticator app.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollState.factorId,
      });

      if (challengeError || !challenge?.id) {
        toast.error(challengeError?.message ?? "Unable to start MFA verification.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollState.factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });

      if (verifyError) {
        toast.error(verifyError.message);
        return;
      }

      onEnrolled();
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Configure Authenticator App</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {unavailable && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
              Multi-factor authentication is not enabled for this Supabase project. Enable TOTP in
              the Supabase Auth dashboard, then retry enrollment.
            </div>
          )}

          {!unavailable && !enrollState && (
            <p className="text-sm text-muted-foreground">Preparing enrollment…</p>
          )}

          {enrollState && (
            <>
              <p className="text-sm text-muted-foreground">
                Scan this QR code with your authenticator app, then enter the verification code.
              </p>

              <div
                className="mx-auto flex max-w-[220px] justify-center rounded-lg border border-border bg-white p-3 shadow-sm"
                // Supabase returns an SVG string for the QR code.
                dangerouslySetInnerHTML={{ __html: enrollState.qrCode }}
              />

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Manual entry secret</p>
                <p className="break-all font-mono text-xs">{enrollState.secret}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mfa_code">Verification code</Label>
                <Input
                  id="mfa_code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  disabled={isPending}
                  onChange={(event) => setCode(event.target.value)}
                />
              </div>

              <Button type="button" className="w-full" disabled={isPending} onClick={handleVerify}>
                Verify and enable MFA
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
