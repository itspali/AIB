# Glass V2 rollout plan

Implementation checklist for applying **Glass V2** across the AIB web app. This plan keeps **Items** and **Item Categories** frozen as the live reference while other modules adopt the same tokens and patterns.

**Related docs:** [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) (layout standards), [`NAVIGATION.md`](./NAVIGATION.md) (module routes).

---

## Naming & tokens (use in tickets and PRs)

| Term | Meaning | Code |
|------|---------|------|
| **Glass V2** | List-workspace glass theme (dark canvas, glowing borders, matrix/split chrome) | `LIST_WORKSPACE_GLASS_V2_ROOT` |
| **List workspace root** | CSS scope for matrix table, split feed, unified header | `.list-workspace-root` (+ `--lw-*` tokens) |
| **Glass v2 list image** | Thumbnail / avatar frame on list rows | `GLASS_V2_LIST_IMAGE`, `GLASS_V2_LIST_IMAGE_PLACEHOLDER` |
| **Entity categories** | Party taxonomy (`/sales/customers/categories`, etc.) | `entity-category-*` components |
| **Item categories** | Product taxonomy (`/items/categories`) | `category-*` components — **frozen** |

Token source: `apps/web/lib/layout/list-module-chrome.ts`  
CSS source: `apps/web/app/globals.css` (`.list-workspace-root`, `.glass-v2-*`, `.list-module-revamp--glass`)

---

## Frozen reference modules (do not migrate in Phases 0–5)

These are **already on Glass V2**. Treat as source-of-truth; other modules copy from them.

| Module | Routes | Primary files |
|--------|--------|----------------|
| **Items** | `/items` | `components/items/items-list-workspace-terminal.tsx`, `components/items/revamp/items-unified-catalog-header.tsx`, `components/items/revamp/items-matrix-table.tsx`, `components/items/items-list-page-skeleton.tsx` |
| **Item categories** | `/items/categories` | `components/categories/category-management-terminal.tsx`, `components/categories/categories-unified-catalog-header.tsx`, `components/categories/category-matrix-table.tsx`, `components/categories/category-catalog-page-skeleton.tsx` |

**Do not modify** the files above except:

- CSS **aliases** required for Phase 0 (e.g. `.glass-v2-root` → same rules as `.list-workspace-root`)
- Intentional bug fixes requested separately
- Phase 6 cleanup **after** explicit sign-off and visual regression on Items + Item Categories

**Provider wiring (frozen):** both pages use `ListWorkspaceProvider` in `app/(workspace)/items/page.tsx` and `app/(workspace)/items/categories/page.tsx`.

---

## Current state (baseline)

| Layer | Glass V2? | Notes |
|-------|-----------|--------|
| Items + Item categories list workspace | Yes | `ListModuleShell` + `catalogBody` layout flag |
| All other `ListModuleShell` list modules | Yes | Default `surface="glass-v2"`; `ListWorkspaceModuleFrame` is split-detail provider only |
| Dashboard shell (sidebar, top strip, mobile nav) | Yes | `GLASS_V2_APP_SHELL_ROOT` + `--gs-*` tokens |
| Module overviews (`/inventory`, `/sales`, …) | Yes | `OverviewGlassShell` |
| Settings terminals | Yes | `SettingsGlassShell` + glass nav/sticky chrome |
| Light theme | Yes | `theme-light-glass` (cool slate; warm palette retired) |
| Appearance preview (`data-appearance-root`) | Parallel stack | Document designer / dev preview only — not production paths |

---

## Two CSS stacks (merge carefully)

1. **Live Glass V2 list workspace** — `.list-workspace-root`, `--lw-*` variables, matrix/split rules under `globals.css` § “Shared list workspace”.
2. **Appearance preview** — `[data-appearance-root] .list-module-revamp`, `ModulePreviewShell`, `AppearancePreviewProvider`.

Phase 0 must **alias**, not replace, until Phase 6. Items/Categories depend on stack (1), not preview toggles.

---

## Global guardrails (every phase)

- [x] **Single shell path:** `ListModuleShell` `surface` defaults to `"glass-v2"`; Items/Categories use `catalogBody` for matrix vs split layouts (no external glass wrapper).
- [ ] **No blind `revamp-catalog-body` on all layouts:** Items matrix omits it; Item Categories use it on **tree/split only**, not table/matrix. Body wrappers must be layout-aware or per-module.
- [ ] **Header extraction:** Phase 3A builds `UnifiedCatalogHeader` by **copying** from Items/Categories; do not refactor frozen headers in the same PR as first consumer migration.
- [ ] **Visual check:** After each phase, smoke-test `/items` and `/items/categories` (split + table views).
- [ ] **No warm / legacy accent hovers in glass scopes:** Do not introduce new ghost/outline `Button` hovers (`hover:bg-accent`) under `.list-workspace-root`, `.glass-v2-root`, `.mutation-glass-root`, or `.item-editor-shell`. Use `Switch`, `hover:bg-muted/*`, or scoped glass utilities instead. Warm light theme is retired; cool slate is `theme-light-glass`.

