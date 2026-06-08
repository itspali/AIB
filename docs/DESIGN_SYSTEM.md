# AIB Smart ERP: Frontend Core Design System

This document is the **finalized, code-grounded** layout and component standard for the AIB
responsive web framework (Next.js App Router + Tailwind CSS + Shadcn/UI + Lucide React).

The standard is derived from reference implementations that are considered **frozen**:
- **Items Master** (`/items`, alias `/inventory/items`) — full catalog list module (dual views, bulk select, saved views).
- **Operational list modules** (`/inventory/stock`, `/inventory/transfers`) — lean document lists via `ListModuleShell`; see §3.7 and [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md).
- **Organization Settings** (`/settings/organization`) — single-page configuration forms.
- **Module overview landings** (`/inventory`, `/procurement`, …) — KPI tiles + shortcut cards; see [`NAVIGATION.md`](./NAVIGATION.md) §4.

> Source-of-truth rule: where any older spec or sketch disagrees with the shipped Items Master or
> Organization Settings, **the shipped code wins**. Do not change the Items Master or Organization
> Settings layout to match a document — change the document. All Tailwind classes, widths, and file
> references below reflect the actual implementation.

---

## 1. Global Navigation Framework (Dashboard Shell)

The app chrome is the `DashboardShell` (`apps/web/components/layout/dashboard-shell.tsx`). It is a fixed-height flex column (`flex h-screen flex-col overflow-hidden bg-background`) containing a top strip, a horizontal body (sidebar + scrolling main), and the mobile navigation.

### 1.1 Top Utility Strip (Zone A)
`apps/web/components/layout/top-utility-strip.tsx`
- **Fixed height `h-16`**, pinned at the top: `relative z-20 w-full shrink-0 border-b border-border bg-background/80 backdrop-blur-xl`.
- Left: sidebar collapse toggle (`PanelLeftOpen` / `PanelLeftClose`, `h-4 w-4`) and, when the sidebar is expanded, the org branding block (logo mark `h-7 w-7` gradient tile + org name `truncate text-sm font-semibold`).
- Center/right row: `flex min-w-0 flex-1 items-center gap-2 pl-2 pr-4 md:gap-4 md:pl-3 md:pr-6`.
- **Omnibar search** (`OmnibarSearchTrigger`): `h-10 w-full ... rounded-xl border border-border bg-card/60 px-3 text-sm`, with a `⌘K` / `Ctrl+K` kbd hint at `lg:inline-flex`. Hidden below `md`, replaced by a ghost `Search` icon button.
- Approvals badge (`variant="action_required"` with `AlertTriangle h-3 w-3`) when pending > 0, otherwise an "All clear" `locked` badge (`hidden md:inline-flex`).
- `ThemeToggle`, then the user avatar (`UserProfileMenu` → `UserProfileTrigger`, avatar `h-8 w-8 rounded-full`).
- **Org / workspace switcher** lives inside the user profile dropdown ("Switch Workspace Instance", `Building2 h-4 w-4`), shown when the operator belongs to more than one tenant. It is **not** a separate top-strip control.

### 1.2 Collapsible Left Rail (Zone B)
`apps/web/components/layout/sidebar-nav.tsx`
- **Expanded state: `w-64`** (labels + icons). **Slim state: `w-16`** (icons only). Transition: `transition-all duration-200`.
- `aside` classes: `hidden h-full shrink-0 flex-col border-r border-white/10 bg-card/40 backdrop-blur-xl ... md:flex`. The rail is **hidden below `md`** and only renders on `md+`.
- Nav link row: `group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-normal ... hover:bg-white/5`. Active items use `nav-glow-active`.
- Collapsed groups render as icon-only buttons with a `DropdownMenu side="right"`.
- Collapse state is owned by `OnboardingContext` (`sidebarCollapsed`); on tablet (`min-width: 768px and max-width: 1023px`) the rail **auto-collapses** on mount.
- Module entries come from `module-nav.tsx` (Dashboard, Procurement, **Items**, **Inventory** (Overview/Stock/Transfers), Sales, Fulfillment & Shipping, Financials, **Administration**), all icons Lucide. Locations live under Administration (`/settings/locations`), not Inventory children.

