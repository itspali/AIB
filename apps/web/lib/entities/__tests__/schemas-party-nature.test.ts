import { describe, expect, it } from "vitest";
import { entityMasterSchema } from "@/lib/entities/schemas";

const basePayload = {
  entity_id: null,
  logo_url: "",
  draft_storage_key: "draft-1",
  name: "Acme Corp",
  type: "CUSTOMER" as const,
  party_nature: "ORGANIZATION" as const,
  tax_treatment: "UNREGISTERED_B2C" as const,
  tax_registration_number: "",
  legal_name: "",
  code: "",
  customer_category_id: "11111111-1111-4111-8111-111111111111",
  supplier_category_id: "",
  credit_limit: "0",
  payment_terms_days: "0",
  base_currency_override: "",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_city: "",
  billing_state: "",
  billing_zip_postal: "",
  billing_country_code: "",
  shipping_address_line1: "",
  shipping_address_line2: "",
  shipping_city: "",
  shipping_state: "",
  shipping_zip_postal: "",
  shipping_country_code: "",
  same_as_billing: true,
  incoterms_code: "",
  default_shipping_method: "",
  company_email: "",
  company_phone: "",
  website_url: "",
  internal_notes: "",
  custom_fields: {},
  customer_custom_fields: {},
  supplier_custom_fields: {},
  is_active: true,
  primary_contact: {
    contact_id: null,
    first_name: "Alex",
    last_name: "Lee",
    email: "",
    phone: "",
    mobile: "",
    whatsapp_number: "",
    department: "",
    job_title: "",
    use_mobile_for_whatsapp: true,
    is_primary: true,
    is_active: true,
  },
  extended_contacts: [],
  bank_accounts: [],
};

describe("entityMasterSchema party nature and categories", () => {
  it("requires customer category for customer type", () => {
    const result = entityMasterSchema.safeParse({
      ...basePayload,
      customer_category_id: "",
    });
    expect(result.success).toBe(false);
  });

  it("requires supplier category for supplier type", () => {
    const result = entityMasterSchema.safeParse({
      ...basePayload,
      type: "SUPPLIER",
      customer_category_id: "",
      supplier_category_id: "",
    });
    expect(result.success).toBe(false);
  });

  it("requires both categories for mutual partner", () => {
    const result = entityMasterSchema.safeParse({
      ...basePayload,
      type: "MUTUAL_PARTNER",
      supplier_category_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.success).toBe(true);
  });
});
