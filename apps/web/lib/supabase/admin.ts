import "server-only";

import { createClient } from "@supabase/supabase-js";

function getProjectRefFromUrl(url: string): string | null {
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

function getProjectRefFromJwt(jwt: string): string | null {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")) as {
      ref?: string;
    };
    return payload.ref ?? null;
  } catch {
    return null;
  }
}

export function getServiceRoleKeyMismatch(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  const urlRef = getProjectRefFromUrl(url);
  const keyRef = getProjectRefFromJwt(serviceRoleKey);

  if (urlRef && keyRef && urlRef !== keyRef) {
    return `SUPABASE_SERVICE_ROLE_KEY belongs to project "${keyRef}" but NEXT_PUBLIC_SUPABASE_URL points to "${urlRef}". Use keys from the same Supabase project.`;
  }

  return null;
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