---

## Phase 0 — Unify CSS & document tokens

**Goal:** Single documented token surface; no visual change on frozen modules.

### Do

- [ ] Add `.glass-v2-root` as an **alias** selector alongside `.list-workspace-root` in `globals.css` (duplicate or grouped selectors).
- [ ] Extend `list-module-chrome.ts` with any missing exports (e.g. `GLASS_V2_ROOT` alias constant if desired).
- [ ] Document tokens in this file + short pointer in `DESIGN_SYSTEM.md`.
- [ ] Inventory duplicate rules between `[data-appearance-root] .list-module-revamp` and `.list-workspace-root` for Phase 6.

### Do not touch

- `items-list-workspace-terminal.tsx`, `category-management-terminal.tsx`
- Unified catalog header components (Items/Categories)
- Matrix/split table implementations beyond CSS selector aliases

### Files (typical)

| File | Action |
|------|--------|
| `apps/web/app/globals.css` | Alias selectors only |
| `apps/web/lib/layout/list-module-chrome.ts` | Additive exports |
| `docs/DESIGN_SYSTEM.md` | Link to this plan |
| `docs/GLASS_V2_PLAN.md` | This document |

---

## Phase 1 — App chrome (dashboard shell)

**Goal:** Glass V2 look on global navigation without changing list terminals.

### Do

- [ ] `components/layout/dashboard-shell.tsx`
- [ ] `components/layout/sidebar-nav.tsx`
- [ ] `components/layout/top-utility-strip.tsx`
- [ ] `components/layout/mobile-bottom-nav.tsx`
- [ ] `components/layout/mobile-nav-drawer.tsx`
- [ ] `components/layout/module-nav.tsx` (if chrome tokens apply)

### Do not touch

- Any `*management-terminal.tsx` (including Items/Categories)
- `list-module-shell.tsx` behavior (styling-only OK if scoped to shell chrome, not list body)

### Verify

- [ ] `/items`, `/items/categories` unchanged in list area; only surrounding shell updates.

---

## Phase 2 — `ListModuleShell` Glass V2 (opt-in) + skeletons

**Goal:** Other list modules can enable Glass V2 without forcing frozen modules to change.

### Do

- [ ] Add `surface="glass-v2"` (or equivalent) to `components/layout/list-module-shell.tsx` — applies `LIST_WORKSPACE_GLASS_V2_ROOT` on an inner wrapper when set.
- [ ] Default `surface="classic"` for all existing callers.
- [ ] Update **non-frozen** catalog skeletons only (see list below).

### Do not touch (this phase)

| File | Reason |
|------|--------|
| `components/items/items-list-workspace-terminal.tsx` | Already wraps shell externally |
| `components/categories/category-management-terminal.tsx` | Same |
| `components/items/items-list-page-skeleton.tsx` | Frozen reference |
| `components/categories/category-catalog-page-skeleton.tsx` | Frozen reference |

### Skeletons — migrate in Phase 2

- `components/entities/entity-catalog-page-skeleton.tsx`
- `components/entity-categories/entity-category-catalog-page-skeleton.tsx`
- `components/inventory/stock/stock-catalog-page-skeleton.tsx`
- `components/inventory/transfers/transfer-catalog-page-skeleton.tsx`
- `components/procurement/purchase-orders/po-catalog-page-skeleton.tsx`
- `components/procurement/goods-receipts/grn-catalog-page-skeleton.tsx`
- `components/procurement/bills/bill-catalog-page-skeleton.tsx`
- `components/procurement/quality-inspection/qc-inspection-catalog-page-skeleton.tsx`
- `components/sales/orders/so-catalog-page-skeleton.tsx`
- `components/sales/quotes/quote-catalog-page-skeleton.tsx`
- `components/sales/invoices/invoice-catalog-page-skeleton.tsx`
- `components/fulfillment/shipping/fulfillment-shipping-catalog-page-skeleton.tsx`
- `components/settings/tax/tax-settings-page-skeleton.tsx`
- `components/products/product-catalog-page-skeleton.tsx` (if still used)

### List modules — enable `surface="glass-v2"` later (Phase 2 optional pilot or Phase 3B)

Hold until header/toolbar patterns are ready; shell support alone is enough for Phase 2.

---

## Phase 3A — `UnifiedCatalogHeader` + Entities + Entity categories

**Goal:** Tier A party lists match Items-style unified header (title, count, filter, toolbar strip).

**Important:** **Entity categories** ≠ **Item categories**.

