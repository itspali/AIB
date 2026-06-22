import { Suspense } from "react";
import { LoginPageClientLazy } from "@/components/auth/login-page-client-lazy";
import { AuthPageShell } from "@/components/auth/auth-page-shell";
import { Card, CardContent } from "@/components/ui/card";

function LoginFallback() {
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClientLazy />
    </Suspense>
  );
}
