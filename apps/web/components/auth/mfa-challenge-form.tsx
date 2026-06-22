"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { formatAuthError } from "@/lib/auth/format-auth-error";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;

function sanitizeTotpInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

function isSafeNextPath(next: string | null): next is string {
  return Boolean(next && next.startsWith("/") && !next.startsWith("//"));
}

type MfaChallengeFormProps = {
  className?: string;
};

export function MfaChallengeForm({ className }: MfaChallengeFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [needsEnrollment, setNeedsEnrollment] = useState(false);
  const [loadingFactor, setLoadingFactor] = useState(true);
  const [isPending, startTransition] = useTransition();

  const nextPath = isSafeNextPath(searchParams.get("next")) ? searchParams.get("next")! : "/console";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadFactor() {
      setLoadingFactor(true);
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();

      if (cancelled) return;

      if (listError) {
        setError(formatAuthError(listError.message));
        setLoadingFactor(false);
        return;
      }

      const verifiedTotp = (data.totp ?? []).find((factor) => factor.status === "verified");
      if (!verifiedTotp?.id) {
        setNeedsEnrollment(true);
        setError(null);
        setFactorId(null);
        setLoadingFactor(false);
        return;
      }

      setNeedsEnrollment(false);

      setFactorId(verifiedTotp.id);
      setLoadingFactor(false);
    }

    void loadFactor();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCodeChange = (value: string) => {
    setError(null);
    setCode(sanitizeTotpInput(value));
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = sanitizeTotpInput(event.clipboardData.getData("text"));
    if (pasted) {
      setCode(pasted);
      setError(null);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (!factorId) {
      setError("Authenticator factor is not ready. Refresh and try again.");
      return;
    }

    if (code.length !== CODE_LENGTH) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code,
      });

      if (verifyError) {
        setError(formatAuthError(verifyError.message));
        setCode("");
        inputRef.current?.focus();
        return;
      }

      router.push(nextPath);
      router.refresh();
    });
  };

  return (
    <Card className={cn("mx-auto w-full max-w-md", className)}>
      <CardHeader className="space-y-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 ring-1 ring-violet-500/25">
          <ShieldCheck className="h-5 w-5 text-violet-600 dark:text-violet-300" aria-hidden />
        </div>
        <CardTitle>Authenticator verification</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to finish signing in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingFactor ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : needsEnrollment ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You need to set up an authenticator app before accessing the console.
            </p>
            <Button asChild className="w-full">
              <Link href={`/login/mfa-enroll?next=${encodeURIComponent(nextPath)}`}>
                Set up authenticator
              </Link>
            </Button>
          </div>
        ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="mfa_challenge_code">Verification code</Label>
            <Input
              ref={inputRef}
              id="mfa_challenge_code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              disabled={isPending || loadingFactor || !factorId}
              onChange={(event) => handleCodeChange(event.target.value)}
              onPaste={handlePaste}
              className="text-center font-mono text-lg tracking-[0.35em]"
              maxLength={CODE_LENGTH}
              aria-invalid={Boolean(error)}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            className="w-full"
            disabled={isPending || loadingFactor || !factorId || code.length !== CODE_LENGTH}
          >
            {isPending ? "Verifying…" : "Verify and continue"}
          </Button>
        </form>
        )}
      </CardContent>
    </Card>
  );
}
