import { redirect } from "next/navigation";
import { Suspense } from "react";
import ResetPasswordClient from "./reset-password-client";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionClaims } from "@/lib/supabase/auth";

function ResetPasswordFallback() {
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

export default async function ResetPasswordPage() {
  const claims = await getSessionClaims();
  if (!claims?.userId) {
    redirect("/login?error=auth_callback_failed");
  }

  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
