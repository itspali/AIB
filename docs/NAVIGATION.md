# AIB Smart ERP: Navigation & Information Architecture Specification

This document is the navigation/IA blueprint for the AIB workspace. The structure described here is
**implemented** (see §8 for per-phase status). It builds on the frozen layout primitives defined in
[DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) (top strip, collapsible left rail, master-list/drawer/editor
patterns) and changes **information architecture and structure only** — the Items Master and
Organization Settings internal layouts stay frozen.

---

## 1. Current State (as of 2026-06-09)

| Area | Today | Source |
|------|-------|--------|
| Primary rail | Dashboard, **Items** (Catalog/Categories), Procurement, **Inventory** (Overview/Stock/Transfers), Sales, Fulfillment & Shipping, Financials, **Administration** | [module-nav.tsx](../apps/web/components/layout/module-nav.tsx) |
| Built operational modules | **Dashboard**, **Items** catalog, **Inventory** (overview + stock + transfers), **Procurement** (PO + GRN), **Entities** (customers + suppliers), **Administration** (org, locations, tax, profile, group) | `apps/web/app/**` |
| Coming soon shells | Procurement Bills; Sales, Fulfillment, Financials transactional UIs; Users & Roles | `comingSoon: true` in `module-nav.tsx` |
| Locations | Under **Administration → Locations** (`/settings/locations`), not Inventory children | `module-nav.tsx` |
| Inventory ops detail | Stock, transfers, opening stock, overview — see [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md) | — |
| Secondary nav | Left sidebar expands active module's children (Overview / Stock / …) | [sidebar-nav.tsx](../apps/web/components/layout/sidebar-nav.tsx) |
| Global create | Top-strip menu | [global-create-menu.tsx](../apps/web/components/layout/global-create-menu.tsx) |
| Mobile | Bottom bar + module drawer | [mobile-bottom-nav.tsx](../apps/web/components/layout/mobile-bottom-nav.tsx) |

### Remaining IA gaps

1. **Procurement / Sales / Financials** — Procurement PO + GRN built; Sales and Financials transactional UIs mostly unbuilt (see [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md) §6).
2. **Breadcrumbs** — not implemented (by design; sidebar carries location context — see §8).
3. **Units of Measure** — settings route exists; management UI partial/coming soon.

---

## 2. Target Information Architecture

```mermaid
flowchart TB
  subgraph rail [Primary left rail - frozen w-64 / w-16]
    D[Dashboard]
    P[Procurement]
    I[Inventory]
    S[Sales]
    L[Logistics]
    F[Financials]
    A[Administration]
  end

  I --> Ihome[Overview]
  I --> Istock[Stock]
  I --> Ixfer[Transfers]

  subgraph itemsMod [Items module]
    It[Catalog]
    Icat[Categories]
  end

  A --> Aloc[Locations]
  A --> Auom["Units of Measure (pending)"]

  A --> Aorg[Organization]
  A --> Atax[Tax]
  A --> Ausers["Users & Roles"]
  A --> Anum[Numbering]
  A --> Aacct[My Account]
```

### Module → section map