### 1.3 Active Workspace Canvas (Zone C)
- The scroll container is the single `<main data-dashboard-scroll-root>` element: `relative min-h-0 min-w-0 flex-1 overflow-y-auto` + `hub-canvas` background.
- **`data-dashboard-scroll-root` is load-bearing**: it is the scroll root that section-nav scroll spies and `scrollElementInDashboardRoot()` target. Never add an inner `overflow-y-auto` wrapper that would shadow it.
- Inner content padding uses the `canvas-workspace-pad` utility: `px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8`.
- Pages that must clear the mobile bottom nav add `canvas-scroll-endpad`: `pb-16 md:pb-6 lg:pb-8`.
- The canvas spans 100% of the remaining viewport width — **no fixed vertical split panes**.

---

## 2. Responsive Breakpoints & Mobile Adaptation

Tailwind breakpoints drive every shell transition. The functional cutover is **`md` (768px)**.

| Breakpoint | Width | Shell behavior |
|------------|-------|----------------|
| `< md` | mobile | Sidebar hidden; **bottom tab bar** visible; module drawer available; drawers open full-screen (`100vw`). |
| `md` – `lg` | tablet | Sidebar visible but **auto-collapsed** to `w-16`; bottom nav hidden; omnibar in header. |
| `lg+` | desktop | Full `w-64` sidebar; desktop section rail; right drawer width cycle (40/60/80) enabled. |

### 2.1 Bottom Navigation Tab Bar
`apps/web/components/layout/mobile-bottom-nav.tsx`
- `fixed inset-x-0 bottom-0 z-50 ... md:hidden`, height `h-14`, plus `pb-[env(safe-area-inset-bottom)]`.
- Surface: `border-t border-white/10 bg-background/85 backdrop-blur-xl`.
- Lays out the module entries as `grid h-14 grid-cols-6` (one cell per top-level module).
- Tab label `text-[10px] font-medium leading-none`; active indicator `absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary shadow-glow-sm`; icons Lucide `size-4`.

### 2.2 Module Navigation Drawer
`apps/web/components/layout/mobile-nav-drawer.tsx`
- Shadcn `Sheet side="left"`: `flex flex-col border-white/10 bg-card/95 p-0 backdrop-blur-xl`.
- Opened from the sidebar toggle in the top strip on mobile (`md:hidden`, `aria-label="Open module navigation"`).
- Renders the full module tree, including expandable groups via `MobileDrawerNavGroup`.

### 2.3 Responsive Form Columns
Form field grids collapse from multi-column to a single stack:
- Master form sections (inside sliding drawer contexts): `grid grid-cols-1 gap-4 sm:grid-cols-2`; full-width fields use `sm:col-span-2`.
- Organization Settings sections: `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3`; wide fields span `md:col-span-2 lg:col-span-2`.
- Mobile (`< sm`): always a 1-column full-width stack.

---

## 3. Master Data List Standard (The Items Master Pattern)

**Full catalog modules** (Items, future Customers/Suppliers with rich metadata) MUST replicate this pattern. The canonical implementation is the Items catalog at `/items`.

**Operational document modules** (stock adjustments, transfers, GRNs) use the leaner pattern in §3.7 — same drawer URL rules, without dual views or bulk selection unless explicitly required.

### 3.1 Full-Width Layout
- The list claims **100% of the canvas width**. There is **no left-stream / right-canvas split** and no fixed split-pane restriction. Root container style uses `space-y-3`.
- The page header is `mb-4 sm:mb-5 md:mb-5`: title `min-w-0 truncate text-2xl font-bold tracking-tight`.
- The primary **Create Action CTA** aligns to the right side of the page header container. It uses `Button` and programmatically updates the shallow URL router matrix to trigger creation workflow initialization context directly inside the single workspace frame canvas rather than routing away to an independent page.

