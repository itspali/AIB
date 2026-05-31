/**
 * Smoke test for /settings/organization
 * Run: node scripts/smoke-org-settings.mjs
 * Requires dev server on localhost:3000 and .env.local with Supabase keys.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const ORG_SETTINGS_PATH = "/settings/organization";
const ORG_PAGE_CHUNK = "/_next/static/chunks/app/settings/organization/page.js";

const NAMING_SEQUENCE_KEYS = [
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "STOCK_TRANSFER",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
  "CUSTOMER_PAYMENT",
  "SALES_CREDIT_NOTE",
  "GENERAL_LEDGER",
];

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

function emptyNamingSequences() {
  return Object.fromEntries(NAMING_SEQUENCE_KEYS.map((key) => [key, { prefix: "", digits: "5" }]));
}

function supportedTimezones() {
  try {
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      const values = Intl.supportedValuesOf("timeZone");
      if (values.length > 0) return values;
    }
  } catch {
    // ignore
  }
  return ["America/Chicago", "America/New_York", "Europe/London", "Asia/Kolkata"];
}

function normalizeTimezone(value, countryCode) {
  const candidate = (value ?? "").trim();
  const supported = supportedTimezones();
  if (candidate && supported.includes(candidate)) return candidate;

  const byCountry = {
    US: "America/Chicago",
    IN: "Asia/Kolkata",
    GB: "Europe/London",
    AU: "Australia/Sydney",
    CA: "America/Toronto",
  };
  const fallback = byCountry[countryCode] ?? "America/Chicago";
  return supported.includes(fallback) ? fallback : supported[0];
}

function tenantToFormValues(tenant) {
  const accounting =
    tenant.accounting_config && typeof tenant.accounting_config === "object"
      ? tenant.accounting_config
      : {};
  const lg =
    tenant.location_governance_config && typeof tenant.location_governance_config === "object"
      ? tenant.location_governance_config
      : {};

  return {
    legal_name: tenant.legal_name ?? tenant.name ?? "",
    trade_name: tenant.trade_name ?? "",
    tax_identifier: tenant.tax_identifier ?? "",
    legal_registration_number: tenant.legal_registration_number ?? "",
    primary_email: tenant.primary_email,
    primary_phone:
      tenant.primary_phone && tenant.primary_phone !== "PENDING"
        ? tenant.primary_phone
        : "+15555550100",
    secondary_phone: tenant.secondary_phone ?? "",
    website_url: tenant.website_url ?? "",
    billing_address_line1: tenant.billing_address_line1 ?? "",
    billing_address_line2: tenant.billing_address_line2 ?? "",
    billing_city: tenant.billing_city ?? "",
    billing_state: tenant.billing_state ?? "",
    billing_zip_postal: tenant.billing_zip_postal ?? "",
    billing_country_code: tenant.billing_country_code ?? "",
    country_code: tenant.country_code ?? "US",
    timezone: normalizeTimezone(tenant.timezone, tenant.country_code ?? "US"),
    locale: tenant.locale ?? "en-US",
    base_currency: tenant.base_currency ?? "USD",
    fiscal_year_start_month: String(tenant.fiscal_year_start_month ?? 1),
    logo_url: tenant.logo_url ?? "",
    multi_location_enabled: lg.multi_location_enabled !== false,
    regional_hqs_enabled: Boolean(lg.regional_hqs_enabled),
    central_hq_location_id:
      typeof lg.central_hq_location_id === "string" ? lg.central_hq_location_id : null,
    restrict_cross_warehouse_transfers: lg.consensual_stock_transfers === false,
    naming_sequences: emptyNamingSequences(),
    inventory_valuation_method: accounting.inventory_valuation_method ?? "FIFO",
    allow_negative_inventory: Boolean(accounting.allow_negative_inventory),
    multi_currency_enabled: accounting.multi_currency_enabled !== false,
    credit_control_enforcement:
      accounting.credit_control_enforcement === "WARN" ||
      accounting.credit_control_enforcement === "OFF"
        ? accounting.credit_control_enforcement
        : "STRICT",
    allow_line_item_discounts: true,
    accounting_period_closing_date: "",
    search_financial_fields_mode: "role_default",
    show_advanced: false,
  };
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
  const response = await fetch(`${BASE_URL}${ORG_PAGE_CHUNK}`);
  assert(response.status === 200, `Unable to load org settings action chunk (${response.status})`);
  const source = await response.text();

  /** @type {Record<string, string>} */
  const byName = {};

  for (const match of source.matchAll(/__next_internal_action_entry_do_not_use__ (\{[^}]+\})/g)) {
    const parsed = JSON.parse(match[1].replace(/\\"/g, '"'));
    for (const [id, name] of Object.entries(parsed)) {
      byName[name] = id;
    }
  }

  if (!byName.saveOrganizationSettings) {
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
  const response = await fetch(`${BASE_URL}${ORG_SETTINGS_PATH}`, {
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

async function fetchOrgSettingsHtml(cookieHeader) {
  const response = await fetch(`${BASE_URL}${ORG_SETTINGS_PATH}`, {
    headers: { Cookie: cookieHeader },
  });
  assert(response.status === 200, `Org settings GET expected 200, got ${response.status}`);
  return response.text();
}

async function testUnauthenticatedRedirect() {
  const response = await fetch(`${BASE_URL}${ORG_SETTINGS_PATH}`, { redirect: "manual" });
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
  const email = `smoke-org-${stamp}@example.com`;
  const password = "SmokeTest1!";
  const companyName = `Smoke Org ${stamp}`;
  const adminName = "Smoke Tester";

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
    p_legal_registration_number: "SMOKE-001",
    p_tax_identifier: "00-SMOKE-0001",
    p_location_name: "HQ",
    p_location_code: "HQ",
    p_address_line1: "1 Smoke Test Way",
    p_city: "Austin",
    p_state: "TX",
    p_zip_postal: "78701",
    p_country_code: "US",
  });
  if (profileError) throw new Error(`save_onboarding_corporate_profile: ${profileError.message}`);

  const { data: location, error: locationError } = await supabase
    .from("tenant_locations")
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1)
    .single();
  if (locationError || !location) {
    throw new Error(`tenant location lookup: ${locationError?.message ?? "missing location"}`);
  }

  const accounts = [
    {
      tenant_id: tenantId,
      account_code: "1200-AR",
      account_name: "Accounts Receivable",
      classification: "ASSET",
    },
  ];
  const { error: coaError } = await supabase.from("accounts").insert(accounts);
  if (coaError) throw new Error(`accounts insert: ${coaError.message}`);

  const { error: taxError } = await supabase.from("tax_rate_registry").insert({
    tenant_id: tenantId,
    tax_component_name: "STATE_SALES_TAX",
    tax_percentage: 0,
    active_from_date: new Date().toISOString(),
  });
  if (taxError) throw new Error(`tax insert: ${taxError.message}`);

  const { data: policy, error: policyError } = await supabase
    .from("return_policies")
    .insert({
      tenant_id: tenantId,
      policy_name: "Standard Returns",
      return_window_days: 30,
    })
    .select("id")
    .single();
  if (policyError) throw new Error(`return policy insert: ${policyError.message}`);

  const { error: channelError } = await supabase.from("storefront_channels").insert({
    tenant_id: tenantId,
    name: "Web Store",
    slug: "web-store",
    channel_type: "B2C_ECOMMERCE",
    return_policy_id: policy.id,
  });
  if (channelError) throw new Error(`channel insert: ${channelError.message}`);

  const { error: completeError } = await supabase.rpc("complete_onboarding");
  if (completeError) throw new Error(`complete_onboarding: ${completeError.message}`);

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .single();
  if (tenantError || !tenant) {
    throw new Error(`tenant snapshot: ${tenantError?.message ?? "missing tenant"}`);
  }

  return {
    email,
    password,
    companyName,
    tenantId,
    tenant,
    locationId: location.id,
    session,
    admin,
    ownerUserId: user.id,
  };
}

async function createStaffMember(admin, tenantId, locationId, stamp) {
  const staffEmail = `smoke-staff-${stamp}@example.com`;
  const staffPassword = "SmokeTest1!";
  const { data, error } = await admin.auth.admin.createUser({
    email: staffEmail,
    password: staffPassword,
    email_confirm: true,
    app_metadata: {
      tenant_id: tenantId,
      role: "STAFF",
      assigned_location_id: locationId,
      first_name: "Staff",
      last_name: "Member",
    },
  });
  if (error) throw new Error(`create staff user: ${error.message}`);
  return {
    staffEmail,
    staffPassword,
    staffUserId: data.user.id,
  };
}

async function signInCookieSession(url, anonKey, email, password) {
  const session = createCookieBackedSupabase(url, anonKey);
  const { error } = await session.supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signIn ${email}: ${error.message}`);
  return session;
}

async function testAuthenticatedPage(cookieHeader, companyName) {
  const html = await fetchOrgSettingsHtml(cookieHeader);

  const requiredMarkers = [
    "Organization settings",
    companyName,
    "org-section-identity",
    "org-section-regional",
    "org-section-billing-fiscal",
    "org-section-branding",
    "org-section-locations",
    "org-section-numbering",
    "org-section-accounting",
    "org-section-access",
    "Edit organization settings",
    "ACTIVE",
  ];

  const missing = requiredMarkers.filter((marker) => !html.includes(marker));
  assert(missing.length === 0, `Missing expected page markers: ${missing.join(", ")}`);

  const denied =
    html.includes("Administrative Privileges Required") ||
    html.includes("Unable to load organization settings");
  assert(!denied, "Page rendered access denied or load failure for OWNER user");

  return { name: "Authenticated org settings page renders all sections", ok: true };
}

async function testLoadingRoute(cookieHeader) {
  const response = await fetch(`${BASE_URL}${ORG_SETTINGS_PATH}`, {
    headers: { Cookie: cookieHeader, RSC: "1" },
  });
  assert(response.status === 200, `Loading/RSC fetch expected 200, got ${response.status}`);
  return { name: "Authenticated route returns 200 (RSC)", ok: true };
}

async function testInvalidSaveRejected(cookieHeader, actionIds, tenant) {
  const payload = tenantToFormValues(tenant);
  payload.primary_email = "not-an-email";

  const result = await invokeServerAction(cookieHeader, actionIds.saveOrganizationSettings, [
    payload,
  ]);
  assert("error" in result, "Invalid save should return an error payload");
  assert(
    String(result.error).toLowerCase().includes("email"),
    `Expected email validation error, got: ${result.error}`
  );

  return { name: "Invalid save rejected by server action validation", ok: true };
}

async function testSaveOrganizationSettings(cookieHeader, actionIds, supabase, tenantId, tenant) {
  const updatedTradeName = `Smoke Trade ${Date.now()}`;
  const payload = tenantToFormValues(tenant);
  payload.trade_name = updatedTradeName;

  const result = await invokeServerAction(cookieHeader, actionIds.saveOrganizationSettings, [
    payload,
  ]);
  if ("error" in result) {
    throw new Error(`saveOrganizationSettings failed: ${result.error}`);
  }
  assert(result.success === true, "Expected success from saveOrganizationSettings");

  const { data: refreshed, error } = await supabase
    .from("tenants")
    .select("trade_name")
    .eq("id", tenantId)
    .single();
  if (error) throw new Error(`tenant reload after save: ${error.message}`);
  assert(refreshed.trade_name === updatedTradeName, "Saved trade name not persisted in tenants row");

  const html = await fetchOrgSettingsHtml(cookieHeader);
  assert(html.includes(updatedTradeName), "Saved trade name not reflected on org settings page");

  return { name: "Save organization settings persists and re-renders", ok: true };
}

async function testStaffAccessDenied(staffCookieHeader) {
  const html = await fetchOrgSettingsHtml(staffCookieHeader);
  assert(
    html.includes("Administrative Privileges Required"),
    "STAFF user should see administrative access denied view"
  );
  assert(!html.includes("Edit organization settings"), "STAFF user should not see edit controls");
  return { name: "STAFF user sees administrative access denied view", ok: true };
}

async function testDelegateGrantAndRevoke(ownerCookieHeader, staffCookieHeader, actionIds, staffUserId) {
  const grantResult = await invokeServerAction(
    ownerCookieHeader,
    actionIds.grantOrganizationSettingsDelegate,
    [{ user_id: staffUserId }]
  );
  if ("error" in grantResult) {
    throw new Error(`grantOrganizationSettingsDelegate failed: ${grantResult.error}`);
  }

  const delegatedHtml = await fetchOrgSettingsHtml(staffCookieHeader);
  assert(
    delegatedHtml.includes("Organization settings") && delegatedHtml.includes("org-section-identity"),
    "Delegated STAFF user should load org settings sections"
  );
  assert(
    !delegatedHtml.includes("Administrative Privileges Required"),
    "Delegated STAFF user should not see access denied view"
  );

  const revokeResult = await invokeServerAction(
    ownerCookieHeader,
    actionIds.revokeOrganizationSettingsDelegate,
    [staffUserId]
  );
  if ("error" in revokeResult) {
    throw new Error(`revokeOrganizationSettingsDelegate failed: ${revokeResult.error}`);
  }

  const revokedHtml = await fetchOrgSettingsHtml(staffCookieHeader);
  assert(
    revokedHtml.includes("Administrative Privileges Required"),
    "STAFF user should lose access after delegate revocation"
  );

  return { name: "Delegate grant and revoke toggles STAFF org settings access", ok: true };
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
  let staff = null;
  const cleanupUserIds = [];

  try {
    results.push(await testUnauthenticatedRedirect());

    provisioned = await provisionSmokeTenant(url, anonKey, serviceKey);
    cleanupUserIds.push(provisioned.ownerUserId);

    const ownerCookieHeader = provisioned.session.cookieHeader();
    assert(ownerCookieHeader.length > 0, "Expected auth cookies after provisioning");

    const actionIds = await discoverActionIds();
    assert(actionIds.saveOrganizationSettings, "Missing saveOrganizationSettings action id");
    assert(
      actionIds.grantOrganizationSettingsDelegate,
      "Missing grantOrganizationSettingsDelegate action id"
    );
    assert(
      actionIds.revokeOrganizationSettingsDelegate,
      "Missing revokeOrganizationSettingsDelegate action id"
    );

    results.push(await testAuthenticatedPage(ownerCookieHeader, provisioned.companyName));
    results.push(await testLoadingRoute(ownerCookieHeader));
    results.push(
      await testInvalidSaveRejected(ownerCookieHeader, actionIds, provisioned.tenant)
    );
    results.push(
      await testSaveOrganizationSettings(
        ownerCookieHeader,
        actionIds,
        provisioned.session.supabase,
        provisioned.tenantId,
        provisioned.tenant
      )
    );

    staff = await createStaffMember(
      provisioned.admin,
      provisioned.tenantId,
      provisioned.locationId,
      Date.now()
    );
    cleanupUserIds.push(staff.staffUserId);

    const staffSession = await signInCookieSession(url, anonKey, staff.staffEmail, staff.staffPassword);
    results.push(await testStaffAccessDenied(staffSession.cookieHeader()));
    results.push(
      await testDelegateGrantAndRevoke(
        ownerCookieHeader,
        staffSession.cookieHeader(),
        actionIds,
        staff.staffUserId
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
    if (provisioned?.admin && cleanupUserIds.length > 0) {
      await cleanup(provisioned.admin, cleanupUserIds);
    }
  }

  console.log("\nOrg settings smoke test — PASSED\n");
  for (const result of results) {
    console.log(`  ✓ ${result.name}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("\nOrg settings smoke test — FAILED\n");
  console.error(`  ✗ ${error.message}`);
  process.exit(1);
});