| Module | Root route | Sections | Status |
|--------|-----------|----------|--------|
| **Dashboard** | `/dashboard` | (single page) | Built |
| **Items** | `/items` | Catalog, Categories | Built |
| **Inventory** | `/inventory` | Overview, Stock, Transfers | **Built** (ops); catalog also at `/inventory/items` aliases |
| **Procurement** | `/procurement` | Overview, Purchase Orders, Suppliers, Bills | Coming soon — **GRN next** ([`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md)) |
| **Sales** | `/sales` | Customers, Quotes, Orders, Invoices | Coming soon |
| **Fulfillment & Shipping** | `/fulfillment/shipping` | (single) | Coming soon |
| **Financials** | `/financials` | Overview, COA, Ledger, Tax Filings | Coming soon |
| **Administration** | `/settings` | Organization, **Locations**, UoM, Tax, Users & Roles, My Account | Built (Users coming soon; numbering inside Locations + Org) |

Modules marked "Coming soon" render a **Coming-soon module shell** (overview page with greyed,
labeled sections) instead of 404ing. Built modules resolve their root to an **Overview** landing.

---

## 3. Responsive Secondary Navigation

One nav model, two responsive presentations (no new visual language — reuse existing components):

```mermaid
flowchart LR
  subgraph lg ["lg+ desktop"]
    PR1[Primary rail] --> SR[Secondary sub-rail<br/>module sections]
    SR --> CV1[Canvas + master-list]
  end
  subgraph sm ["< lg tablet / mobile"]
    PR2[Primary rail / bottom nav] --> CV2["Header + horizontal sub-tabs"]
  end
```

- **`lg+` (desktop): secondary sub-rail.** Between the primary rail and the canvas, using
  `lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-6`. Reuse the shipped rail treatment: active
  `bg-secondary font-medium text-secondary-foreground`, inactive
  `text-muted-foreground hover:bg-muted/60 hover:text-foreground` (same as the editor / org-settings
  rail).
- **`< lg` (tablet/mobile): horizontal sub-tabs.** The sub-rail collapses into a sticky horizontal
  bar under the page header, reusing
  [section-scroll-chip-bar.tsx](../apps/web/components/layout/section-scroll-chip-bar.tsx) — the same
  component already used for in-form section nav. Active chip
  `border-primary text-foreground ring-1 ring-inset ring-primary`.
- The sub-nav lives inside `<main data-dashboard-scroll-root>` and must not introduce a nested scroll
  root (per DESIGN_SYSTEM §1.3).

---

## 4. Module Landing / Overview Pages

- Each module root (`/inventory`, `/procurement`, …) resolves to an **Overview**: KPI tiles +
  shortcut cards to sections + recent records.
- Built modules show live data; unbuilt modules show a Coming-soon overview listing planned sections
  (greyed) with a single descriptive empty-state block (per DESIGN_SYSTEM §8).
- Cards/tiles use `surface-panel`; section titles use the standard
  `text-sm font-semibold uppercase tracking-wide text-muted-foreground`.

---

## 5. Administration Hub

New `/settings` (Administration) becomes a first-class module with its own secondary sub-rail:

| Section | Route | Component (existing) |
|---------|-------|----------------------|
| Organization | `/settings/organization` | `OrganizationSettingsTerminal` (frozen) |
| **Tax** | `/settings/tax` | `TaxSettingsTerminal` (currently unlinked) |
| Users & Roles | `/settings/users` | new (RBAC schema exists) |
| Numbering | `/settings/numbering` | extract/relink from org settings numbering |
| My Account | `/settings/profile` | `ProfileSettingsTerminal` |

- This directly fixes "I can't see Tax Settings."
- Avatar dropdown is trimmed to **My Account**, **Switch Workspace** (when multi-tenant), and **Sign
  Out**; the configuration links move into the Administration rail
  ([user-profile-actions.tsx](../apps/web/components/layout/user-profile-actions.tsx)).
- The omnibar navigation index ([navigation-index.ts](../apps/web/lib/search/navigation-index.ts))
  is kept in sync with all new routes.

---

## 6. Breadcrumbs & Global Create

- **Breadcrumbs**: a row under the top strip on `md+` showing `Module › Section › Record`
  (e.g. `Inventory › Items › ACME-001`). Hidden on mobile to preserve vertical space. Rendered by the
  shell so every page inherits it.
- **Global "+ Create"**: a top-strip menu beside the omnibar
  ([top-utility-strip.tsx](../apps/web/components/layout/top-utility-strip.tsx)) offering
  context-aware shortcuts (New Item, New Category, New Location, …) using Lucide icons. This is the
  NetSuite/Dynamics quick-create pattern.

---

## 7. Mobile Reconciliation

- The 6-cell bottom bar cannot cleanly hold 7 destinations. Keep the **4–5 highest-frequency
  modules** as tabs plus a **"More" tab** that opens the existing module drawer
  ([mobile-nav-drawer.tsx](../apps/web/components/layout/mobile-nav-drawer.tsx)) containing the
  remaining modules + Administration.
- In-module section navigation on mobile uses the "More" drawer's expanded module group (no separate in-content section nav).
- Aligns with DESIGN_SYSTEM §2.1/§2.2 (bottom tab bar + "More" drawer).

---

## 8. Implementation Phases (status)

| Phase | Deliverable | Status | Key files |
|-------|-------------|--------|-----------|
| 1. Nav model | Section-per-module config + `comingSoon`/`mobilePrimary` flags + Administration entry | Done | [module-nav.tsx](../apps/web/components/layout/module-nav.tsx), [module-nav-active.ts](../apps/web/lib/layout/module-nav-active.ts) |
| 2. Secondary nav | Sections live in the left sidebar (expanded module group); no separate in-content section nav or title chrome | Done | [sidebar-nav.tsx](../apps/web/components/layout/sidebar-nav.tsx), [module-nav-active.ts](../apps/web/lib/layout/module-nav-active.ts) |
| 3. Administration hub | `/settings` overview + sub-rail; Tax/Org/Users/Profile linked; avatar dropdown trimmed; omnibar synced | Done | `app/settings/page.tsx`, `app/settings/users/page.tsx`, [user-profile-actions.tsx](../apps/web/components/layout/user-profile-actions.tsx), [navigation-index.ts](../apps/web/lib/search/navigation-index.ts) |
| 4. Module landings | Overview pages + Coming-soon shell | Done | `app/{inventory,procurement,sales,logistics,financials}/page.tsx`, [module-overview.tsx](../apps/web/components/layout/module-overview.tsx), [coming-soon-module.tsx](../apps/web/components/layout/coming-soon-module.tsx) |
| 5. Create | Global create menu in the top strip; each page renders its own title/subtitle + create action | Done | [global-create-menu.tsx](../apps/web/components/layout/global-create-menu.tsx), [top-utility-strip.tsx](../apps/web/components/layout/top-utility-strip.tsx) |
| 6. Mobile | Bottom-nav "More" tab + drawer Soon badges | Done | [mobile-bottom-nav.tsx](../apps/web/components/layout/mobile-bottom-nav.tsx), [mobile-nav-drawer.tsx](../apps/web/components/layout/mobile-nav-drawer.tsx) |
| 7. Docs sync | DESIGN_SYSTEM references this IA | Done | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| 8. Inventory ops | Stock, Transfers, Overview, opening stock, omnibar scopes, in-transit drill-down | Done | [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md), `app/inventory/{stock,transfers}/` |
| 9. Procurement ops | PO + GRN list modules, line-entry drawers, PO→GRN deep link | Done | [`PO_UX_PLAN.md`](./PO_UX_PLAN.md), [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) §5.4, `app/procurement/{purchase-orders,goods-receipts}/` |

### Implementation notes / deviations

- Numbering is configured inside Organization settings, so it is **not** a separate Administration
  route; the Administration overview notes this.
- Section navigation is handled entirely by the **left sidebar**: an active module expands to list
  its sections (Overview/Items/Categories/…) with the active one highlighted. There is no
  in-content section rail, tab strip, breadcrumb, or persistent module title — this saves vertical
  space and avoids duplicating the sidebar. Each page renders its own title/subtitle plus its
  create/New action on the right.
- Units of Measure and Users & Roles are surfaced as **Coming soon** (no dead links).

---

## 9. Constraints

- **Frozen layouts**: Items Master and Organization Settings internal list/drawer/editor structure is
  not changed; they only gain the surrounding secondary sub-rail and breadcrumb.
- **No new visual system**: reuse existing tokens, `SectionScrollChipBar`, rail active/inactive
  states, `surface-panel`, and Lucide icons only.
- **Single scroll root**: all content continues to scroll inside `<main data-dashboard-scroll-root>`;
  the secondary nav must not shadow it.
- **List modules**: every records-list section (Items, Categories, Entities, Stock, Transfers, PO, GRN, future Sales docs) follows the List Module Replication Checklist in DESIGN_SYSTEM §9 — pick Tier A, Tier B, or Tier B line-entry (§5.4).