### 3.2 Dual View Modes
A view toggle in the toolbar switches between two presentations of the same records:
1. **Table view**: scroll container `surface-inset overflow-x-auto [scrollbar-gutter:stable]`; table `w-full min-w-[720px] border-separate border-spacing-0 bg-background text-sm`; header row `bg-muted/40 text-left`.
2. **Compact card view**: `grid gap-3` with responsive columns (`grid-cols-1`, `md:grid-cols-2`, up to `lg:grid-cols-4` depending on the chosen density).

### 3.3 Row Packing Density & Typography Hierarchy
- **Density**: cell padding `p-2.5` (image cells `p-1`); rows divided by `border-b border-border`. No fixed viewport height — the first server page is **100 rows** and a "Load more" control appends additional pages. This packs well past 12 visible rows on a standard desktop viewport before scrolling.
- **Line 1** (primary identifier): `font-medium` (Name/Code/SKU). SKU/barcode use `font-mono text-muted-foreground`.
- **Line 2** (muted subtext / variant rows): `mt-0.5 block truncate text-xs font-normal text-muted-foreground`.
- **Right-aligned numerics**: monetary and quantity columns (`selling_price`, `purchase_price`, `stock_on_hand`) use `text-right tabular-nums`, values wrapped in `<span className="tabular-nums">`.
- Compact card: line-1 name `text-base font-semibold leading-tight`, line-2 subline `truncate text-xs text-muted-foreground`, thumbnail `h-14 w-14 rounded-lg ... sm:h-16 sm:w-16`.

### 3.4 Row Interaction & Selection
- Body row: `group cursor-pointer transition-colors duration-[25ms]`.
- **Hover**: subtle background tint on unfrozen cells (`group-hover:bg-[hsl(214_28%_96%)]` / dark `color-mix` accent).
- **Selected (drawer open)**: persistent `ring-1 ring-inset ring-primary/20` plus a tinted background; the compact card uses `border-primary/50 bg-primary/5 ring-1 ring-primary/20`.
- Clicking anywhere on a row invokes router push changes to reflect row targeting inside the URL query parameter state. This opens the **right-side drawer instantly** without shifting table columns (frozen columns keep their inset shadow).
- The bulk-selection checkbox column is `sticky left-0`, `w-10`, and **stops click propagation** so ticking a row does not inadvertently mutate URL tracking parameters or flash the open drawer canvas container.

### 3.5 Toolbar
Control shell component: `w-full min-w-0 rounded-lg border border-primary/25 bg-[color-mix(...)] px-3 py-2.5 shadow-sm sm:px-4 sm:py-3`:
- **Saved views** selector (`ModuleViewSelect`).
- **Category / primary filter** select (`h-8`).
- **Sort** control (compact view), **Show variants** switch (table view).
- **View toggle** (table vs compact): `inline-flex h-8 items-center rounded-md border border-border bg-muted p-0.5`, active button `bg-background text-primary shadow-sm`.
- **Column settings** dropdown (`ListColumnSettings`).
- **Global search** is the top-strip omnibar; **applied filters** render as an inline chip bar (`OmnibarFilterChipBar variant="inline"`) below the control shell.
- **Result count**: `text-xs text-muted-foreground` ("Showing X of Y").

### 3.6 Bulk Action Toolbar
Appears when selection count > 0: `sticky top-0 z-30 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm`. Desktop shows primary outline actions + destructive Archive + a "More" dropdown; mobile collapses to a single "Actions" dropdown. Selection label `truncate text-sm font-semibold tracking-tight`.

### 3.7 Operational Document List Modules (Stock / Transfers / GRN)

Use this **lean** variant when the module posts location-scoped inventory documents rather than editing rich master records.

