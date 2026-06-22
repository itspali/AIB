"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatAuthError } from "@/lib/auth/format-auth-error";
import { resolvePostLoginRoute } from "@/lib/auth/post-login-route";
import { getTenantIdFromSession } from "@/lib/onboarding/status";
import { COUNTRY_OPTIONS } from "@/lib/onboarding/locale-presets";
import { NEUTRAL_SIGNUP_COPY } from "@/lib/onboarding/business-model";
import { SignupProgressSteps } from "@/components/auth/signup-progress-steps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const signupSchema = z
  .object({
    companyName: z.string().min(1, "Business name is required"),
    adminName: z.string().min(1, "Your name is required"),
    email: z.string().email("Enter a valid work email address"),
    countryCode: z.string().length(2, "Select a country"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Za-z]/, "Password must include at least one letter")
      .regex(/[0-9]/, "Password must include at least one number"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    acceptTerms: z.boolean().refine((value) => value, {
      message: "You must accept the terms and privacy policy",
    }),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

type PageMode = "register" | "resume" | "check_email";

async function createAuthAccountSilent(
  email: string,
  password: string,
  companyName: string,
  adminName: string,
  countryCode: string
) {
  try {
    const response = await fetch("/api/signup/silent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        companyName,
        adminName,
        countryCode,
      }),
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
  values: SignupFormValues
): Promise<{ error: string | null; needsEmailConfirmation?: boolean }> {
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: values.email,
    password: values.password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=/signup?resume=1`,
      data: {
        signup_pending: true,
        company_name: values.companyName,
        admin_name: values.adminName,
        country_code: values.countryCode,
      },
    },
  });

  if (signUpError) {
    const rateLimited =
      signUpError.message.toLowerCase().includes("rate limit") ||
      signUpError.message.toLowerCase().includes("too many requests");

    if (rateLimited || signUpError.message.toLowerCase().includes("already registered")) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
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
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (signInError) {
      if (signInError.message.includes("Email not confirmed")) {
        return { error: null, needsEmailConfirmation: true };
      }
      return { error: formatAuthError(signInError.message) };
    }
  }

  return { error: null };
}

async function initializeWorkspace(
  supabase: ReturnType<typeof createClient>,
  values: SignupFormValues,
  email: string
): Promise<{ error: string | null; tenantId?: string }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Authentication session not found. Please try again." };
  }

  const { data: tenantId, error: rpcError } = await supabase.rpc("initialize_new_tenant", {
    company_name: values.companyName,
    admin_name: values.adminName,
    user_email: email,
    auth_user_id: user.id,
  });

  if (rpcError) {
    return { error: formatAuthError(rpcError.message) };
  }

  if (!tenantId) {
    return { error: "Tenant initialization failed. Please contact support." };
  }

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) {
    return { error: "Workspace created but session refresh failed. Sign in to continue setup." };
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId as string)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const countryCode = values.countryCode.toUpperCase();

  const { error: updateError } = await supabase
    .from("tenants")
    .update({
      country_code: countryCode,
      metadata_json: {
        ...metadata,
        onboarding_draft: {
          ...(typeof metadata.onboarding_draft === "object" && metadata.onboarding_draft !== null
            ? metadata.onboarding_draft
            : {}),
          corporateProfile: {
            country_code: countryCode,
            company_name: values.companyName,
          },
        },
        terms_accepted_at: new Date().toISOString(),
      },
    })
    .eq("id", tenantId as string);

  if (updateError) {
    return { error: "Workspace created but country preferences could not be saved. Update country in onboarding." };
  }

  return { error: null, tenantId: tenantId as string };
}

export default function SignupPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resumeRequested = searchParams.get("resume") === "1";

  const [pending, startTransition] = useTransition();
  const [sessionReady, setSessionReady] = useState(false);
  const [mode, setMode] = useState<PageMode>("register");
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [checkEmailAddress, setCheckEmailAddress] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resumeEmail, setResumeEmail] = useState("");

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      companyName: "",
      adminName: "",
      email: "",
      countryCode: "US",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  const signupCopy = NEUTRAL_SIGNUP_COPY;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (user) {
        const tenantId = await getTenantIdFromSession(supabase);
        if (tenantId) {
          const redirectTo = await resolvePostLoginRoute(supabase, tenantId);
          router.replace(redirectTo);
          return;
        }

        const meta = user.user_metadata ?? {};
        if (meta.company_name) form.setValue("companyName", String(meta.company_name));
        if (meta.admin_name) form.setValue("adminName", String(meta.admin_name));
        if (meta.country_code) form.setValue("countryCode", String(meta.country_code).toUpperCase());
        if (user.email) {
          form.setValue("email", user.email);
          setResumeEmail(user.email);
        }
        setMode("resume");
      } else if (resumeRequested) {
        setError("Sign in to finish workspace setup, or create a new account below.");
      }

      setSessionReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [form, resumeRequested, router]);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setProgressStep(0);

    const runSetup = (values: SignupFormValues, email: string) => {
      startTransition(async () => {
        const supabase = createClient();

        if (mode !== "resume") {
          const silentResult = await createAuthAccountSilent(
            values.email,
            values.password,
            values.companyName,
            values.adminName,
            values.countryCode
          );

          if ("error" in silentResult && silentResult.error) {
            setError(silentResult.error);
            return;
          }

          let authResult: { error: string | null; needsEmailConfirmation?: boolean };

          if ("useClientSignUp" in silentResult && silentResult.useClientSignUp) {
            authResult = await ensureAuthenticatedSession(supabase, values);
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

          if (authResult.needsEmailConfirmation) {
            setCheckEmailAddress(values.email);
            setMode("check_email");
            return;
          }
        }

        setProgressStep(1);
        const initResult = await initializeWorkspace(supabase, values, email);
        if (initResult.error) {
          setError(initResult.error);
          return;
        }

        setProgressStep(2);
        const redirectTo = await resolvePostLoginRoute(supabase, initResult.tenantId!);
        router.push(redirectTo);
        router.refresh();
      });
    };

    if (isResume) {
      const companyName = form.getValues("companyName").trim();
      const adminName = form.getValues("adminName").trim();
      const countryCode = form.getValues("countryCode");
      if (!companyName || !adminName || !countryCode) {
        setError("Business name, your name, and country are required.");
        return;
      }
      runSetup(form.getValues(), resumeEmail || form.getValues("email"));
      return;
    }

    void form.handleSubmit((values) => runSetup(values, values.email))(event);
  };

  const isResume = mode === "resume";

  if (!sessionReady) {
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

  if (mode === "check_email") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Confirm your email</CardTitle>
            <CardDescription>
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{checkEmailAddress}</span>. After you
              confirm, we will continue setup automatically.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="w-full">
              <Link href="/login">Continue after confirming</Link>
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Wrong address?{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setMode("register")}
              >
                Start over
              </button>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {isResume ? signupCopy.resumeTitle : signupCopy.title}
          </CardTitle>
          <CardDescription>
            {isResume ? signupCopy.resumeDescription : signupCopy.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pending ? (
            <SignupProgressSteps activeIndex={progressStep} />
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {signupCopy.businessNameLabel}
                </Label>
                <Input {...form.register("companyName")} placeholder="e.g., Acme Corporation" />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  {signupCopy.nameFieldLabel}
                </Label>
                <Input {...form.register("adminName")} placeholder="Jane Smith" />
                {form.formState.errors.adminName && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.adminName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Country</Label>
                <Select
                  value={form.watch("countryCode")}
                  onValueChange={(value) =>
                    form.setValue("countryCode", value, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.countryCode && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.countryCode.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{signupCopy.countryHelper}</p>
              </div>

              {!isResume && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      Work Email Address
                    </Label>
                    <Input
                      type="email"
                      {...form.register("email")}
                      placeholder="admin@company.com"
                    />
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        {...form.register("password")}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {form.formState.errors.password && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">
                      Confirm Password
                    </Label>
                    <Input
                      type={showPassword ? "text" : "password"}
                      {...form.register("confirmPassword")}
                    />
                    {form.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex items-start gap-3 rounded-md border p-3">
                    <Checkbox
                      id="acceptTerms"
                      checked={form.watch("acceptTerms")}
                      onCheckedChange={(checked) =>
                        form.setValue("acceptTerms", checked === true, { shouldValidate: true })
                      }
                    />
                    <div className="space-y-1">
                      <Label htmlFor="acceptTerms" className="text-sm font-normal leading-snug">
                        I agree to the{" "}
                        <Link
                          href="/legal/terms"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          target="_blank"
                        >
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link
                          href="/legal/privacy"
                          className="font-medium text-primary underline-offset-4 hover:underline"
                          target="_blank"
                        >
                          Privacy Policy
                        </Link>
                        .
                      </Label>
                      {form.formState.errors.acceptTerms && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.acceptTerms.message}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full">
                {isResume ? "Continue setup" : signupCopy.submitLabel}
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign in instead
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
