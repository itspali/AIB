/**
 * Smoke test: PO → GRN → Bills procurement flow
 * Run: node scripts/smoke-procurement.mjs
 * Requires dev server on localhost:3000 and .env.local with Supabase keys.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

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

async function provisionSmokeTenant(url, anonKey, serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const stamp = Date.now();
  const email = `smoke-proc-${stamp}@example.com`;
  const password = "SmokeTest1!";
  const companyName = `Smoke Procurement ${stamp}`;
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

  const { data: tenantRow, error: tenantFetchError } = await admin
    .from("tenants")
    .select("accounting_config")
    .eq("id", tenantId)
    .single();
  if (tenantFetchError) throw new Error(`tenant fetch: ${tenantFetchError.message}`);

  const accountingConfig =
    tenantRow?.accounting_config && typeof tenantRow.accounting_config === "object"
      ? tenantRow.accounting_config
      : {};
  const { error: tenantPatchError } = await admin
    .from("tenants")
    .update({
      accounting_config: {
        ...accountingConfig,
        inventory_valuation_method: "MWAC",
      },
    })
    .eq("id", tenantId);
  if (tenantPatchError) throw new Error(`tenant MWAC patch: ${tenantPatchError.message}`);

  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw new Error(`refreshSession: ${refreshError.message}`);

  const { error: profileError } = await supabase.rpc("save_onboarding_corporate_profile", {
    p_company_name: companyName,
    p_legal_registration_number: "SMOKE-PROC-001",
    p_tax_identifier: "00-SMOKE-PROC-01",
    p_location_name: "HQ Warehouse",
    p_location_code: "HQ",
    p_address_line1: "1 Procurement Test Way",
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

async function configureLocationDocumentNaming(supabase, locationId) {
  const year = new Date().getFullYear();
  const naming_sequences = {
    PURCHASE_ORDER: { prefix: `PO-${year}-`, digits: 5, next: 1 },
    GOODS_RECEIPT_NOTE: { prefix: `GRN-${year}-`, digits: 5, next: 1 },
    PURCHASE_INVOICE: { prefix: `PI-${year}-`, digits: 5, next: 1 },
  };

  const { data: location, error: fetchError } = await supabase
    .from("tenant_locations")
    .select("name, code, address_line1, city, state, zip_postal, country_code, location_meta")
    .eq("id", locationId)
    .single();
  if (fetchError || !location) {
    throw new Error(`location fetch for naming: ${fetchError?.message ?? "missing"}`);
  }

  const existingMeta =
    location.location_meta && typeof location.location_meta === "object"
      ? location.location_meta
      : {};
  const configurationMetadata =
    existingMeta.configuration_metadata && typeof existingMeta.configuration_metadata === "object"
      ? existingMeta.configuration_metadata
      : {};

  const locationMeta = {
    ...existingMeta,
    configuration_metadata: {
      ...configurationMetadata,
      naming_sequences,
    },
  };

  const { error } = await supabase.rpc("save_tenant_location", {
    p_location_id: locationId,
    p_name: location.name,
    p_code: location.code,
    p_address_line1: location.address_line1,
    p_city: location.city,
    p_state: location.state,
    p_zip_postal: location.zip_postal,
    p_country_code: location.country_code,
    p_is_stock_holding: true,
    p_location_meta: locationMeta,
  });
  if (error) throw new Error(`save_tenant_location (naming): ${error.message}`);
}

  const { error: coaError } = await supabase.from("accounts").insert({
    tenant_id: tenantId,
    account_code: "1200-AR",
    account_name: "Accounts Receivable",
    classification: "ASSET",
  });
  if (coaError) throw new Error(`accounts insert: ${coaError.message}`);

  const { error: taxError } = await supabase.from("tax_codes").insert({
    tenant_id: tenantId,
    code: "ZERO",
    name: "Zero Tax",
    kind: "ZERO",
    rate: 0,
    is_inclusive_default: false,
    is_variable: false,
    effective_from: new Date().toISOString().slice(0, 10),
    is_active: true,
  });
  if (taxError) throw new Error(`tax_codes insert: ${taxError.message}`);

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

  await configureLocationDocumentNaming(supabase, location.id);

  return {
    email,
    password,
    companyName,
    tenantId,
    locationId: location.id,
    session,
    admin,
    ownerUserId: user.id,
  };
}

async function ensureSupplierCategory(supabase) {
  const { data: existing } = await supabase
    .from("entity_supplier_categories")
    .select("id")
    .eq("name", "General")
    .is("parent_id", null)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: categoryId, error } = await supabase.rpc("save_entity_supplier_category", {
    p_name: "General",
  });
  if (error) throw new Error(`save_entity_supplier_category: ${error.message}`);
  return categoryId;
}

async function createSupplier(supabase) {
  const supplierCategoryId = await ensureSupplierCategory(supabase);
  const { data: supplierId, error } = await supabase.rpc("save_entity_profile", {
    p_entity: {
      name: "Smoke Test Supplier",
      type: "SUPPLIER",
      tax_treatment: "REGULAR_B2B",
      tax_registration_number: "SUP-123456789",
      supplier_category_id: supplierCategoryId,
      billing_address_line1: "100 Vendor Lane",
      billing_city: "Austin",
      billing_state: "TX",
      billing_zip_postal: "78701",
      billing_country_code: "US",
      is_active: true,
    },
  });
  if (error) throw new Error(`save_entity_profile (supplier): ${error.message}`);
  return supplierId;
}

async function createTrackInventoryProduct(supabase, stamp) {
  const sku = `SMK-PROC-${stamp}`;
  const { data: itemId, error } = await supabase.rpc("save_product_master_profile", {
    p_name: `Smoke Widget ${stamp}`,
    p_classification: "PHYSICAL_GOOD",
    p_base_uom: "EA",
    p_sku: sku,
    p_is_purchasable: true,
    p_is_salable: true,
    p_has_variants: false,
    p_item_type: "PHYSICAL",
    p_track_inventory: true,
    p_tracking_mode: "NONE",
    p_is_bundle: false,
    p_purchase_price: 10,
    p_selling_price: 15,
  });
  if (error) throw new Error(`save_product_master_profile: ${error.message}`);

  const { data: variant, error: variantError } = await supabase
    .from("item_variants")
    .select("id")
    .eq("item_id", itemId)
    .limit(1)
    .single();
  if (variantError || !variant) {
    throw new Error(`variant lookup: ${variantError?.message ?? "missing variant"}`);
  }

  return { itemId, variantId: variant.id, sku };
}

function parseRpcSteps(data) {
  if (!data || typeof data !== "object") return [];
  const steps = data.steps ?? data;
  return Array.isArray(steps) ? steps : [];
}

function stepKeys(steps) {
  return steps.map((s) => s.id ?? s.step_key ?? s.key ?? s.stepKey).filter(Boolean);
}

async function testProcurementFlow(ctx) {
  const { supabase, userId, locationId } = ctx;
  const stamp = Date.now();
  const unitPrice = 10;
  const qty = 5;

  const supplierId = await createSupplier(supabase);
  const { variantId } = await createTrackInventoryProduct(supabase, stamp);

  const { data: poId, error: savePoError } = await supabase.rpc("save_purchase_order", {
    p_purchase_order_id: null,
    p_destination_location_id: locationId,
    p_supplier_id: supplierId,
    p_lines: [
      {
        variant_id: variantId,
        quantity_ordered: qty,
        unit_price_contractual: unitPrice,
        discount_percentage: 0,
        discount_amount: 0,
      },
    ],
    p_created_by: userId,
    p_payment_terms_days: 30,
    p_custom_fields: {},
    p_currency_code: "USD",
    p_prices_tax_inclusive: false,
  });
  if (savePoError) throw new Error(`save_purchase_order: ${savePoError.message}`);
  assert(poId, "save_purchase_order returned no id");

  const { data: poRow, error: poFetchError } = await supabase
    .from("purchase_orders")
    .select("id, document_status, voucher_number")
    .eq("id", poId)
    .single();
  if (poFetchError) throw new Error(`purchase_orders fetch: ${poFetchError.message}`);
  assert(poRow.document_status === "DRAFT", `Expected DRAFT PO, got ${poRow.document_status}`);

  const { data: poItems, error: poItemsError } = await supabase
    .from("purchase_order_items")
    .select("id, variant_id, quantity_ordered, unit_price_contractual")
    .eq("purchase_order_id", poId);
  if (poItemsError) throw new Error(`purchase_order_items fetch: ${poItemsError.message}`);
  assert(poItems?.length === 1, "Expected one PO line");

  const poItemId = poItems[0].id;

  const { data: issueResult, error: issueError } = await supabase.rpc("issue_purchase_order", {
    p_purchase_order_id: poId,
  });
  if (issueError) throw new Error(`issue_purchase_order: ${issueError.message}`);

  const issueSteps = parseRpcSteps(issueResult);
  assert(
    stepKeys(issueSteps).includes("po_status_issued"),
    `Expected po_status_issued step, got: ${stepKeys(issueSteps).join(", ")}`
  );

  const { data: issuedPo, error: issuedPoError } = await supabase
    .from("purchase_orders")
    .select("document_status")
    .eq("id", poId)
    .single();
  if (issuedPoError) throw new Error(`issued PO fetch: ${issuedPoError.message}`);
  assert(
    issuedPo.document_status === "ISSUED_ACTIVE",
    `Expected ISSUED_ACTIVE, got ${issuedPo.document_status}`
  );

  const { data: grnResult, error: grnError } = await supabase.rpc("post_goods_receipt", {
    p_destination_location_id: locationId,
    p_purchase_order_id: poId,
    p_lines: [
      {
        variant_id: variantId,
        po_item_id: poItemId,
        quantity_received: qty,
        raw_unit_cost: unitPrice,
        is_promotional: false,
      },
    ],
    p_created_by: userId,
    p_landed_charges: [],
  });
  if (grnError) throw new Error(`post_goods_receipt: ${grnError.message}`);

  const grnId = grnResult?.goods_receipt_id ?? grnResult?.goodsReceiptId;
  assert(grnId, "post_goods_receipt returned no goods_receipt_id");

  const grnSteps = parseRpcSteps(grnResult);
  const grnStepKeys = stepKeys(grnSteps);
  assert(
    grnStepKeys.includes("grn_receipt_recorded"),
    `Expected grn_receipt_recorded step, got: ${grnStepKeys.join(", ")}`
  );
  assert(
    grnStepKeys.includes("grn_paid_stock_valued"),
    `Expected grn_paid_stock_valued step, got: ${grnStepKeys.join(", ")}`
  );

  const { data: grnRow, error: grnFetchError } = await supabase
    .from("goods_receipts")
    .select("id, voucher_number, purchase_order_id")
    .eq("id", grnId)
    .single();
  if (grnFetchError) throw new Error(`goods_receipts fetch: ${grnFetchError.message}`);
  assert(grnRow.purchase_order_id === poId, "GRN not linked to PO");

  const { data: billId, error: billError } = await supabase.rpc("save_purchase_invoice", {
    p_purchase_invoice_id: null,
    p_supplier_id: supplierId,
    p_billing_location_id: locationId,
    p_invoice_number_vendor: `VINV-${stamp}`,
    p_lines: [
      {
        variant_id: variantId,
        purchase_order_item_id: poItemId,
        quantity_billed: qty,
        unit_price_billed: unitPrice,
      },
    ],
    p_created_by: userId,
    p_purchase_order_id: poId,
    p_currency_code: "USD",
    p_goods_receipt_ids: [grnId],
  });
  if (billError) throw new Error(`save_purchase_invoice: ${billError.message}`);
  assert(billId, "save_purchase_invoice returned no id");

  const { data: billRow, error: billFetchError } = await supabase
    .from("purchase_invoices")
    .select("id, match_status, purchase_order_id, total_gross_amount")
    .eq("id", billId)
    .single();
  if (billFetchError) throw new Error(`purchase_invoices fetch: ${billFetchError.message}`);
  assert(billRow.match_status === "MATCHED", `Expected MATCHED bill, got ${billRow.match_status}`);
  assert(Number(billRow.total_gross_amount) === qty * unitPrice, "Bill gross amount mismatch");

  const { data: billReceiptLink, error: linkError } = await supabase
    .from("purchase_invoice_receipts")
    .select("goods_receipt_id")
    .eq("purchase_invoice_id", billId);
  if (linkError) throw new Error(`purchase_invoice_receipts fetch: ${linkError.message}`);
  assert(
    billReceiptLink?.some((r) => r.goods_receipt_id === grnId),
    "Bill not linked to GRN"
  );

  const { data: postingRun, error: postingError } = await supabase
    .from("document_posting_runs")
    .select("document_type, overall_status, steps")
    .eq("document_id", billId)
    .eq("document_type", "BILL")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (postingError) throw new Error(`document_posting_runs fetch: ${postingError.message}`);
  assert(postingRun, "Missing BILL document_posting_runs row");
  assert(postingRun.overall_status === "success", `Bill posting status: ${postingRun.overall_status}`);

  const billPostingKeys = stepKeys(parseRpcSteps(postingRun));
  assert(
    billPostingKeys.includes("bill_invoice_recorded"),
    `Expected bill_invoice_recorded, got: ${billPostingKeys.join(", ")}`
  );
  assert(
    billPostingKeys.includes("bill_three_way_match"),
    `Expected bill_three_way_match, got: ${billPostingKeys.join(", ")}`
  );

  return {
    poId,
    poVoucher: poRow.voucher_number,
    grnId,
    grnVoucher: grnRow.voucher_number,
    billId,
    issueSteps: stepKeys(issueSteps),
    grnSteps: grnStepKeys,
    billSteps: billPostingKeys,
  };
}

async function testProcurementPages(cookieHeader) {
  const paths = [
    "/procurement/purchase-orders",
    "/procurement/goods-receipts",
    "/procurement/bills",
  ];

  for (const path of paths) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { Cookie: cookieHeader },
      redirect: "manual",
    });
    assert(
      response.status === 200,
      `${path} expected 200 for authenticated user, got ${response.status}`
    );
    const html = await response.text();
    assert(!html.includes("/login"), `${path} redirected to login`);
    assert(
      !html.includes("Administrative Privileges Required"),
      `${path} showed access denied`
    );
  }

  return { name: "Procurement pages load for authenticated owner", ok: true };
}

async function cleanup(admin, userIds) {
  for (const userId of userIds) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // best-effort
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

  let provisioned = null;
  const results = [];

  try {
    provisioned = await provisionSmokeTenant(url, anonKey, serviceKey);
    const cookieHeader = provisioned.session.cookieHeader();
    assert(cookieHeader.length > 0, "Expected auth cookies after provisioning");

    const {
      data: { user },
    } = await provisioned.session.supabase.auth.getUser();
    if (!user) throw new Error("Missing authenticated user");

    const flow = await testProcurementFlow({
      supabase: provisioned.session.supabase,
      userId: user.id,
      locationId: provisioned.locationId,
    });

    results.push({
      name: "PO draft saved",
      ok: true,
      detail: flow.poVoucher,
    });
    results.push({
      name: "PO issued with posting steps",
      ok: true,
      detail: flow.issueSteps.join(", "),
    });
    results.push({
      name: "GRN posted against PO",
      ok: true,
      detail: `${flow.grnVoucher} — ${flow.grnSteps.join(", ")}`,
    });
    results.push({
      name: "Bill saved with three-way match",
      ok: true,
      detail: flow.billSteps.join(", "),
    });

    results.push(await testProcurementPages(cookieHeader));
  } catch (error) {
    if (results.length > 0) {
      console.error("\nCompleted before failure:");
      for (const result of results) {
        console.error(`  ✓ ${result.name}${result.detail ? `: ${result.detail}` : ""}`);
      }
    }
    throw error;
  } finally {
    if (provisioned?.admin && provisioned.ownerUserId) {
      await cleanup(provisioned.admin, [provisioned.ownerUserId]);
    }
  }

  console.log("\nProcurement smoke test (PO → GRN → Bills) — PASSED\n");
  for (const result of results) {
    const suffix = result.detail ? `: ${result.detail}` : "";
    console.log(`  ✓ ${result.name}${suffix}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("\nProcurement smoke test — FAILED\n");
  console.error(`  ✗ ${error.message}`);
  process.exit(1);
});
