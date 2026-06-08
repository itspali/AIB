# Supabase CI/CD — Migration Errors, Fixes & Commit Guidelines

**Canonical reference** for avoiding and fixing failures when schema changes sync to Supabase via GitHub Actions.

Use this document **before** opening a PR or pushing migration files to `develop`. Related: [`DATA_STANDARDS.md`](./DATA_STANDARDS.md), [`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md).

---

## Quick guidelines (every commit with SQL)

| Rule | Why |
|------|-----|
| **One migration file = one timestamp** (`YYYYMMDDHHMMSS_name.sql`) | Duplicate timestamps break ordering and CI |
| **Timestamp must sort after** the newest file in `supabase/migrations/` | Out-of-order files need `--include-all` or repair |
| **Never edit a migration already applied** on sandbox/production | Remote will not re-run it; add a **new** forward migration |
| **Append new view columns at the end** of `SELECT` | Mid-list inserts fail with SQLSTATE `42P16` |
| **Match `GRANT` signatures** to `CREATE FUNCTION` exactly | Whole migration rolls back on GRANT failure |
| **Prefer idempotent DDL** (`IF NOT EXISTS`, `DROP … IF EXISTS`) | Safer re-runs and partial-failure recovery |
| **Ship schema only via Git** → push `develop` | CI runs `supabase db push --yes --include-all` |
| **Do not commit** `supabase/.temp/` or `.env` secrets | Local link cache / credentials |

### Pre-push checklist (migrations)

1. List latest migration: sort `supabase/migrations/` — your new file must be **last**.
2. Grep for duplicate timestamp prefix:
   ```powershell
   Get-ChildItem supabase/migrations/*.sql | ForEach-Object { $_.Name.Substring(0,14) } | Group-Object | Where-Object Count -gt 1
   ```
3. If changing an **existing view**, confirm new columns are **appended** (see §3.6 and view list below).
4. If adding `GRANT EXECUTE`, copy the full argument list from `CREATE FUNCTION`.
5. If adding `CHECK` / `NOT NULL` on a live table, backfill or validate existing rows first.
6. Push to `develop` and watch **Actions → CI/CD Supabase Deployment Engine**.
7. If CI fails on migration **N** and never applied on remote: fix file **N** and push again. If **N** already applied: new migration only.

### Views that must use append-only column order

These views are replaced often; **never insert columns in the middle**:

| View | Typical migrations |
|------|-------------------|
| `public.product_catalog_search_rows` | `20260531920000+`, `20260533300000` |
| `public.product_list_workspace_rows` | `20260534000000+`, `20260607120000+`, `20260607160000+` |
| `public.product_list_workspace_variant_rows` | `20260539500000+`, `20260607160000+` |

To rename, reorder, or remove columns: `DROP VIEW` (check dependents) + `CREATE VIEW`, or introduce a new view name.

---

## How deployment works

| Branch | Workflow job | Command | Target |
|--------|--------------|---------|--------|
| `develop` | `deploy-sandbox` | `supabase link` + `supabase db push --yes --include-all` | AIB Sandbox |
| `main` | `deploy-production` | same | AIB Production |

Workflow: [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml)

**Important:**

- Migrations apply in **filename timestamp order**.
- Each migration runs in a **single transaction** — one failed statement rolls back the entire file.
- **Already-applied migrations are never re-run** on remote. Editing them after a successful deploy has **no effect** unless the remote history is repaired manually.
- **Local Supabase CLI is not used for deploy** in normal workflow — schema ships via Git only ([`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md)).

---

## 1. CI / infrastructure errors (no SQL executed)

### 1.1 Missing or invalid GitHub secrets

**Signal:**
```
authentication failed / invalid access token / project ref not found
```
(before `Applying migration ...`)

**Cause:** `SUPABASE_ACCESS_TOKEN` or `SUPABASE_SANDBOX_PROJECT_ID` missing, expired, or wrong.

**Fix:** GitHub → Settings → Secrets and variables → Actions.

---

### 1.2 Interactive prompt blocked CI

**Signal:** Workflow hangs or fails waiting for confirmation.

**Cause:** `supabase db push` without `--yes` in non-interactive CI.

**Fix:** Workflow uses `supabase db push --yes --include-all` (do not remove flags).

---

### 1.3 Remote / local migration history drift

**Signal:**
```
Remote migration versions differ from local / migration history mismatch
```

**Cause:** Manual SQL in Supabase Dashboard, or sandbox repaired outside Git.

**Fix:** Align with Supabase docs (`migration repair`). Do **not** leave Git and remote permanently diverged. Prefer forward migrations over dashboard hotfixes for core tables.

---

### 1.4 Out-of-order local migrations

**Signal:**
```
Found local migration files to be inserted before the last migration on remote database.
Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20260603120050_...
```

**Cause:** A **later** timestamp was already applied on sandbox while an **earlier** file was added or renamed afterward (e.g. duplicate `20260603120000` resolved by moving supplier catalog to `20260603120050`).

**Encountered:** 2026-06-05 — commits `f3ca196`, `6667747`.

**Fix:**

1. CI keeps `--include-all` on both deploy jobs (applies backfilled timestamps).
2. For one-off repair: `supabase db push --yes --include-all` against linked project.

**Prevention:** Never reuse a timestamp. When splitting a migration, use a **new** strictly increasing timestamp — do not insert a lower version after a higher one is on remote.

---

## 2. Migration ordering and file hygiene

### 2.1 Timestamp sorts before already-applied migration

**Signal:**
```
Migration ... already applied / out of order / duplicate key in schema_migrations
```

**Cause:** New migration timestamp is **earlier** than migrations already on sandbox, or **duplicate timestamp** with another file.

**Encountered:** `9b012da` (search filters reordered to `20260531920000+`).

**Fix:** Rename to timestamp **after** latest applied migration. Never reuse a version that ran on remote.

**Prevention:**
```powershell
Get-ChildItem supabase/migrations/*.sql | Sort-Object Name | Select-Object -Last 3 Name
```

---

### 2.2 Duplicate migration timestamp (two files, same prefix)

**Signal:** One file applies; the other is skipped or causes history confusion. CI may fail on `--include-all` ordering.

**Encountered:** 2026-06-03 — two files shared `20260603120000` (category vs supplier catalog). Fixed in `f3ca196` by renaming supplier catalog to `20260603120050`.

**Prevention:** Before commit, run duplicate-prefix check (see checklist above). **One timestamp per file.**

---

### 2.3 Duplicate migration content

**Signal:** Second migration fails because object already exists.

**Encountered:** `9b012da` — removed duplicate search filter migration; logic folded into earlier file.

**Prevention:** Grep for object names; extend with `CREATE OR REPLACE` in a **new** timestamp file instead of duplicating.

---

## 3. SQL errors encountered in this repo

### 3.1 `RAISE EXCEPTION` format placeholders (`%` vs `%%`)

**Signal:** `syntax error at or near "%"` / too many parameters for RAISE

**Encountered:** `2e2dbfe` — M7 outbound migration.

**Correct:**
```sql
RAISE EXCEPTION 'returns blocked: discount % exceeds policy maximum %', v_discount_pct, v_max_discount;
```

Use `%%` only for a **literal** `%` in the message string.

---

### 3.2 PL/pgSQL assignments inside SQL `CASE` (invalid in `RETURN QUERY`)

**Signal:** `syntax error at or near ":="`

**Encountered:** `ce23eff` — search filter migrations.

**Wrong:** `v_value := clause ->> 'value'` inside a SQL `CASE` branch.

**Correct:** Inline `(clause ->> 'value')` in the expression.

---

### 3.3 `GRANT` / `REVOKE` function signature mismatch

**Signal:**
```
function public.update_organization_governance_profile(...) does not exist
```
(often at end of migration during GRANT)

**Encountered:** `9125775` — organization settings RPC.

**Prevention:** Paste the **exact** parameter type list from `CREATE FUNCTION` into every `GRANT`, `REVOKE`, and `COMMENT ON FUNCTION`.

---

### 3.4 Storage / RLS policy already exists

**Signal:** `policy "..." for table "objects" already exists`

**Encountered:** `9125775`.

**Prevention:**
```sql
DROP POLICY IF EXISTS tenant_logos_select_tenant ON storage.objects;
CREATE POLICY tenant_logos_select_tenant ON storage.objects ...
```

---

### 3.5 Enum / type replacement blocked by dependent functions

**Signal:** `cannot drop type ... because other objects depend on it`

**Encountered:** `1b8d718` — location topology migration.

**Prevention:** `DROP FUNCTION ...` (full signature) → alter/replace type → recreate functions.

---

### 3.6 `CREATE OR REPLACE VIEW` — column inserted mid-list (SQLSTATE 42P16)

**Signal:**
```
ERROR: cannot change name of view column "primary_image_storage_path" to "reorder_point" (SQLSTATE 42P16)
Applying migration 20260607160000_product_list_reorder_status.sql...
```

**Cause:** PostgreSQL matches view columns **by position** on `CREATE OR REPLACE VIEW`. Inserting a new column in the middle makes Postgres treat later columns as renamed.

**Encountered:**

| Commit | Migration | Mistake |
|--------|-----------|---------|
| `76ca5ab` / fix `9b721df` | `20260533300000_search_filter_is_active.sql` | `is_active` inserted before `default_sku` |
| `f3794b3` / fix `56a9b79` | `20260607160000_product_list_reorder_status.sql` | `reorder_point` / `below_reorder` inserted before `primary_image_storage_path` |

**Wrong:**
```sql
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    ... AS reorder_point,        -- NEW: breaks positional match
    ... AS below_reorder,
    primary_media.storage_url AS primary_image_storage_path,
    ...
    COALESCE(vc.sellable_variant_count, 0) AS sellable_variant_count
```

**Correct:** Keep existing column order; append new columns **after** the last column:
```sql
    COALESCE(stock.total_quantity_on_hand, 0) AS stock_on_hand,
    primary_media.storage_url AS primary_image_storage_path,
    ...
    COALESCE(vc.sellable_variant_count, 0) AS sellable_variant_count,
    ... AS reorder_point,
    ... AS below_reorder
```

**Prevention:** For any existing view, **only append** columns. To reorder or drop columns, use `DROP VIEW` + `CREATE VIEW` (watch dependents) or a new view name.

---

## 4. Likely errors (preventive)

### 4.1 Object does not exist (missing dependency)

**Signal:** `relation "..." does not exist` / `function private.current_tenant_id() does not exist`

**Mitigation:** Guard with `IF EXISTS` blocks, or enforce strict timestamp ordering.

---

### 4.2 Wrong RLS tenant resolution pattern

**Signal:** Migration applies but app returns empty rows (CI may still pass).

**Prevention:** Use `private.current_tenant_id()` and patterns from existing policies (e.g. `20260533100000_custom_module_views.sql`).

---

### 4.3 `CHECK` constraint violation on existing rows (SQLSTATE 23514)

**Signal:** `check constraint "..." is violated by some row`

**Prevention:** Backfill in the same migration before adding constraint, or use `NOT VALID` + validate later.

---

### 4.4 Unique / duplicate object names (SQLSTATE 42P07)

**Prevention:** `CREATE INDEX IF NOT EXISTS`, `DROP ... IF EXISTS`, unique index names per table/purpose.

---

### 4.5 `ON CONFLICT` target must match a unique index

**Signal:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`

**Cause:** `ON CONFLICT (location_id, item_id, variant_id)` must match an exact unique index definition (including expression indexes).

**Prevention:** Verify unique index columns in earlier migrations (e.g. `inventory_buffer_thresholds_location_item_variant_unique` on `(location_id, item_id, variant_id)` after phase-0 variant foundation).

---

### 4.6 `CREATE INDEX CONCURRENTLY` in migrations

**Signal:** `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`

**Prevention:** Use plain `CREATE INDEX` / `CREATE INDEX IF NOT EXISTS` in migration files.

---

### 4.7 Overloaded function `COMMENT ON FUNCTION` ambiguity

**Prevention:** Always specify argument types: `COMMENT ON FUNCTION public.foo(jsonb) IS '...';`

---

### 4.8 Security definer functions without `search_path`

**Prevention:** Always set `SET search_path = public` (or `public, private`) on `SECURITY DEFINER` functions.

---

## 5. Rules when fixing a failed deploy

| Situation | Do | Don't |
|-----------|-----|--------|
| Migration **never** applied on sandbox (CI failed) | Fix the **same** migration file and push again | Leave broken SQL in place |
| Migration **already** applied on sandbox | Add a **new** forward migration with the fix | Edit the old migration file only |
| CI failed on migration N | Fix N; N+1 won't run until N succeeds | Assume later migrations partially applied |
| Need urgent dashboard hotfix | Document and backport into next migration | Leave Git and remote permanently diverged |

---

## 6. Diagnosing failures

1. GitHub → **Actions** → **CI/CD Supabase Deployment Engine** → failed run on `develop`.
2. Open **Link & Push Migrations to AIB Sandbox** step log.
3. Find the last `Applying migration YYYYMMDDHHMMSS_name.sql...` — the error below is the failing statement.
4. Map using table below.

| Log fragment | Section |
|--------------|---------|
| `SQLSTATE 42P16` | §3.6 View column order |
| `cannot change name of view column` | §3.6 View column order |
| `SQLSTATE 23514` | §4.3 CHECK violation |
| `SQLSTATE 42P07` | §4.4 Duplicate relation |
| `does not exist` at GRANT | §3.3 Signature mismatch |
| `does not exist` at CREATE | §4.1 Missing dependency |
| `syntax error at or near ":="` | §3.2 PL/pgSQL in SQL |
| `cannot drop type` | §3.5 Enum dependencies |
| `--include-all` | §1.4 Out-of-order migrations |
| `duplicate key in schema_migrations` | §2.1 / §2.2 Timestamp collision |

Optional: query applied versions on sandbox (if you have read access):
```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```
(See also [`supabase/scripts/audit_sandbox.sql`](../supabase/scripts/audit_sandbox.sql).)

---

## 7. Repo-specific safe patterns

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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$ ... $$;

REVOKE ALL ON FUNCTION public.foo(argtypes) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.foo(argtypes) TO authenticated;

-- Views (extend only — append columns at end)
CREATE OR REPLACE VIEW public.some_view
WITH (security_invoker = true) AS
SELECT
    ... existing columns in unchanged order ...,
    new_column_at_end
FROM ...;

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
| `9b721df` | View column order (`42P16`) — `is_active` on `product_catalog_search_rows` |
| `f3ca196` | Duplicate migration version `20260603120000` |
| `6667747` | CI `--include-all` for out-of-order backfill migrations |
| `56a9b79` | View column order (`42P16`) — `reorder_point` on `product_list_workspace_rows` |
| `20260609100000` (fix) | `DROP COLUMN users.tenant_id` blocked by `users_select` / `users_update` RLS from `20260548000000` — drop consolidated policies before column drop, recreate membership-scoped policies |

---

## 9. PR / commit message hints

When a PR includes migrations, note in the description:

- New migration filenames (timestamps)
- Whether any **existing view** was modified (call out append-only)
- Whether sandbox CI must apply backfilled timestamps (`--include-all` is automatic)
- Link to the Actions run after push

Example PR note:
```
DB: 20260607180000_foo.sql — append-only change to product_list_workspace_rows (reorder_point column at end)
```

---

*Last updated: 2026-06-07 — includes failures from commits `f3794b3` / fix `56a9b79`, duplicate timestamp `f3ca196`, and CI `--include-all` `6667747`.*