**Canonical files:** `apps/web/components/inventory/stock/`, `apps/web/components/inventory/transfers/`, `apps/web/components/layout/list-module-shell.tsx`, `apps/web/lib/layout/use-module-drawer-url.ts`.

| Aspect | Full catalog (§3) | Operational (§3.7) |
|--------|-------------------|---------------------|
| Shell | Custom page layout | `ListModuleShell` + `*-catalog-loader.tsx` (RSC) |
| Views | Table + compact cards | **Table only** (or single view toggle when meaningful, e.g. Stock balances vs adjustments) |
| Bulk select | Sticky checkbox column | **None** |
| Toolbar | Saved views, column settings | `ListModuleToolbarRow` + filter extras (location, status) |
| Create CTA | Header + `?action=new` | Same; optional **prefill params** (see §4) |
| Drawer | Peek / edit / create | Same; operational forms may post via RPC in one step (adjustments) or multi-step status (transfers) |
| Empty state | `ProductEmptyState` or dashed prompt | Module-specific empty state with single **New …** CTA |
| Errors | Toast + inline | `UserFacingErrorMessage` with optional settings link (numbering, MWAC) |

**Module overview pages** (`/inventory`) are not list modules: they use metric cards + activity tables + deep links into Stock/Transfers drawers. See `inventory-overview-terminal.tsx`.

Domain rules for inventory ops: [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md).

---

## 4. Right-Side Slide-Over Drawer (URL-Driven Interface)

Clicking a list row or clicking the primary create button opens a contextual right-side drawer wrapper. The visibility, data context, and operational state of this drawer MUST be driven exclusively by browser URL query parameters as the single source of truth.

- **Shallow URL Matrix & States** (shared helpers in `lib/layout/module-drawer-url.ts`):
  - Base State (Closed): `/items` (or module route)
  - Read-Only Peek Mode: `?id=[uuid]`
  - Active Editing Mode: `?id=[uuid]&action=edit`
  - Instantiating Creation Mode: `?action=new`
- **Optional prefill params** (operational modules): preserve module-specific keys on create, clear on drawer close via `useModuleDrawerUrl(..., { clearParamsOnClose: [...] })`. Examples:
  - Stock adjust from balance: `?action=new&variant=[uuid]&loc=[location_uuid]`
  - Transfer from reorder: `?action=new&variant=[uuid]&dest=[location_uuid]&src=[location_uuid]` (source optional)
- **Router Implementation**: Use Next.js shallow routing (`router.push(..., { shallow: true })`) to manipulate query parameters. This changes the address bar and opens/closes the drawer instantly without executing expensive full-page server re-renders or losing background layout scroll state.
- **Desktop Width Matrix**: Defaults to **40vw** width for lightweight peeks. Features an interactive header toggle icon (`Maximize2` / `Minimize2`) that cycles the layout across **40vw → 60vw → 80vw** to easily fit complex tables or rich multi-column fields. The user's width preference persists in `sessionStorage` (key: `aib-right-drawer-width`).
- **Mobile Adaptation (< lg)**: The drawer auto-transforms into a **100vw full-screen takeover view**. The horizontal width step toggles are programmatically hidden.
- **Background Layer Interaction**: Peek mode initializes with `modal={false}` and `allowBackgroundInteraction=true`. The background list grid remains interactive, allowing operators to click other rows to cleanly switch the drawer data context without flickering layout shifts.
- **Keyboard Controls**: Pressing `Esc` strips the query parameters from the router, causing the active sheet to smoothly animate away.

---

## 5. Drawer Form Architecture & Navigation

Because data entry occurs within the sliding drawer space rather than an isolated page redirect, forms must elegantly support dense tabs or vertical layouts inside constraint-bounded viewports.

