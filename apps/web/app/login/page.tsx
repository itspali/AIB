import { Suspense } from "react";
import { LoginPageClientLazy } from "@/components/auth/login-page-client-lazy";
import { Card, CardContent } from "@/components/ui/card";

function LoginFallback() {
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

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPageClientLazy />
    </Suspense>
  );
}
