/**
 * Smoke test: PO → GRN → Bills procurement flow
 * Run: node scripts/smoke-procurement.mjs
 * Requires dev server on localhost:3000 and .env.local with Supabase keys.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const SMOKE_EXTENDED = process.env.SMOKE_EXTENDED === "1";

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

async function seedBillingCoaAccounts(supabase, tenantId) {
  const accounts = [
    {
      tenant_id: tenantId,
      account_code: "2100-AP",
      account_name: "Accounts Payable",
      classification: "LIABILITY",
    },
    {
      tenant_id: tenantId,
      account_code: "1400-INVENTORY",
      account_name: "Inventory Stock Assets",
      classification: "ASSET",
    },
  ];

  for (const account of accounts) {
    const { error } = await supabase.from("accounts").insert(account);
    if (error && !/duplicate|unique/i.test(error.message)) {
      throw new Error(`accounts insert ${account.account_code}: ${error.message}`);
    }
  }
}

async function testProcurementFlow(ctx, options = {}) {
  const { assertPayablesPosted = false } = options;
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

  if (assertPayablesPosted) {
    assert(
      billPostingKeys.includes("bill_payables_posted"),
      `Expected bill_payables_posted, got: ${billPostingKeys.join(", ")}`
    );
    const payablesStep = parseRpcSteps(postingRun).find(
      (step) => (step.id ?? step.step_key ?? step.key) === "bill_payables_posted"
    );
    assert(
      payablesStep?.status === "success",
      `Expected bill_payables_posted success, got ${payablesStep?.status ?? "missing"}`
    );

    const { data: billPayablesRow, error: payablesFetchError } = await supabase
      .from("purchase_invoices")
      .select("payables_posted_at")
      .eq("id", billId)
      .single();
    if (payablesFetchError) {
      throw new Error(`purchase_invoices payables fetch: ${payablesFetchError.message}`);
    }
    assert(billPayablesRow?.payables_posted_at, "Expected payables_posted_at to be set");
  }

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

async function testLandedChargesGrn(ctx) {
  const { supabase, userId, locationId } = ctx;
  const stamp = Date.now();
  const unitPrice = 10;
  const qty = 3;
  const freightAmount = 30;

  const supplierId = await createSupplier(supabase);
  const { variantId } = await createTrackInventoryProduct(supabase, `${stamp}-landed`);

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
  if (savePoError) throw new Error(`save_purchase_order (landed): ${savePoError.message}`);

  const { error: issueError } = await supabase.rpc("issue_purchase_order", {
    p_purchase_order_id: poId,
  });
  if (issueError) throw new Error(`issue_purchase_order (landed): ${issueError.message}`);

  const { data: poItems, error: poItemsError } = await supabase
    .from("purchase_order_items")
    .select("id")
    .eq("purchase_order_id", poId);
  if (poItemsError) throw new Error(`purchase_order_items fetch (landed): ${poItemsError.message}`);
  const poItemId = poItems[0].id;

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
    p_landed_charges: [
      {
        charge_type: "FREIGHT",
        amount: freightAmount,
        allocation_method: "BY_QUANTITY",
      },
    ],
  });
  if (grnError) throw new Error(`post_goods_receipt (landed): ${grnError.message}`);

  const grnId = grnResult?.goods_receipt_id ?? grnResult?.goodsReceiptId;
  assert(grnId, "post_goods_receipt (landed) returned no goods_receipt_id");

  const grnStepKeys = stepKeys(parseRpcSteps(grnResult));
  assert(
    grnStepKeys.includes("grn_landed_charges_allocated"),
    `Expected grn_landed_charges_allocated, got: ${grnStepKeys.join(", ")}`
  );

  const { data: landedRows, error: landedError } = await supabase
    .from("goods_receipt_landed_charges")
    .select("charge_type, amount")
    .eq("goods_receipt_id", grnId);
  if (landedError) {
    throw new Error(`goods_receipt_landed_charges fetch: ${landedError.message}`);
  }
  assert(landedRows?.length === 1, "Expected one landed charge row");
  assert(Number(landedRows[0].amount) === freightAmount, "Landed charge amount mismatch");

  return {
    name: "GRN landed charges allocated",
    ok: true,
    detail: grnStepKeys.join(", "),
  };
}

async function createGitHoldingLocation(supabase) {
  const stamp = Date.now();
  const { data: locationId, error } = await supabase.rpc("save_tenant_location", {
    p_location_id: null,
    p_name: `GIT Holding ${stamp}`,
    p_code: `GIT${String(stamp).slice(-4)}`,
    p_address_line1: "1 Virtual Transit Way",
    p_city: "Austin",
    p_state: "TX",
    p_zip_postal: "78701",
    p_country_code: "US",
    p_is_stock_holding: true,
    p_presence_type: "VIRTUAL",
    p_location_meta: {},
  });
  if (error) throw new Error(`save_tenant_location (GIT): ${error.message}`);
  if (!locationId) throw new Error("save_tenant_location (GIT) returned no id");

  const { error: flagError } = await supabase.rpc("update_location_logistics_flags", {
    p_location_id: locationId,
    p_is_git_holding: true,
    p_is_subcontract_wip: false,
  });
  if (flagError) {
    throw new Error(`update_location_logistics_flags (GIT): ${flagError.message}`);
  }

  return locationId;
}

async function postGoodsReceiptExtended(supabase, payload) {
  const {
    locationId,
    poId,
    lines,
    userId,
    receiptStage = "FINAL",
    isPoFulfilling = true,
  } = payload;

  return supabase.rpc("post_goods_receipt", {
    p_destination_location_id: locationId,
    p_purchase_order_id: poId,
    p_lines: lines,
    p_created_by: userId,
    p_landed_charges: [],
    p_receipt_stage: receiptStage,
    p_is_po_fulfilling: isPoFulfilling,
    p_parent_grn_id: null,
    p_shipment_id: null,
    p_staging_location_id: null,
  });
}

async function testImportLogisticsStagingGitClearance(ctx) {
  const { supabase, userId, locationId } = ctx;
  const stamp = Date.now();
  const unitPrice = 10;
  const fulfillQty = 5;
  const clearanceQty = 5;
  const orderQty = 10;

  const gitLocationId = await createGitHoldingLocation(supabase);
  const supplierId = await createSupplier(supabase);
  const { variantId } = await createTrackInventoryProduct(supabase, `${stamp}-import`);

  const { data: poId, error: savePoError } = await supabase.rpc("save_purchase_order", {
    p_purchase_order_id: null,
    p_destination_location_id: locationId,
    p_supplier_id: supplierId,
    p_lines: [
      {
        variant_id: variantId,
        quantity_ordered: orderQty,
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
  if (savePoError) throw new Error(`save_purchase_order (import): ${savePoError.message}`);

  const { error: issueError } = await supabase.rpc("issue_purchase_order", {
    p_purchase_order_id: poId,
  });
  if (issueError) throw new Error(`issue_purchase_order (import): ${issueError.message}`);

  const { data: poItems, error: poItemsError } = await supabase
    .from("purchase_order_items")
    .select("id")
    .eq("purchase_order_id", poId);
  if (poItemsError) throw new Error(`purchase_order_items fetch (import): ${poItemsError.message}`);
  const poItemId = poItems[0].id;

  const linePayload = {
    variant_id: variantId,
    po_item_id: poItemId,
    quantity_received: fulfillQty,
    raw_unit_cost: unitPrice,
    is_promotional: false,
  };

  const { error: stagingGrnError } = await postGoodsReceiptExtended(supabase, {
    locationId,
    poId,
    userId,
    lines: [linePayload],
    receiptStage: "COMMERCIAL",
    isPoFulfilling: true,
  });
  if (stagingGrnError) {
    throw new Error(`post_goods_receipt (staging): ${stagingGrnError.message}`);
  }

  const { data: poAfterStaging, error: poAfterStagingError } = await supabase
    .from("purchase_order_items")
    .select("quantity_received")
    .eq("id", poItemId)
    .single();
  if (poAfterStagingError) {
    throw new Error(`po items after staging: ${poAfterStagingError.message}`);
  }
  assert(
    Number(poAfterStaging.quantity_received) === fulfillQty,
    `Expected PO received ${fulfillQty} after staging GRN, got ${poAfterStaging.quantity_received}`
  );

  const { data: gitResult, error: gitError } = await supabase.rpc("post_goods_in_transit", {
    p_source_location_id: locationId,
    p_git_holding_location_id: gitLocationId,
    p_lines: [
      {
        variant_id: variantId,
        po_item_id: poItemId,
        quantity: fulfillQty,
        unit_cost: unitPrice,
      },
    ],
    p_created_by: userId,
    p_purchase_order_id: poId,
    p_notes: "smoke import logistics",
  });
  if (gitError) throw new Error(`post_goods_in_transit: ${gitError.message}`);
  const gitVoucherId = gitResult?.voucher_id;
  assert(gitVoucherId, "post_goods_in_transit returned no voucher_id");

  const clearanceLines = [
    {
      variant_id: variantId,
      quantity_received: clearanceQty,
      quantity_accepted: clearanceQty,
    },
  ];

  const { error: clearError } = await supabase.rpc("clear_goods_in_transit_for_grn", {
    p_git_voucher_id: gitVoucherId,
    p_destination_location_id: locationId,
    p_lines: clearanceLines,
    p_created_by: userId,
  });
  if (clearError) throw new Error(`clear_goods_in_transit_for_grn: ${clearError.message}`);

  const { error: clearanceGrnError } = await postGoodsReceiptExtended(supabase, {
    locationId,
    poId,
    userId,
    lines: [{ ...linePayload, quantity_received: clearanceQty }],
    receiptStage: "GIT_CLEARANCE",
    isPoFulfilling: false,
  });
  if (clearanceGrnError) {
    throw new Error(`post_goods_receipt (clearance): ${clearanceGrnError.message}`);
  }

  const { data: poAfterClearance, error: poFinalError } = await supabase
    .from("purchase_order_items")
    .select("quantity_received")
    .eq("id", poItemId)
    .single();
  if (poFinalError) throw new Error(`po items after clearance: ${poFinalError.message}`);
  assert(
    Number(poAfterClearance.quantity_received) === fulfillQty,
    `PO qty double-counted: expected ${fulfillQty}, got ${poAfterClearance.quantity_received}`
  );

  return {
    name: "Import logistics staging → GIT → clearance (PO qty not double-counted)",
    ok: true,
    detail: `received=${poAfterClearance.quantity_received}, git=${gitResult?.voucher_number ?? gitVoucherId}`,
  };
}

async function testBillQtyMismatchFails(ctx) {
  const { supabase, userId, locationId } = ctx;
  const stamp = Date.now();
  const unitPrice = 10;
  const qty = 4;

  const supplierId = await createSupplier(supabase);
  const { variantId } = await createTrackInventoryProduct(supabase, `${stamp}-mismatch`);

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
  if (savePoError) throw new Error(`save_purchase_order (mismatch): ${savePoError.message}`);

  const { error: issueError } = await supabase.rpc("issue_purchase_order", {
    p_purchase_order_id: poId,
  });
  if (issueError) throw new Error(`issue_purchase_order (mismatch): ${issueError.message}`);

  const { data: poItems, error: poItemsError } = await supabase
    .from("purchase_order_items")
    .select("id")
    .eq("purchase_order_id", poId);
  if (poItemsError) {
    throw new Error(`purchase_order_items fetch (mismatch): ${poItemsError.message}`);
  }
  const poItemId = poItems[0].id;

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
  if (grnError) throw new Error(`post_goods_receipt (mismatch): ${grnError.message}`);

  const grnId = grnResult?.goods_receipt_id ?? grnResult?.goodsReceiptId;
  assert(grnId, "post_goods_receipt (mismatch) returned no goods_receipt_id");

  const { error: billError } = await supabase.rpc("save_purchase_invoice", {
    p_purchase_invoice_id: null,
    p_supplier_id: supplierId,
    p_billing_location_id: locationId,
    p_invoice_number_vendor: `VINV-MISMATCH-${stamp}`,
    p_lines: [
      {
        variant_id: variantId,
        purchase_order_item_id: poItemId,
        quantity_billed: qty + 1,
        unit_price_billed: unitPrice,
      },
    ],
    p_created_by: userId,
    p_purchase_order_id: poId,
    p_currency_code: "USD",
    p_goods_receipt_ids: [grnId],
  });

  assert(billError, "Expected bill save to fail when quantity billed exceeds GRN accepted qty");
  assert(
    /exceeds accepted receipt quantity/i.test(billError.message),
    `Unexpected bill qty mismatch error: ${billError.message}`
  );

  return {
    name: "Bill qty mismatch rejected",
    ok: true,
    detail: billError.message,
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

    if (SMOKE_EXTENDED) {
      await seedBillingCoaAccounts(provisioned.session.supabase, provisioned.tenantId);
    }

    const flow = await testProcurementFlow(
      {
        supabase: provisioned.session.supabase,
        userId: user.id,
        locationId: provisioned.locationId,
      },
      { assertPayablesPosted: SMOKE_EXTENDED }
    );

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

    if (SMOKE_EXTENDED) {
      const extendedCtx = {
        supabase: provisioned.session.supabase,
        userId: user.id,
        locationId: provisioned.locationId,
      };
      results.push(await testLandedChargesGrn(extendedCtx));
      results.push(await testBillQtyMismatchFails(extendedCtx));
      results.push(await testImportLogisticsStagingGitClearance(extendedCtx));
      if (flow.billSteps.includes("bill_payables_posted")) {
        results.push({
          name: "Bill payables posted to AP",
          ok: true,
          detail: flow.billSteps.join(", "),
        });
      }
    }

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
  if (SMOKE_EXTENDED) {
    console.log("  (extended mode: landed charges, qty mismatch, import GIT, AP posting)\n");
  }
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
