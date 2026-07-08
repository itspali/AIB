/**
 * Smoke test for /settings/group
 * Run: node scripts/smoke-group-settings.mjs
 * Requires dev server on localhost:3000 and .env.local with Supabase keys.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const GROUP_SETTINGS_PATH = "/settings/enterprise";
const GROUP_PAGE_CHUNK = "/_next/static/chunks/app/(workspace)/settings/enterprise/page.js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createCookieBackedSupabase(url, anonKey) {
  /** @type {{ name: string; value: string }[]} */
  let cookies = [];

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookies;
      },
      setAll(cookiesToSet) {
        cookies = cookiesToSet.map(({ name, value }) => ({ name, value }));
      },
    },
  });

  return {
    supabase,
    cookieHeader() {
      return cookies.map(({ name, value }) => `${name}=${value}`).join("; ");
    },
  };
}

async function discoverActionIds() {
  const response = await fetch(`${BASE_URL}${GROUP_PAGE_CHUNK}`);
  assert(response.status === 200, `Unable to load group settings action chunk (${response.status})`);
  const source = await response.text();

  /** @type {Record<string, string>} */
  const byName = {};

  for (const match of source.matchAll(/__next_internal_action_entry_do_not_use__ (\{[^}]+\})/g)) {
    const parsed = JSON.parse(match[1].replace(/\\"/g, '"'));
    for (const [id, name] of Object.entries(parsed)) {
      byName[name] = id;
    }
  }

  if (!byName.createTenantGroup) {
    for (const match of source.matchAll(
      /createServerReference\)\("([0-9a-f]+)"[\s\S]*?"([a-zA-Z]+)"\)/g
    )) {
      byName[match[2]] = match[1];
    }
  }

  return byName;
}

function parseActionResponse(text) {
  for (const line of text.split("\n")) {
    if (line.startsWith("1:")) {
      return JSON.parse(line.slice(2));
    }
  }
  throw new Error("Server action response missing result payload");
}

async function invokeServerAction(cookieHeader, actionId, args) {
  const response = await fetch(`${BASE_URL}${GROUP_SETTINGS_PATH}`, {
    method: "POST",
    headers: {
      Cookie: cookieHeader,
      "Content-Type": "text/plain;charset=UTF-8",
      "Next-Action": actionId,
      Accept: "text/x-component",
    },
    body: JSON.stringify(args),
  });
  assert(response.status === 200, `Server action POST expected 200, got ${response.status}`);
  return parseActionResponse(await response.text());
}

async function fetchGroupSettingsHtml(cookieHeader) {
  const response = await fetch(`${BASE_URL}${GROUP_SETTINGS_PATH}`, {
    headers: { Cookie: cookieHeader },
  });
  assert(response.status === 200, `Group settings GET expected 200, got ${response.status}`);
  return response.text();
}

async function testUnauthenticatedRedirect() {
  const response = await fetch(`${BASE_URL}${GROUP_SETTINGS_PATH}`, { redirect: "manual" });
  assert(response.status === 307 || response.status === 302, `Expected redirect, got ${response.status}`);
  const location = response.headers.get("location") ?? "";
  assert(location.includes("/login"), `Expected /login redirect, got ${location}`);
  return { name: "Unauthenticated redirect to login", ok: true };
}