### 5.1 Inline Section Navigation & Scroll Spy
- **Expanded Layouts (60vw / 80vw)**: Utilizing a left-anchored sticky tab list (`w-48`) containing Lucide icons to quickly switch between data blocks.
- **Compact & Mobile Layouts (40vw / 100vw)**: A sticky horizontal segment bar (`SectionScrollChipBar`) sits pinned directly beneath the drawer header.
- **Scroll Tracking**: Driven by an `IntersectionObserver` targeted to the drawer's internal scroll container root.

### 5.2 Form States & Interactive Toggles
- **Read-Only Peek State**: Default view when an item is chosen (`?id=[uuid]`). All form input fields render inside a customized, disabled `read-only` state with minimalist borders to prevent accidental data contamination or keystroke modifications. The drawer header uses **icon-only** actions: **Edit** (`Pencil`), **Open full page** (`ExternalLink`), width cycle (`Maximize2`), and close (`X`).
- **Mutation State**: Triggered by clicking Edit or loading an explicit `action` param (`action=edit` or `action=new`). Form inputs transition to active, borders color-mix with primary theme tones, and a dedicated action footer slides into view.
- **Save Optimization Shortcut**: Pressing `Cmd+Enter` or `Ctrl+Enter` programmatically fires the validation engine and triggers the underlying Supabase database mutation. The primary submit button specifies this shortcut inside its floating native hover tooltip asset.
- **Sticky Control Footer**: Pinned permanently at the bottom edge of the sheet viewport layer: `sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 px-6 backdrop-blur`. Contains clear "Cancel" and "Save Changes" execution controls.

---

## 6. Single-Page Configuration Form (Organization Settings Pattern)

`organization-settings-terminal.tsx` is the canonical pattern for tenant-level configuration screens. It reuses Section 5's section-nav, scroll spy, and read-only/edit primitives but renders as one continuous scrollable form rather than routed slider variables.

- **Form wrapper**: `canvas-scroll-endpad flex flex-col gap-4 lg:gap-5`, driven by `react-hook-form` + `zodResolver`.
- **Sticky org header**: `sticky top-0 z-30 -mx-4 border-b border-border bg-background/95 backdrop-blur ... md:-mx-6 md:px-6` (the negative margins bleed it to the canvas edges). It holds the org name (`text-lg font-semibold sm:text-xl`), status badges (`text-[10px] font-medium`), and the **Edit / Save / Cancel** actions.
- **Read-only by default**: `isEditing = false`; `fieldsDisabled = !isEditing || isPending` is passed to every section. Cancel resets the form and exits edit mode; Save calls the server action, toasts, exits edit mode, and `router.refresh()`. (No `Cmd/Ctrl+Enter` shortcut here — submit only.)
- **Section navigation**: 8 tabs (Identity, Regional, Billing & Fiscal, Branding, Locations, Numbering, Accounting, Access). Desktop rail width `14rem`; mobile uses `SectionScrollChipBar`.
- **Scroll spy**: a custom `IntersectionObserver` whose root resolves to `<main data-dashboard-scroll-root>`; `rootMargin` accounts for the sticky org header + chip bar heights (measured via `ResizeObserver`). Programmatic jumps use `scrollElementInDashboardRoot()`.
- **Section card**: `OrgSettingsSection` — `rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6`.
- **Policy summary tiles**: inline hero card on `lg+` (`hidden ... lg:block`), standalone `surface-panel` on smaller viewports; grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.

---

## 7. Typography, Tokens & Surface Utilities

### 7.1 Type Family & Scale
- **Family**: Inter, exposed via the `--font-geist-sans` CSS variable; body is `font-sans antialiased`. Identifiers (SKU, tax/registration numbers) use `font-mono`.
- **Scale**:
  - Page / dashboard title: `text-2xl font-bold tracking-tight`.
  - Drawer / settings header title: `text-lg font-semibold sm:text-xl`.
  - Section title: `text-sm font-semibold uppercase tracking-wide text-muted-foreground`.
  - Form label: `text-sm font-medium text-muted-foreground`.
  - Helper text: `text-xs text-muted-foreground`; errors `text-xs text-destructive`.
  - Base component text: `text-sm font-normal`.

