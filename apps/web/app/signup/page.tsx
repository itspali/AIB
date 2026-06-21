import { Suspense } from "react";
import { SignupPageClientLazy } from "@/components/auth/signup-page-client-lazy";
import { Card, CardContent } from "@/components/ui/card";
import { SignupProgressSteps } from "@/components/auth/signup-progress-steps";

function SignupFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <SignupProgressSteps activeIndex={0} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupPageClientLazy />
    </Suspense>
  );
}
