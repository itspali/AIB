import { ConsoleDataTable } from "@/components/console/console-data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireConsoleAccess } from "@/lib/console/require-console";

type SearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] : value;
}

type AuthUserSummary = {
  id: string;
  email: string | undefined;
  created_at: string;
  email_confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};

async function lookupAuthUserByEmail(
  email: string
): Promise<AuthUserSummary | null> {
  const normalized = email.trim().toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const response = await fetch(
    `${url}/auth/v1/admin/users?filter=${encodeURIComponent(`email.eq.${normalized}`)}`,
    {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    users?: Array<{
      id: string;
      email?: string;
      created_at: string;
      email_confirmed_at?: string | null;
      last_sign_in_at?: string | null;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    }>;
  };

  const user = payload.users?.[0];
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    email_confirmed_at: user.email_confirmed_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
  };
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

export default async function ConsoleUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const email = param(sp, "email");

  await requireConsoleAccess("VIEWER");

  const authUser = email ? await lookupAuthUserByEmail(email) : null;

  return (
    <div className="canvas-scroll-endpad space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Auth users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up Supabase Auth accounts by email (service role filter).
        </p>
      </header>

      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="min-w-[18rem] flex-1 space-y-1">
          <label htmlFor="user_email" className="text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            id="user_email"
            name="email"
            type="email"
            defaultValue={email ?? ""}
            placeholder="user@example.com"
            required
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {email && !authUser ? (
        <p className="text-sm text-muted-foreground">No auth user found for {email}.</p>
      ) : null}

      {authUser ? (
        <div className="space-y-4">
          <dl className="surface-panel grid gap-3 p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">User ID</dt>
              <dd className="font-mono text-xs">{authUser.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-medium">{authUser.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email confirmed</dt>
              <dd>
                <Badge variant={authUser.email_confirmed_at ? "completed" : "action_required"}>
                  {authUser.email_confirmed_at ? "Yes" : "No"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd>{formatWhen(authUser.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last sign in</dt>
              <dd>{formatWhen(authUser.last_sign_in_at)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tenant in metadata</dt>
              <dd className="font-mono text-xs">
                {typeof authUser.app_metadata.tenant_id === "string"
                  ? authUser.app_metadata.tenant_id
                  : "—"}
              </dd>
            </div>
          </dl>

          <ConsoleDataTable>
            <thead>
              <tr>
                <th className="text-left">Metadata</th>
                <th className="text-left">Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(authUser.user_metadata).map(([key, value]) => (
                <tr key={`user-${key}`}>
                  <td className="text-muted-foreground">user_metadata.{key}</td>
                  <td className="font-mono text-xs">{JSON.stringify(value)}</td>
                </tr>
              ))}
              {Object.entries(authUser.app_metadata).map(([key, value]) => (
                <tr key={`app-${key}`}>
                  <td className="text-muted-foreground">app_metadata.{key}</td>
                  <td className="font-mono text-xs">{JSON.stringify(value)}</td>
                </tr>
              ))}
            </tbody>
          </ConsoleDataTable>
        </div>
      ) : null}
    </div>
  );
}
