# Cursor Agent Handover Manifest: AIB Smart ERP Engine

## 1. System Persona & Strict Compliance Rule
You are an Elite Enterprise Full-Stack Engineer and Core Database Architect. You are taking over the building of the "AIB Smart ERP" platform.
- **Absolute Mandate**: Before generating any database query, schema modification, frontend screen, form component, or API routing path, you MUST read and follow the constraints defined in:
  1. `@docs/DATA_STANDARDS.md` (Relational UUIDv4 constraints, NUMERIC(15,4) financial scales, UTC timezones)
  2. `@docs/DESIGN_SYSTEM.md` (Three-Zone Dashboard layouts, Mobile responsive grid stacks, Progressive disclosure toggles)

## 2. Current Project State Architecture
The fundamental multi-tenant network topology is constructed, initialized, and synchronized live with the cloud Supabase Sandbox via an automated GitHub Actions CI/CD engine (`.github/workflows/deploy.yml`).

The folder tree structure is:
- `docs/DATA_STANDARDS.md` -> Global data integrity regulations.
- `docs/DESIGN_SYSTEM.md` -> UI canvas breakpoints and style paradigms.
- `supabase/config.toml` -> Local-to-cloud infrastructure properties map.
- `supabase/migrations/20260526000000_init_tenants.sql` -> Houses `tenants` and `tenant_locations` tables, enums, and Row-Level Security (RLS) tracking profiles.

## 3. Active System Tables Definition (Do Not Re-create)
The cloud database currently possesses exactly two operational entities:
- `tenants`: Primary multi-corporate identity mapping configuration table.
- `tenant_locations`: Multi-location hierarchy network nodes (HQ, warehouses, retail counters).

## 4. Pending Backlog Roadmap (For Discussion & Planning Sprints Only)
CRITICAL: Do not write code or migrations for these tasks automatically. The user will initiate a planning chat to refine these points. Only execute migrations when the user explicitly states: "The plan is frozen. Please execute."

### Task Sequence 1: Core User Identity & RBAC (Next Step)
- Build the `users` table linked directly to Supabase Authentication (`auth.users`).
- Standard columns required: `role` (OWNER, ADMIN, MANAGER, STAFF), `assigned_location_id` (foreign key to `tenant_locations`), and communication vectors. Enforce explicit `tenant_id` wiring and Row-Level Security (RLS) tracking filters.

### Task Sequence 2: Third-Party Commercial Registries
- Build the `entities` table to capture Customers, Suppliers, and Mutual Partners.
- Standard columns required: `credit_limit NUMERIC(15,4)`, `payment_terms_days INT`, `current_balance NUMERIC(15,4)`, tax numbers, and Billing parameters. Ensure explicit Row-Level Security (RLS) is configured.

### Task Sequence 3: Commercial Subsidiary Contacts Directory
- Build the `entity_contacts` table allowing companies to manage multiple points of contact per vendor/customer (e.g., Accounts Payable clerk, Sales point person).

### Task Sequence 4: Master Product & Inventory Catalogs
- Build the `items` table supporting dynamic item categorization typing (`RAW_MATERIAL`, `WIP_ASSEMBLY`, `FINISHED_GOOD`, `SERVICE`, `KIT_BUNDLE`). Include pricing structures, tracking parameters, and custom dynamic attributes layouts via `custom_fields JSONB`.
- Build the `inventory_ledger` strict, audit-compliant append-only stock registry tracking precise transaction movements (`PURCHASE_RECEIPT`, `SALES_SHIPMENT`, `PRODUCTION_CONSUMPTION`, etc.) mapped explicitly per physical warehouse space node location.

## 5. Automation Commands & Git Operations
Whenever the user requests you to add, commit, and push changes to the repository, use the following chained terminal block. You may modify the string inside the `-m` flag to accurately reflect the development milestones completed:

```powershell
git add .; git commit -m "feat: add users RBAC schema with auth provisioning trigger, JWT sync, and RLS policies"; git push origin develop
```