-- ====================================================================
-- AIB SMART ERP - MILESTONE 2 DELTA: entities & entity_contacts
-- ====================================================================
-- Applies frozen blueprint alignments on top of:
--   supabase/migrations/20260526200000_init_entities_contacts.sql
--
-- --------------------------------------------------------------------
-- EMBEDDED FRONTEND DESIGN DIRECTION METADATA (for Next.js sprint)
-- --------------------------------------------------------------------
--
-- SPLIT-INTERFACE FILTERING (unified table, split UI workspaces):
--   Sales / Customers:      type IN ('CUSTOMER', 'MUTUAL_PARTNER')
--   Procurement / Suppliers: type IN ('SUPPLIER', 'MUTUAL_PARTNER')
--
-- TAX TREATMENT UI LABEL MAP (tax_treatment_type -> select option):
--   REGULAR_B2B      -> "Registered Business"
--                       Standard local business with a valid Tax ID
--   UNREGISTERED_B2C -> "Unregistered / Consumer"
--                       Retail clients or entities without a tax number
--   COMPOSITION      -> "Composition Scheme"
--                       Small businesses under flat-rate tax tiers
--   SEZ_DEVELOPER    -> "SEZ Developer / Unit"
--                       Located in a Special Economic Zone - Zero-Rated
--   OVERSEAS_EXPORT  -> "Overseas International"
--                       Foreign entities outside national borders
--   DEEMED_EXPORT    -> "Deemed Export"
--                       UI micro-copy TBD at frontend sprint
--
-- PROGRESSIVE UI CONSTRAINT:
--   Hide tax_registration_number input when tax_treatment is
--   UNREGISTERED_B2C or OVERSEAS_EXPORT.
--
-- PROGRESSIVE DISCLOSURE FORM LAYOUT:
--   Essentials (default): name, type, tax_treatment, tax_registration_number
--     (conditional), primary contact inline block, payment_terms_days,
--     credit_limit
--   "Show Advanced Fields" toggle: legal_name, code, billing + shipping
--     addresses, incoterms_code, default_shipping_method, company_email,
--     company_phone, website_url, base_currency_override, internal_notes,
--     custom_fields, Extended Contacts Directory repeater
--
-- PRIMARY CONTACT INLINE (entity create form):
--   Insert entity + is_primary contact in one transaction.
--   Fields: first_name, last_name, email, phone, mobile, department,
--   job_title, is_primary = TRUE
--
-- EXTENDED CONTACTS DIRECTORY (repeater tab):
--   Additional contacts with is_primary = FALSE; full blueprint per row.
--
-- PHONE INPUT UI (entity_contacts anti-crowding):
--   Default visible: "Office Phone" -> phone, "Mobile Number" -> mobile
--   Checkbox "Same number for WhatsApp" defaults TRUE:
--     - Checked: hide WhatsApp field; on submit set whatsapp_number = mobile
--     - Unchecked: progressively disclose "WhatsApp Number" -> whatsapp_number
--
-- SAME AS BILLING (entities address blocks):
--   Client-side checkbox mirrors billing -> shipping before save.
--   DB stores both blocks independently.
--
-- ACCOUNTING FK GUARDRAIL (Milestone 4+):
--   Downstream ledger / transaction tables referencing entities(id) MUST
--   use ON DELETE RESTRICT to protect accounting transaction histories.
--
-- ====================================================================

-- 1. PHONE COLUMN SPLIT (entity_contacts)
ALTER TABLE public.entity_contacts
    ADD COLUMN phone TEXT,
    ADD COLUMN mobile TEXT,
    ADD COLUMN whatsapp_number TEXT;

UPDATE public.entity_contacts
SET mobile = phone_number
WHERE phone_number IS NOT NULL;

ALTER TABLE public.entity_contacts
    DROP COLUMN phone_number;

-- 2. FROZEN BLUEPRINT ALIGNMENTS
ALTER TABLE public.entity_contacts
    ALTER COLUMN last_name DROP NOT NULL;

ALTER TABLE public.entities
    ALTER COLUMN company_phone TYPE TEXT;

-- 3. PRIMARY CONTACT PARTIAL UNIQUE INDEX (is_primary only)
DROP INDEX IF EXISTS public.entity_contacts_one_primary_per_entity;

CREATE UNIQUE INDEX entity_contacts_one_primary_per_entity
    ON public.entity_contacts (entity_id)
    WHERE is_primary = TRUE;