| | Routes | Terminal |
|---|--------|----------|
| Entity categories | `/sales/customers/categories`, `/procurement/suppliers/categories`, `/entities/*/categories` | `entity-category-management-terminal.tsx` |
| Item categories (frozen) | `/items/categories` | `category-management-terminal.tsx` |

### Do

- [ ] Create shared `components/layout/unified-catalog-header.tsx` (extract from Items/Categories **copies**, not in-place refactors).
- [ ] Migrate `components/entities/entity-management-terminal.tsx` (+ routes via `entity-catalog-loader.tsx`).
- [ ] Migrate `components/entity-categories/entity-category-management-terminal.tsx`.
- [ ] Enable `ListModuleShell` `surface="glass-v2"` on migrated terminals.
- [ ] Replace `ListModulePageTitleHeader` usage on entity lists where appropriate.

### Do not touch

- `items-unified-catalog-header.tsx` / `categories-unified-catalog-header.tsx` (until optional consolidation epic)
- `category-management-terminal.tsx` and all `components/categories/*` matrix/split/tree code

### Routes served

- `/sales/customers`, `/procurement/suppliers` (entity lists)
- `/sales/customers/categories`, `/procurement/suppliers/categories`

---

## Phase 3B — Tier B operational & line-entry lists

**Goal:** Document-style lists (PO, GRN, stock, transfers, sales docs, procurement ops) on Glass V2 shell; keep drawer/line-entry behavior.

### Do — enable `surface="glass-v2"` + visual pass on:

**Inventory**

- [ ] `components/inventory/stock/stock-management-terminal.tsx` — `/inventory/stock`
- [ ] `components/inventory/transfers/transfer-management-terminal.tsx` — `/inventory/transfers`

**Procurement**

- [ ] `components/procurement/purchase-orders/po-management-terminal.tsx`
- [ ] `components/procurement/goods-receipts/grn-management-terminal.tsx`
- [ ] `components/procurement/goods-in-transit/git-management-terminal.tsx`
- [ ] `components/procurement/quality-inspection/qc-inspection-management-terminal.tsx`
- [ ] `components/procurement/shipments/shipment-management-terminal.tsx`
- [ ] `components/procurement/subcontract/subcontract-management-terminal.tsx`
- [ ] `components/procurement/bills/bill-management-terminal.tsx`

**Sales**

- [ ] `components/sales/orders/so-management-terminal.tsx`
- [ ] `components/sales/quotes/quote-management-terminal.tsx`
- [ ] `components/sales/invoices/invoice-management-terminal.tsx`
- [ ] `components/sales/payments/payment-management-terminal.tsx`

**Fulfillment**

- [ ] `components/fulfillment/shipping/fulfillment-shipping-management-terminal.tsx`

**Settings (list-style)**

- [ ] `components/settings/tax-settings-terminal.tsx`

### Do not touch

- Items / Item categories terminals
- Drawer form innards unless needed for glass **panel** borders (prefer Phase 3B scoped CSS classes)

### Out of scope unless added explicitly

- Item detail/edit drawers (`/items/[id]`, product editor)
- Procurement module **settings** terminal (`procurement-module-settings-terminal.tsx`) — Phase 3C

---

## Phase 3C — `SettingsGlassShell` for `/settings/*` (shipped)

- [x] `components/settings/settings-glass-shell.tsx`
- [x] `components/settings/shells/settings-hub-shell.tsx`, `settings-form-shell.tsx`, `settings-workspace-shell.tsx`
- [x] `app/(workspace)/settings/layout.tsx` secondary settings nav
- [x] Applied across company, enterprise, access, operations, catalogs, presentation, and locations terminals

### Do not touch

- Items / Item categories
- List workspace matrix/split internals

---

## Phase 4 — Command center primitives + module overviews

**Goal:** V2 overview landings; retire procurement preview toggle.

### Do

- [ ] Extract shared overview primitives (KPI tile, shortcut card, section shell) aligned with `--lw-*` or new `--hub-*` tokens.
- [ ] Migrate overview terminals:
  - `components/inventory/inventory-overview-terminal.tsx` — `/inventory`
  - `components/sales/sales-overview-terminal.tsx` — `/sales`
  - `components/fulfillment/fulfillment-overview-terminal.tsx` — `/fulfillment`
  - Entities landing (currently redirects to `/sales` — implement or align with sales overview)
- [x] Ship `procurement-overview-terminal-v2.tsx` as default; remove `ProcurementOverviewPreviewShell` from `app/(workspace)/procurement/page.tsx`.
- [x] Delete or gate `components/procurement/procurement-overview-preview-shell.tsx` and preview bar for procurement overview.

### Do not touch

- Items list workspace (`/items`)
- Item categories list workspace (`/items/categories`)

### Preview infra (keep until Phase 6)

