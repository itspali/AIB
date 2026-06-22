import { Suspense } from "react";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";

function MfaFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 text-sm text-muted-foreground">
      Loading…
    </div>
  );
}

export default function MfaChallengePage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Suspense fallback={<MfaFallback />}>
        <MfaChallengeForm />
      </Suspense>
    </div>
  );
}
