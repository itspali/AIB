# Supabase CI/CD Migration Error Reference

This document catalogs **known and likely failures** when pushing schema changes to Supabase via GitHub Actions. Use it before committing migration files so fixes are not accidentally reverted or reintroduced.

## How deployment works

| Branch | Workflow job | Command | Target |
|--------|--------------|---------|--------|
| `develop` | `deploy-sandbox` | `supabase link` + `supabase db push --yes` | AIB Sandbox |
| `main` | `deploy-production` | same | AIB Production |

Workflow file: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

**Important:** Migrations are applied **in filename timestamp order**. Each migration runs inside a **single transaction** — if any statement fails, the entire migration rolls back and CI fails. Already-applied migration files are **never re-run** on the remote; editing them after a successful deploy has no effect unless you repair the remote manually.

**Local CLI:** Supabase CLI is not used on the developer machine for deploy. Schema ships via Git only. See [`docs/AGENT_HANDOVER.md`](AGENT_HANDOVER.md).

---

## Pre-commit checklist

Before pushing migrations to `develop`:

1. **Timestamp** — New file name must sort **after** the latest migration already applied on sandbox (check `supabase/migrations/` and recent successful CI runs).
2. **Dependencies** — Tables, types, functions, and helpers referenced in SQL must exist in an **earlier** migration (or be created in the same file first).
3. **Idempotency** — Prefer `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`.
4. **Views** — New columns on existing views must be **appended at the end** of the `SELECT` list (see §3.7).
5. **PL/pgSQL in SQL expressions** — No variable assignments inside `RETURN QUERY` / `CASE` branches used as SQL (see §3.3).
6. **GRANT/REVOKE** — Function signatures in `GRANT`/`REVOKE` must **exactly match** the `CREATE FUNCTION` declaration (see §3.5).
7. **RLS tenant pattern** — Use `private.current_tenant_id()` and `auth.uid()`; do not rely on `user_metadata` in policies (see §4.2).
8. **Constraints on live data** — `CHECK` / `NOT NULL` on existing tables can fail if rows violate the rule (see §4.4).
9. **Do not commit** `supabase/.temp/` (local link cache; gitignored).
10. **Do not edit** migrations that have already succeeded on sandbox/production unless you understand remote repair implications (see §5).

---

## 1. CI / infrastructure errors (no SQL executed)

### 1.1 Missing or invalid GitHub secrets

**Signal:**
```
authentication failed / invalid access token / project ref not found
```
(before `Applying migration ...`)

**Cause:** `SUPABASE_ACCESS_TOKEN` or `SUPABASE_SANDBOX_PROJECT_ID` missing, expired, or wrong.

**Fix:** Update repository secrets in GitHub Settings → Secrets and variables → Actions.

**Prevention:** Failures happen before any migration runs; no migration file change fixes this.

---

### 1.2 Interactive prompt blocked CI

**Signal:** Workflow hangs or fails waiting for confirmation.

**Cause:** `supabase db push` without `--yes` in non-interactive CI.

**Fix:** Workflow uses `supabase db push --yes` (fixed in commit `2e2dbfe`).