- `components/appearance/module-preview-shell.tsx` — still used by document designer previews until Phase 6 audit.

---

## Phase 5 — Dashboard hub alignment

**Goal:** Dashboard command hub uses same glass language as overviews.

### Do

- [ ] `components/dashboard/hub-panel.tsx`
- [ ] `components/dashboard/metric-card.tsx`
- [ ] `components/dashboard/control-panel.tsx`
- [ ] `components/dashboard/getting-started-checklist.tsx`
- [ ] `components/dashboard/approval-queue-panel.tsx`
- [ ] `app/(workspace)/dashboard/page.tsx` composition

### Do not touch

- List modules (Items, Categories, operational lists)

---

## Phase 6 — Cleanup & deprecation

**Goal:** One CSS stack; no duplicate preview paths; documented rules.

### Do

- [ ] Remove duplicate CSS between `[data-appearance-root]` revamp blocks and `.list-workspace-root` where safe.
- [ ] Consolidate `.glass-v2-root` and `.list-workspace-root` to a single selector if aliasing no longer needed.
- [ ] Deprecate appearance preview infra where unused (audit `ModulePreviewShell` consumers).
- [ ] Replace hard-coded hex in list-workspace tokens with theme variables where possible.
- [ ] Update `.cursorrules` / agent rules with Glass V2 token names.
- [x] **Optional consolidation:** fold Items/Categories external `LIST_WORKSPACE_GLASS_V2_ROOT` wrapper into `ListModuleShell` + merge unified headers — **only after** full regression.

### Do not touch without explicit approval

- Frozen module behavior (sort, bulk, matrix resize, split peek) — styling consolidation only

---

## Module coverage matrix

| Area | Route(s) | Phase | Glass V2 today |
|------|----------|-------|----------------|
| Items | `/items` | Frozen reference | Yes |
| Item categories | `/items/categories` | Frozen reference | Yes |
| Entity customers/suppliers | `/sales/customers`, `/procurement/suppliers` | 3A | Yes |
| Entity categories | `*/customers/categories`, `*/suppliers/categories` | 3A | Yes |
| Inventory overview | `/inventory` | 4 | Yes |
| Stock / transfers | `/inventory/stock`, `/inventory/transfers` | 3B | Yes |
| Procurement overview | `/procurement` | 4 | Yes (command center) |
| PO, GRN, GIT, QC, shipments, subcontract, bills | `/procurement/*` | 3B | Yes |
| Sales overview | `/sales` | 4 | Yes |
| SO, quotes, invoices, payments | `/sales/*` | 3B | Yes |
| Fulfillment overview | `/fulfillment` | 4 | Yes |
| Fulfillment shipping | `/fulfillment/shipping` | 3B | Yes |
| Settings | `/settings/**` | 3C | Yes |
| Dashboard | `/dashboard` | 5 | Yes |
| Financials | `/financials` | — | Coming soon (glass shell) |
| Approvals | `/approvals` | — | Yes |
| Account | `/account` | — | Profile settings (glass) |

---

## Quick reference — all `ListModuleShell` consumers

| Terminal | Frozen? | Target phase |
|----------|---------|----------------|
| `items-list-workspace-terminal.tsx` | **Yes** | — |
| `category-management-terminal.tsx` | **Yes** | — |
| `entity-management-terminal.tsx` | No | 3A |
| `entity-category-management-terminal.tsx` | No | 3A |
| `stock-management-terminal.tsx` | No | 3B |
| `transfer-management-terminal.tsx` | No | 3B |
| `po-management-terminal.tsx` | No | 3B |
| `grn-management-terminal.tsx` | No | 3B |
| `git-management-terminal.tsx` | No | 3B |
| `qc-inspection-management-terminal.tsx` | No | 3B |
| `shipment-management-terminal.tsx` | No | 3B |
| `subcontract-management-terminal.tsx` | No | 3B |
| `bill-management-terminal.tsx` | No | 3B |
| `so-management-terminal.tsx` | No | 3B |
| `quote-management-terminal.tsx` | No | 3B |
| `invoice-management-terminal.tsx` | No | 3B |
| `payment-management-terminal.tsx` | No | 3B |
| `fulfillment-shipping-management-terminal.tsx` | No | 3B |
| `tax-settings-terminal.tsx` | No | 3B / 3C |

---

## Acceptance criteria (rollout complete)

- [ ] Every module in the coverage matrix marked “planned” ships Glass V2 on its primary landing UI.
- [ ] `/items` and `/items/categories` pixel-stable vs pre-rollout (or documented intentional improvements).
- [x] No module relies on `ModulePreviewShell` for production overview (procurement retired).
- [ ] `DESIGN_SYSTEM.md` and this plan agree on token names and frozen modules.
- [ ] New list modules default to `ListModuleShell` `surface="glass-v2"` and shared headers where applicable.
