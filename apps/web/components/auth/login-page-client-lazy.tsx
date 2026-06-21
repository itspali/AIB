"use client";

import dynamic from "next/dynamic";
import { Card, CardContent } from "@/components/ui/card";

function LoginClientSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    </div>
  );
}

const LoginPageClient = dynamic(() => import("@/app/login/login-client"), {
  ssr: false,
  loading: () => <LoginClientSkeleton />,
});

export function LoginPageClientLazy() {
  return <LoginPageClient />;
}