### 7.2 Design Tokens
Semantic HSL CSS variables in `globals.css` (`--background`, `--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius: 0.75rem`, glow tokens `--glow-cyan`, `--glow-violet`) are mapped to Tailwind color keys in `tailwind.config.ts`. **Use semantic token classes (`bg-card`, `text-muted-foreground`, `border-border`) — never hardcode hex colors.**

**Themes** (class on `<html>`, persisted in `localStorage` / `aib-theme` cookie via `lib/theme/themes.ts`):

| Theme id | HTML class | Character |
|----------|------------|-----------|
| `dark` (default) | `dark` | Navy canvas, cyan primary, violet accent — **do not modify** |
| `light` | `theme-light-warm` | Warm off-white canvas; blue primary, warm gray accent |

Users toggle via the Sun/Moon control in the top bar or the profile switch. Light uses **≥3 distinct surface steps** (background → muted → card) so layered UI does not collapse to flat white. Legacy stored values (`light-cyan`, `light-blue`, `light-warm`) map to `light`.

**Light-depth conventions** (pair with existing `dark:` polish, do not replace it):

- Borders: add `border-black/[0.06]` on light where dark uses `dark:border-white/10`.
- Elevation: `shadow-md shadow-black/[0.04–0.05]` on cards/panels in light mode.
- Glow: `shadow-glow-sm` on omnibar and primary chrome (not only `dark:shadow-glow-sm`).

### 7.3 Surface & Layout Utilities

| Utility | Definition | Use |
|---------|------------|-----|
| `surface-panel` | `rounded-xl border border-border bg-card p-4 shadow-md shadow-black/[0.04] dark:bg-card/50 dark:shadow-sm` | Standalone cards / panels |
| `surface-inset` | `rounded-lg border border-border bg-muted/35 shadow-sm dark:bg-muted/20` | Table/scroll containers |
| `hub-canvas` / `hub-grid` | gradient + grid background | Main scroll canvas |
| `canvas-workspace-pad` | `px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8` | Canvas content padding |
| `canvas-scroll-endpad` | `pb-16 md:pb-6 lg:pb-8` | Bottom clearance for mobile nav |
| `shimmer` | animated gradient | Skeleton placeholders |

### 7.4 Status Badges
Use the `badge.tsx` variants (`completed`, `active`, `action_required`, `locked`, `administrative`, `default`) for lifecycle/status display. Keep tones low-saturation: settled/success → emerald, informational/active → indigo/sky, critical/hold → amber/crimson.

---

## 8. Interaction States, Empty Views & Iconography

- **Action elements** must include explicit transitions (`transition-colors`) and visible states (`hover:bg-accent`/tint, `focus-visible:ring-2`, `disabled:opacity-50`).
- **Empty states**: list modules never show a blank box. The catalog uses a dashed inline prompt (`rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground`) with create-oriented copy; the richer `ProductEmptyState` provides an icon well (`bg-primary/10 ring-1 ring-primary/20`, `Package h-8 w-8 text-primary`) plus a single primary CTA. Every empty list must surface **one** primary "create" CTA.
- **Loading**: use **localized skeletons** with the `shimmer` utility (`ProductListSkeleton`, `ProductFormSkeleton`) — **never** a full-screen spinner — to prevent layout shift during queries.
- **Iconography**: **Lucide React only**. Keep stroke weight and sizing consistent (`h-4 w-4` for controls/nav, `h-3.5 w-3.5` for chips, `h-2 w-2` for status dots). Do not mix in other icon sets.

---

## 9. List Module Replication Checklist

Pick the tier that matches the module. When in doubt: **master/catalog data → Tier A**; **posted documents / ledger events → Tier B**.

### Tier A — Full catalog (Items Master)

