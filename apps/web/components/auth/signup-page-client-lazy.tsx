"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";
import { SignupProgressSteps } from "@/components/auth/signup-progress-steps";

function SignupClientSkeleton() {
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

const SignupPageClient = dynamic(() => import("@/app/signup/signup-client"), {
  ssr: false,
  loading: () => <SignupClientSkeleton />,
});

export function SignupPageClientLazy() {
  return <SignupPageClient />;
}