**Prevention:** Never remove `--yes` from [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

---

### 1.3 Remote / local migration history drift

**Signal:**
```
Remote migration versions differ from local / migration history mismatch
```

**Cause:** Migrations applied manually in Supabase Dashboard, or sandbox repaired outside Git, so `supabase_migrations.schema_migrations` no longer matches the repo.

**Fix:** Align history with Supabase support/docs — do **not** apply ad-hoc SQL hotfixes for core tables (see AGENT_HANDOVER). Prefer new forward migrations over manual dashboard edits.

**Prevention:** All schema changes go through `supabase/migrations/` and CI only.

---

## 2. Migration ordering and file hygiene

### 2.1 Timestamp sorts before already-applied migration

**Signal:**
```
Migration ... already applied / out of order / duplicate key in schema_migrations
```

**Cause:** New migration timestamp is **earlier** than migrations already on sandbox, or duplicate timestamp with another file.

**Encountered:** Commit `9b012da` — search filter migrations renamed to `20260531920000+` so they run after `20260531910000` on sandbox.

**Fix:**
- Rename file to a timestamp **after** the latest applied migration.
- Never reuse a timestamp that already ran on remote.

**Prevention:** When adding migrations, use `YYYYMMDDHHMMSS` strictly increasing from the newest file in `supabase/migrations/`.

---

### 2.2 Duplicate migration content / conflicting timestamps

**Signal:** Second migration fails because object already exists, or first migration never runs because timestamp collision.

**Encountered:** Commit `9b012da` — removed duplicate `20260531200000_fix_product_filter_null_compare.sql` and folded logic into `20260531920000_search_filter_engine.sql`.

**Fix:** Delete or merge duplicate files; one timestamp per migration.

**Prevention:** Grep for existing object names before adding a new migration; extend via `CREATE OR REPLACE` in a **new** timestamp file instead of duplicating.

---

## 3. SQL errors encountered in this repo

### 3.1 `RAISE EXCEPTION` format placeholders (`%` vs `%%`)

**Signal:**
```
syntax error at or near "%" / too many parameters for RAISE
```

**Cause:** In PL/pgSQL, `RAISE EXCEPTION 'message %', arg` uses `%` as placeholders. Escaping with `%%` is only needed for a **literal** percent sign in the message, not for each substitution.

**Encountered:** Commit `2e2dbfe` — M7 outbound migration line used `'discount %% exceeds policy maximum %%'`; changed to single `%` per placeholder.

**Correct pattern:**
```sql
RAISE EXCEPTION 'returns blocked: discount % exceeds policy maximum %', v_discount_pct, v_max_discount;
```

**Prevention:** Count `%` placeholders in the string; each must match one trailing argument. Use `%%` only for a literal `%` in the text.

---

### 3.2 PL/pgSQL assignments inside SQL `CASE` (invalid in `RETURN QUERY`)

**Signal:**
```
syntax error at or near ":=" / cannot assign in SQL expression context
```

**Cause:** Statements like `v_value := clause ->> 'value'` inside a `CASE` branch that is part of a SQL `WHERE` / `RETURN QUERY` query are invalid — assignments belong in PL/pgSQL blocks, not SQL expressions.

**Encountered:** Commit `ce23eff` — `20260531940000_search_filter_ilike.sql` and `20260531950000_search_filter_numeric.sql`.

**Wrong:**
```sql
WHEN 'ILIKE' THEN
    v_value := clause ->> 'value';
    CASE WHEN v_value LIKE '^%' THEN ...
```

**Correct:**
```sql
WHEN 'ILIKE' THEN
    CASE WHEN (clause ->> 'value') LIKE '^%' THEN
        lower(pcsr.name) LIKE lower(substring(clause ->> 'value' from 2)) || '%'
    ...
```

**Prevention:** In `execute_product_filter`-style RPCs, use inline `(clause ->> 'value')` expressions only.

---

### 3.3 `GRANT` / `REVOKE` function signature mismatch

**Signal:**
```
function public.update_organization_governance_profile(...) does not exist
```
(often at end of migration during GRANT)

**Cause:** PostgreSQL identifies functions by **name + argument types**. A `GRANT EXECUTE` listing 21 `TEXT` parameters when the function was declared with 20 causes failure; the whole migration rolls back.

**Encountered:** Commit `9125775` — `20260531120000_organization_settings_security_rpc.sql`.

**Fix:** Copy the **exact** parameter type list from `CREATE FUNCTION` into `REVOKE`/`GRANT`. When overloaded, include full signature: `function_name(argtype, ...)`.

**Prevention:** After writing `CREATE FUNCTION`, paste the same signature into every `GRANT`, `REVOKE`, and `COMMENT ON FUNCTION`.

---

### 3.4 Storage / RLS policy already exists

**Signal:**
```
policy "tenant_logos_select_tenant" for table "objects" already exists
```

**Cause:** Re-running migration logic that `CREATE POLICY` without dropping first (e.g. after a partial failed deploy or idempotent re-apply).

**Encountered:** Commit `9125775` — added `DROP POLICY IF EXISTS ...` before each storage policy.

**Prevention:**
```sql
DROP POLICY IF EXISTS tenant_logos_select_tenant ON storage.objects;
CREATE POLICY tenant_logos_select_tenant ON storage.objects ...
```

---

### 3.5 Enum / type replacement blocked by dependent functions

**Signal:**
```
cannot drop type ... because other objects depend on it
cannot alter type ... used by function ...
```

**Cause:** Functions referencing the old enum type prevent `CREATE TYPE` replacement or `ALTER TYPE`.

**Encountered:** Commit `1b8d718` — `20260531300000_enterprise_location_topology.sql` drops `save_tenant_location` / `save_tenant_location_core` **before** replacing `location_operational_type`.

**Prevention:** Order operations: `DROP FUNCTION ...` (with full signature) → alter/replace type → recreate functions. Mark validation helpers `STABLE` when required.

---

### 3.6 `CREATE OR REPLACE VIEW` — column inserted mid-list (SQLSTATE 42P16)

**Signal:**
```
ERROR: cannot change name of view column "default_sku" to "is_active" (SQLSTATE 42P16)
Applying migration 20260533300000_search_filter_is_active.sql...
```

**Cause:** PostgreSQL matches view columns **by position** on `CREATE OR REPLACE VIEW`. Inserting a new column in the middle makes Postgres think later columns were renamed.

**Encountered:** Commit `9b721df` (fix for failed `76ca5ab` deploy).

**Wrong** (inserting after `created_at`):
```sql
    i.created_at,
    i.is_active,          -- breaks positional match
    iv.sku AS default_sku,
    ...
    ) AS purchase_price
```

**Correct** (append new columns only):
```sql
    i.created_at,
    iv.sku AS default_sku,
    ...
    ) AS purchase_price,
    i.is_active           -- new column at end
```

**Prevention:** For `product_catalog_search_rows` and any existing view, **only append** columns at the end. To reorder or remove columns, use `DROP VIEW` + `CREATE VIEW` (watch dependents) or a new view name.

**Related (not yet hit, same rule):** Dropping or reordering columns, or changing a column’s type via replace, triggers the same class of `42P16` errors.

---

## 4. Likely errors (not yet hit or preventive)

### 4.1 Object does not exist (missing dependency)

**Signal:**
```
relation "public.custom_module_views" does not exist
function private.current_tenant_id() does not exist
```

**Cause:** Migration assumes an object from a **later** timestamp or from a failed prior migration.

**Mitigation in repo:** `20260533200000_inventory_items_stock_index.sql` guards CHECK constraint with:
```sql
IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_module_views')
```

**Prevention:** Guard optional dependencies with `IF EXISTS` blocks, or enforce strict timestamp ordering.

---

### 4.2 Wrong RLS tenant resolution pattern

**Signal:** Migration applies but app gets empty results or RLS errors at runtime (CI may still pass).

**Cause:** Policies using `auth.jwt() -> 'user_metadata'` instead of `private.current_tenant_id()` / `app_metadata` patterns established in RBAC migrations.

**Prevention:** Copy RLS from existing tables (e.g. `20260533100000_custom_module_views.sql`):
```sql
USING (tenant_id = private.current_tenant_id() AND user_id = auth.uid())
```
JWT tenant for RPCs: `(auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid`.

---

### 4.3 `CHECK` constraint violation on existing rows (SQLSTATE 23514)

**Signal:**
```
check constraint "custom_module_views_module_name_chk" is violated by some row
```

**Cause:** Adding `CHECK` or `NOT NULL` when sandbox already has non-conforming data.

**Prevention:** Backfill in the same migration before adding constraint, or guard with `NOT VALID` + validate later. For new tables (empty), safe to add directly.

---

### 4.4 Unique / duplicate object names

**Signal:**
```
relation "idx_foo" already exists (SQLSTATE 42P07)
duplicate key value violates unique constraint
```

**Prevention:** Use `CREATE INDEX IF NOT EXISTS`, `DROP ... IF EXISTS`, and unique constraint names prefixed by table purpose.

---

### 4.5 `COMMENT ON INDEX` / object not found

**Signal:**
```
index "item_valuations_tenant_item_idx" does not exist
```

**Cause:** `COMMENT ON INDEX` runs when `CREATE INDEX IF NOT EXISTS` skipped creation (e.g. different index name already serving the same columns).

**Prevention:** Comment only immediately after unconditional or verified create; or wrap comment in `IF EXISTS` DO block.

---

### 4.6 `CREATE INDEX CONCURRENTLY` in migrations

**Signal:**
```
CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

**Cause:** Supabase CLI runs each migration in a transaction.

**Prevention:** Use plain `CREATE INDEX` / `CREATE INDEX IF NOT EXISTS` in migration files, not `CONCURRENTLY`.

---

### 4.7 Overloaded function `COMMENT ON FUNCTION` ambiguity

**Signal:**
```
function name "execute_product_filter" is not unique
```

**Cause:** Multiple overloads; comment must specify argument types.

**Prevention:**
```sql
COMMENT ON FUNCTION public.execute_product_filter(jsonb) IS '...';
```

---

### 4.8 Trigger syntax: `EXECUTE FUNCTION` vs `EXECUTE PROCEDURE`

**Signal:**
```
syntax error at or near "PROCEDURE" / "FUNCTION"
```

**Cause:** Postgres 11+ triggers use `EXECUTE FUNCTION` (this repo standard). Older snippets may use `PROCEDURE`.

**Prevention:** Match existing triggers: `EXECUTE FUNCTION public.set_updated_at();`

---

### 4.9 Security definer functions without `search_path`

**Signal:** Silent wrong-tenant behavior or CI/runtime privilege errors.

**Prevention:** Always set `SET search_path = public` (or `public, private`) on `SECURITY DEFINER` functions.

---

## 5. Rules when fixing a failed deploy

| Situation | Do | Don't |
|-----------|-----|--------|
| Migration **never** applied on sandbox (CI failed) | Fix the **same** migration file and push again | Leave broken SQL in place |
| Migration **already** applied on sandbox | Add a **new** forward migration with the fix | Edit the old migration file only |
| CI failed on migration N | Fix N; migrations N+1 won't run until N succeeds | Assume later migrations partially applied |
| Need urgent hotfix on dashboard | Document and backport into next migration | Leave Git and remote permanently diverged |

---

## 6. Diagnosing failures

1. GitHub → **Actions** → **CI/CD Supabase Deployment Engine** → failed run on `develop`.
2. Open the **Link & Push Migrations** step log.
3. Find the last line `Applying migration YYYYMMDDHHMMSS_name.sql...` — the error immediately below is the failing statement.
4. Map to sections above using `SQLSTATE` or message text.

Common log patterns:

| Log fragment | Section |
|--------------|---------|
| `SQLSTATE 42P16` | §3.6 View column order |
| `SQLSTATE 23514` | §4.3 CHECK violation |
| `SQLSTATE 42P07` | §4.4 Duplicate relation |
| `does not exist` at GRANT | §3.3 Signature mismatch |
| `does not exist` at CREATE | §4.1 Missing dependency |
| `syntax error at or near ":="` | §3.2 PL/pgSQL in SQL |
| `cannot drop type` | §3.5 Enum dependencies |

---

## 7. Repo-specific safe patterns (keep these)

```sql
-- Tables
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...

-- RLS
ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ... ON ...;
CREATE POLICY ...

-- Triggers
CREATE TRIGGER ... EXECUTE FUNCTION public.set_updated_at();

-- RPCs
CREATE OR REPLACE FUNCTION ... 
SET search_path = public;
GRANT EXECUTE ON FUNCTION public.foo(argtypes) TO authenticated;

-- Views (extend only)
CREATE OR REPLACE VIEW ... WITH (security_invoker = true) AS
SELECT ... existing_columns ..., new_column_at_end;

-- Optional dependency
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '...') THEN
    ...
  END IF;
END $$;
```

---

## 8. Commit history index (migration CI fixes)

| Commit | Issue |
|--------|--------|
| `2e2dbfe` | M7 `RAISE EXCEPTION` `%` placeholders; CI `db push --yes` |
| `9125775` | Organization RPC `GRANT` signature; storage policy idempotency |
| `1b8d718` | Drop enum-pinning RPCs before location type migration |
| `9b012da` | Migration timestamp reorder; remove duplicate search migration |
| `ce23eff` | Invalid PL/pgSQL assignments in search filter RPCs |
| `9b721df` | View column order (`42P16`) for `is_active` on `product_catalog_search_rows` |

---

*Last updated: 2026-05-29 — includes failure from commit `76ca5ab` / fix `9b721df`.*
