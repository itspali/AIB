"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const signupSchema = z.object({
  companyName: z.string().min(1, "Organization name is required"),
  adminName: z.string().min(1, "Administrator name is required"),
  email: z.string().email("Enter a valid work email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function formatAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Supabase auth rate limit reached for this project/IP. Add SUPABASE_SERVICE_ROLE_KEY to .env.local (see README), wait ~1 hour, or sign in if you already registered.";
  }
  if (lower.includes("already registered") || lower.includes("already been registered")) {
    return "This email is already registered. Sign in instead, or use a different email.";
  }
  return message;
}

async function createAuthAccountSilent(email: string, password: string) {
  try {
    const response = await fetch("/api/signup/silent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      return { error: payload?.error ?? "Unable to create account. Please try again." };
    }

    return (await response.json()) as
      | { useClientSignUp: true }
      | { success: true; existing: boolean }
      | { error: string };
  } catch {
    return {
      error: "Unable to reach the signup service. Restart the dev server and try again.",
    };
  }
}

async function ensureAuthenticatedSession(
  supabase: ReturnType<typeof createClient>,
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        signup_pending: true,
      },
    },
  });

  if (signUpError) {
    const rateLimited =
      signUpError.message.toLowerCase().includes("rate limit") ||
      signUpError.message.toLowerCase().includes("too many requests");

    if (rateLimited || signUpError.message.toLowerCase().includes("already registered")) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (!signInError) {
        return { error: null };
      }
    }

    return { error: formatAuthError(signUpError.message) };
  }

  if (!signUpData.user) {
    return { error: "Registration failed. Please try again." };
  }

  if (!signUpData.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      return {
        error: signInError.message.includes("Email not confirmed")
          ? "Please confirm your email before continuing, or disable email confirmation in Supabase Auth."
          : formatAuthError(signInError.message),
      };
    }
  }

  return { error: null };
}

function FormFieldSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: "",
      adminName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();

      const silentResult = await createAuthAccountSilent(values.email, values.password);

      if ("error" in silentResult && silentResult.error) {
        setError(silentResult.error);
        return;
      }

      let authResult: { error: string | null };

      if ("useClientSignUp" in silentResult && silentResult.useClientSignUp) {
        authResult = await ensureAuthenticatedSession(supabase, values.email, values.password);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        authResult = signInError
          ? { error: formatAuthError(signInError.message) }
          : { error: null };
      }

      if (authResult.error) {
        setError(authResult.error);
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Authentication session not found. Please try again.");
        return;
      }

      const { data: tenantId, error: rpcError } = await supabase.rpc("initialize_new_tenant", {
        company_name: values.companyName,
        admin_name: values.adminName,
        user_email: values.email,
        auth_user_id: user.id,
      });

      if (rpcError) {
        setError(formatAuthError(rpcError.message));
        return;
      }

      if (!tenantId) {
        setError("Tenant initialization failed. Please contact support.");
        return;
      }

      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        setError("Workspace created but session refresh failed. Sign in to continue setup.");
        return;
      }

      const redirectTo = await resolvePostLoginRoute(supabase, tenantId as string);
      router.push(redirectTo);
      router.refresh();
    });
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Create Your Company Workspace
          </CardTitle>
          <CardDescription>
            Initialize your secure, dedicated organization environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending ? (
            <div className="space-y-4" aria-busy="true" aria-label="Creating workspace">
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <FormFieldSkeleton />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Organization Name
                </Label>
                <Input
                  {...form.register("companyName")}
                  placeholder="e.g., Global Trading Corp"
                  className="transition-colors duration-200 focus-visible:ring-2"
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Administrator Name
                </Label>
                <Input
                  {...form.register("adminName")}
                  placeholder="Jane Smith"
                  className="transition-colors duration-200 focus-visible:ring-2"
                />
                {form.formState.errors.adminName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.adminName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Work Email Address
                </Label>
                <Input
                  type="email"
                  {...form.register("email")}
                  placeholder="admin@company.com"
                  className="transition-colors duration-200 focus-visible:ring-2"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    {...form.register("password")}
                    className="pr-10 transition-colors duration-200 focus-visible:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors duration-200 hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full transition-colors duration-200">
                Create Workspace & Begin Setup
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 transition-colors duration-200 hover:underline"
            >
              Sign in instead
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
