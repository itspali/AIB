import { Suspense } from "react";
import { SignupPageClientLazy } from "@/components/auth/signup-page-client-lazy";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { SignupProgressSteps } from "@/components/auth/signup-progress-steps";

function SignupFallback() {
  return (
    <AuthPageShell>
      <Card className="w-full border-border/60 bg-card shadow-md lg:bg-card/95 lg:shadow-lg lg:backdrop-blur-sm">
        <CardContent className="pt-6">
          <SignupProgressSteps activeIndex={0} />
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupPageClientLazy />
    </Suspense>
  );
}