async function provisionSmokeTenant(url, anonKey, serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const email = `smoke-group-${stamp}@example.com`;
  const password = "SmokeTest1!";
  const companyName = `Smoke Group Org ${stamp}`;
  const adminName = "Smoke Group Tester";

  const silentResponse = await fetch(`${BASE_URL}/api/signup/silent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      companyName,
      adminName,
      countryCode: "US",
    }),
  });
  const silentPayload = await silentResponse.json().catch(() => ({}));
  if (!silentResponse.ok) {
    throw new Error(`silent signup: ${silentPayload.error ?? silentResponse.status}`);
  }

  const session = createCookieBackedSupabase(url, anonKey);
  const { supabase } = session;

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No user after sign-in");

  const { data: tenantId, error: initError } = await supabase.rpc("initialize_new_tenant", {
    company_name: companyName,
    admin_name: adminName,
    user_email: email,
    auth_user_id: user.id,
  });
  if (initError) throw new Error(`initialize_new_tenant: ${initError.message}`);
  if (!tenantId) throw new Error("initialize_new_tenant returned no tenant id");

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw new Error(`refreshSession: ${refreshError.message}`);

  const { error: profileError } = await supabase.rpc("save_onboarding_corporate_profile", {
    p_company_name: companyName,
    p_legal_registration_number: "SMOKE-G-001",
    p_tax_identifier: "00-SMOKE-G-001",
    p_location_name: "HQ",
    p_location_code: "HQ",
    p_address_line1: "1 Group Test Way",
    p_city: "Austin",
    p_state: "TX",
    p_zip_postal: "78701",
    p_country_code: "US",
  });
  if (profileError) throw new Error(`save_onboarding_corporate_profile: ${profileError.message}`);

  const { error: completeError } = await supabase.rpc("complete_onboarding");
  if (completeError) throw new Error(`complete_onboarding: ${completeError.message}`);

  return {
    email,
    password,
    companyName,
    tenantId,
    session,
    admin,
    ownerUserId: user.id,
  };
}

async function testEmptyGroupState(cookieHeader) {
  const html = await fetchGroupSettingsHtml(cookieHeader);
  const requiredMarkers = ["Enterprise group", "Create a group", "Create group"];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  assert(missing.length === 0, `Missing empty-state markers: ${missing.join(", ")}`);
  return { name: "Empty group state renders create flow", ok: true };
}

async function testCreateGroup(cookieHeader, actionIds, email, companyName) {
  const groupName = `Smoke Holdings ${Date.now()}`;
  const result = await invokeServerAction(cookieHeader, actionIds.createTenantGroup, [
    {
      name: groupName,
      primary_email: email,
    },
  ]);
  if ("error" in result) {
    throw new Error(`createTenantGroup failed: ${result.error}`);
  }
  assert(result.success === true, "Expected success from createTenantGroup");

  const html = await fetchGroupSettingsHtml(cookieHeader);
  const requiredMarkers = [groupName, "Group identity", "Organizations", companyName];
  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  assert(missing.length === 0, `Missing post-create markers: ${missing.join(", ")}`);

  return { name: "Create group links founding org and renders settings", ok: true, groupName };
}

async function testCreateSubsidiary(cookieHeader, actionIds, supabase, groupId) {
  const subsidiaryName = `Smoke Subsidiary ${Date.now()}`;
  const subsidiaryEmail = `subsidiary-${Date.now()}@example.com`;

  const result = await invokeServerAction(cookieHeader, actionIds.createGroupOrganization, [
    {
      group_id: groupId,
      company_name: subsidiaryName,
      primary_email: subsidiaryEmail,
      primary_phone: "+15555550101",
    },
  ]);
  if ("error" in result) {
    throw new Error(`createGroupOrganization failed: ${result.error}`);
  }
  assert(result.success === true, "Expected success from createGroupOrganization");

  const { data: orgs, error } = await supabase.rpc("list_group_organizations", {
    p_group_id: groupId,
  });
  if (error) throw new Error(`list_group_organizations: ${error.message}`);
  assert(
    (orgs ?? []).some((row) => (row.trade_name || row.name) === subsidiaryName),
    "Subsidiary not returned by list_group_organizations"
  );

  const html = await fetchGroupSettingsHtml(cookieHeader);
  assert(html.includes(subsidiaryName), "Subsidiary name not reflected on group settings page");

  return { name: "Create subsidiary organization under group", ok: true };
}

async function testSaveGroupSettings(cookieHeader, actionIds, supabase, groupId, groupName) {
  const updatedTradeName = `Smoke Trade ${Date.now()}`;
  const result = await invokeServerAction(cookieHeader, actionIds.saveGroupSettings, [
    {
      group_id: groupId,
      name: groupName,
      legal_name: groupName,
      trade_name: updatedTradeName,
      primary_email: "group-contact@example.com",
      primary_phone: "+15555550100",
    },
  ]);
  if ("error" in result) {
    throw new Error(`saveGroupSettings failed: ${result.error}`);
  }
  assert(result.success === true, "Expected success from saveGroupSettings");

  const { data: group, error } = await supabase
    .from("tenant_groups")
    .select("trade_name")
    .eq("id", groupId)
    .single();
  if (error) throw new Error(`tenant_groups reload: ${error.message}`);
  assert(group.trade_name === updatedTradeName, "Saved trade name not persisted");

  return { name: "Save group settings persists profile", ok: true };
}

async function cleanup(admin, userIds) {
  for (const userId of userIds) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // best-effort cleanup
    }
  }
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY — required to provision smoke tenant");
  }

  const results = [];
  let provisioned = null;

  try {
    results.push(await testUnauthenticatedRedirect());

    provisioned = await provisionSmokeTenant(url, anonKey, serviceKey);
    const cookieHeader = provisioned.session.cookieHeader();
    assert(cookieHeader.length > 0, "Expected auth cookies after provisioning");

    const actionIds = await discoverActionIds();
    assert(actionIds.createTenantGroup, "Missing createTenantGroup action id");
    assert(actionIds.createGroupOrganization, "Missing createGroupOrganization action id");
    assert(actionIds.saveGroupSettings, "Missing saveGroupSettings action id");

    results.push(await testEmptyGroupState(cookieHeader));

    const createResult = await testCreateGroup(
      cookieHeader,
      actionIds,
      provisioned.email,
      provisioned.companyName
    );
    results.push(createResult);

    const { data: groupRow, error: groupLookupError } = await provisioned.session.supabase
      .from("tenant_groups")
      .select("id")
      .eq("name", createResult.groupName)
      .single();
    if (groupLookupError || !groupRow) {
      throw new Error(`group lookup: ${groupLookupError?.message ?? "missing group"}`);
    }

    results.push(
      await testCreateSubsidiary(
        cookieHeader,
        actionIds,
        provisioned.session.supabase,
        groupRow.id
      )
    );
    results.push(
      await testSaveGroupSettings(
        cookieHeader,
        actionIds,
        provisioned.session.supabase,
        groupRow.id,
        createResult.groupName
      )
    );
  } catch (error) {
    if (results.length > 0) {
      console.error("\nCompleted before failure:");
      for (const result of results) {
        console.error(`  ✓ ${result.name}`);
      }
    }
    throw error;
  } finally {
    if (provisioned?.admin && provisioned.ownerUserId) {
      await cleanup(provisioned.admin, [provisioned.ownerUserId]);
    }
  }

  console.log("\nGroup settings smoke test — PASSED\n");
  for (const result of results) {
    console.log(`  ✓ ${result.name}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("\nGroup settings smoke test — FAILED\n");
  console.error(`  ✗ ${error.message}`);
  process.exit(1);
});