Customers, Suppliers (rich profiles), Items, Categories, etc. **must** mirror the Items Master. Copy from the canonical files and satisfy every item below.

**Layout & list**
- [ ] Full-width canvas list (no split pane); page header with `text-2xl font-bold tracking-tight` title.
- [ ] Primary creation CTA aligned right in header, using router parameter mutations (`?action=new`) to trigger workflows in-canvas.
- [ ] Dual view modes (Table + Compact card) with a `bg-muted` segmented view toggle.
- [ ] Table: `surface-inset` scroll container, `bg-muted/40` header, `p-2.5` cell density, `border-b border-border` rows.
- [ ] Row typography: line-1 `font-medium` identifier, line-2 `text-xs text-muted-foreground` subtext; numerics `text-right tabular-nums`; identifiers `font-mono`.
- [ ] Hover tint + persistent selected `ring-1 ring-inset ring-primary/20`.
- [ ] Sticky `w-10` bulk checkbox column that stops propagation.

**Toolbar & data controls**
- [ ] Control shell with saved views, primary filter select, sort, view toggle, column settings.
- [ ] Global search via the top-strip omnibar; applied filters as an inline chip bar; result count `text-xs text-muted-foreground`.
- [ ] Bulk action toolbar (sticky, `z-30`) shown when selection > 0.
- [ ] Pagination via server page size + "Load more".

**Detail & editing**
- [ ] Row click triggers shallow routing string mutations (`?id=[uuid]`) to open the right-side drawer panel context natively.
- [ ] Creation and modification forms render inside the contextual `RightDrawer` panel view rather than mapping standalone child files or page redirects.
- [ ] Right Drawer features width progression cycles (40vw -> 60vw -> 80vw) and triggers 100vw takeover styles across mobile viewports.
- [ ] Form sections utilize structural grid grids (`grid-cols-1 sm:grid-cols-2`) and map to sticky horizontal chip bars or inline side navigation tabs depending on active panel boundaries.
- [ ] Form input configurations default to styled read-only matrices unless targeted explicitly by mutation path query signatures (`action=edit` or `action=new`).
- [ ] Enforce global shortcut mapping logic (`Cmd+Enter` or `Ctrl+Enter`) to programmatically pass forms to mutations and close panels.
- [ ] Keep a structural footer anchored securely to the base workspace sheet (`sticky bottom-0`) to manage submit and cancellation updates.

**States & polish**
- [ ] Empty state with a single primary create CTA (dashed inline prompt or structured placeholder).
- [ ] Localized `shimmer` skeletons for list, detail, and editor loading.
- [ ] Lucide React icons only, consistent sizing.
- [ ] All data scrolls inside `<main data-dashboard-scroll-root>` — no nested scroll roots.

### Tier B — Operational documents (Stock pattern)

Purchase GRNs, stock transfers, stock adjustments, shipment postings, etc. Satisfy §3.7 and:

- [ ] `ListModuleShell` + `Suspense` loader page; drawer `id` omitted from RSC `searchParams` (client-only `history.pushState`).
- [ ] `useModuleDrawerUrl(baseHref)` for peek / edit / create; `UserFacingErrorMessage` for RPC failures.
- [ ] Server actions call SECURITY DEFINER RPCs; `revalidatePath` on affected module routes.
- [ ] Zod schemas in `lib/<module>/schemas.ts`; friendly RPC error formatters where operators need settings links.
- [ ] Table in `surface-inset`; row selected state `ring-1 ring-inset ring-primary/20`.
- [ ] No bulk checkbox column unless the product owner explicitly requires batch posting.

**Inventory-specific Tier B rules:** [`INVENTORY_OPERATIONS.md`](./INVENTORY_OPERATIONS.md) §2.

**Related IA:** [`NAVIGATION.md`](./NAVIGATION.md) · **Agent handover:** [`AGENT_HANDOVER.md`](./AGENT_HANDOVER.md) · **Next build:** Procurement GRN (Sequence 21).