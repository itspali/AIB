import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, getServiceRoleKeyMismatch } from "@/lib/supabase/admin";

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const keyMismatch = getServiceRoleKeyMismatch();
  if (keyMismatch) {
    return NextResponse.json({ error: keyMismatch }, { status: 400 });
  }

  const parsed = authSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ useClientSignUp: true });
  }

  const { email, password } = parsed.data;

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      provision_deferred: true,
    },
    user_metadata: {
      signup_pending: true,
    },
  });

  if (error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("already") ||
      message.includes("registered") ||
      message.includes("exists")
    ) {
      return NextResponse.json({ success: true, existing: true });
    }
    if (message.includes("database error")) {
      return NextResponse.json(
        {
          error:
            "Database rejected user creation. Deploy migration 20260527180000_create_tenant_signup_initialization.sql to this Supabase project (supabase db push), then retry.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, existing: false });
}
