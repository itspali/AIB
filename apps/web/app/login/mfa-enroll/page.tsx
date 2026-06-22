"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ConsoleMfaEnroll } from "@/components/console/console-mfa-enroll";
import { createClient } from "@/lib/supabase/client";

function MfaEnrollFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

function MfaEnrollContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/console";

  useEffect(() => {
    void (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.mfa.listFactors();
      const hasVerified = (data?.totp ?? []).some((factor) => factor.status === "verified");
      if (hasVerified) {
        router.replace(`/login/mfa-challenge?next=${encodeURIComponent(redirectTo)}`);
      }
    })();
  }, [redirectTo, router]);

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <header className="space-y-1 px-1">
        <h1 className="text-xl font-bold tracking-tight">Set up authenticator</h1>
        <p className="text-sm text-muted-foreground">
          Scan the QR code with Google Authenticator, Authy, or any TOTP app to secure console
          access.
        </p>
      </header>
      <ConsoleMfaEnroll redirectTo={redirectTo} />
    </div>
  );
}

export default function MfaEnrollPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<MfaEnrollFallback />}>
        <MfaEnrollContent />
      </Suspense>
    </div>
  );
}
