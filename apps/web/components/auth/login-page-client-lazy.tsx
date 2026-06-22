"use client";

import dynamic from "next/dynamic";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Card, CardContent } from "@/components/ui/card";

function LoginClientSkeleton() {
  return (
    <AuthPageShell>
      <Card className="w-full border-border/60 bg-card shadow-md lg:bg-card/95 lg:shadow-lg lg:backdrop-blur-sm">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

const LoginPageClient = dynamic(() => import("@/app/login/login-client"), {
  ssr: false,
  loading: () => <LoginClientSkeleton />,
});

export function LoginPageClientLazy() {
  return <LoginPageClient />;
}
