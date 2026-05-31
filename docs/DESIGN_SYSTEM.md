# AIB Smart ERP: Frontend Core Design System

This document is the **finalized, code-grounded** layout and component standard for the AIB
responsive web framework (Next.js App Router + Tailwind CSS + Shadcn/UI + Lucide React).

The standard is derived from two reference implementations that are considered **frozen**:

- **Items Master** (`/inventory/items`) — the canonical pattern for every module that lists records.
- **Organization Settings** (`/settings/organization`) — the canonical pattern for single-page
  configuration forms.

> Source-of-truth rule: where any older spec or sketch disagrees with the shipped Items Master or
> Organization Settings, **the shipped code wins**. Do not change the Items Master or Organization
> Settings layout to match a document — change the document. All Tailwind classes, widths, and file
> references below reflect the actual implementation.

---

## 1. Global Navigation Framework (Dashboard Shell)

> Information architecture (module → section map, Administration hub, responsive secondary
> navigation, module landings, breadcrumbs, and the global Create action) is specified in
> [NAVIGATION.md](NAVIGATION.md). This section covers the shell primitives those patterns build on.

The app chrome is the `DashboardShell`
([apps/web/components/layout/dashboard-shell.tsx](../apps/web/components/layout/dashboard-shell.tsx)).
It is a fixed-height flex column (`flex h-screen flex-col overflow-hidden bg-background`) containing
a top strip, a horizontal body (sidebar + scrolling main), and the mobile navigation.

### 1.1 Top Utility Strip (Zone A)

[apps/web/components/layout/top-utility-strip.tsx](../apps/web/components/layout/top-utility-strip.tsx)

- **Fixed height `h-16`**, pinned at the top: `relative z-20 w-full shrink-0 border-b border-border bg-background/80 backdrop-blur-xl`.
- Left: sidebar collapse toggle (`PanelLeftOpen` / `PanelLeftClose`, `h-4 w-4`) and, when the
  sidebar is expanded, the org branding block (logo mark `h-7 w-7` gradient tile + org name
  `truncate text-sm font-semibold`).
- Center/right row: `flex min-w-0 flex-1 items-center gap-2 pl-2 pr-4 md:gap-4 md:pl-3 md:pr-6`.
- **Omnibar search** (`OmnibarSearchTrigger`): `h-10 w-full ... rounded-xl border border-border bg-card/60 px-3 text-sm`, with a `⌘K` / `Ctrl+K` kbd hint at `lg:inline-flex`. Hidden below `md`,
  replaced by a ghost `Search` icon button.
- Approvals badge (`variant="action_required"` with `AlertTriangle h-3 w-3`) when pending > 0,
  otherwise an "All clear" `locked` badge (`hidden md:inline-flex`).
- `ThemeToggle`, then the user avatar (`UserProfileMenu` → `UserProfileTrigger`, avatar `h-8 w-8 rounded-full`).
- **Org / workspace switcher** lives inside the user profile dropdown ("Switch Workspace Instance",
  `Building2 h-4 w-4`), shown when the operator belongs to more than one tenant. It is **not** a
  separate top-strip control.

### 1.2 Collapsible Left Rail (Zone B)

[apps/web/components/layout/sidebar-nav.tsx](../apps/web/components/layout/sidebar-nav.tsx)

- **Expanded state: `w-64`** (labels + icons). **Slim state: `w-16`** (icons only). Transition:
  `transition-all duration-200`.
- `aside` classes: `hidden h-full shrink-0 flex-col border-r border-white/10 bg-card/40 backdrop-blur-xl ... md:flex`. The rail is **hidden below `md`** and only renders on `md+`.
- Nav link row: `group flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-normal ... hover:bg-white/5`. Active items use `nav-glow-active`.
- Collapsed groups render as icon-only buttons with a `DropdownMenu side="right"`.
- Collapse state is owned by `OnboardingContext` (`sidebarCollapsed`); on tablet
  (`min-width: 768px and max-width: 1023px`) the rail **auto-collapses** on mount.
- Module entries come from `module-nav.tsx` (Dashboard, Procurement, Inventory + children, Sales,
  Logistics, Financials), all icons Lucide.

### 1.3 Active Workspace Canvas (Zone C)

- The scroll container is the single `<main data-dashboard-scroll-root>` element:
  `relative min-h-0 min-w-0 flex-1 overflow-y-auto` + `hub-canvas` background.
- **`data-dashboard-scroll-root` is load-bearing**: it is the scroll root that section-nav scroll
  spies and `scrollElementInDashboardRoot()` target. Never add an inner `overflow-y-auto` wrapper
  that would shadow it.
- Inner content padding uses the `canvas-workspace-pad` utility:
  `px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8` ([globals.css](../apps/web/app/globals.css) L165).
- Pages that must clear the mobile bottom nav add `canvas-scroll-endpad`:
  `pb-16 md:pb-6 lg:pb-8` (L177).
- The canvas spans 100% of the remaining viewport width — **no fixed vertical split panes**.

---

## 2. Responsive Breakpoints & Mobile Adaptation

Tailwind breakpoints drive every shell transition. The functional cutover is **`md` (768px)**.

| Breakpoint | Width | Shell behavior |
|------------|-------|----------------|
| `< md` (<768px) | mobile | Sidebar hidden; **bottom tab bar** visible; module drawer available; list pages show the mobile section chip bar; drawers open full-screen (`100vw`). |
| `md` – `lg` (768–1023px) | tablet | Sidebar visible but **auto-collapsed** to `w-16`; bottom nav hidden; omnibar in header. |
| `lg+` (≥1024px) | desktop | Full `w-64` sidebar; desktop section rail; right drawer width cycle (40/60/80) enabled. |

### 2.1 Bottom Navigation Tab Bar

[apps/web/components/layout/mobile-bottom-nav.tsx](../apps/web/components/layout/mobile-bottom-nav.tsx)

- `fixed inset-x-0 bottom-0 z-50 ... md:hidden`, height `h-14`, plus `pb-[env(safe-area-inset-bottom)]`.
- Surface: `border-t border-white/10 bg-background/85 backdrop-blur-xl`.
- Lays out the module entries as `grid h-14 grid-cols-6` (one cell per top-level module).
- Tab label `text-[10px] font-medium leading-none`; active indicator
  `absolute inset-x-2 top-0 h-0.5 rounded-full bg-primary shadow-glow-sm`; icons Lucide `size-4`.

### 2.2 Module Navigation Drawer

[apps/web/components/layout/mobile-nav-drawer.tsx](../apps/web/components/layout/mobile-nav-drawer.tsx)

- Shadcn `Sheet side="left"`: `flex flex-col border-white/10 bg-card/95 p-0 backdrop-blur-xl`.
- Opened from the sidebar toggle in the top strip on mobile (`md:hidden`,
  `aria-label="Open module navigation"`).
- Renders the full module tree, including expandable groups via `MobileDrawerNavGroup`.

### 2.3 Responsive Form Columns

Form field grids collapse from multi-column to a single stack:

- Master form sections: `grid grid-cols-1 gap-4 sm:grid-cols-2`; full-width fields use `sm:col-span-2`.
- Organization Settings sections: `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3`; wide
  fields span `md:col-span-2 lg:col-span-2`.
- Mobile (`< sm`): always a 1-column full-width stack.

---

## 3. Master Data List Standard (The Items Master Pattern)

**Every module that lists records MUST replicate this pattern.** The canonical implementation is
the Items catalog at `/inventory/items`
([product-catalog-terminal.tsx](../apps/web/components/products/product-catalog-terminal.tsx) →
[product-stream-panel.tsx](../apps/web/components/products/product-stream-panel.tsx)).

### 3.1 Full-Width Layout

- The list claims **100% of the canvas width**. There is **no left-stream / right-canvas split** and
  no fixed split-pane restriction. `ProductStreamPanel` root is simply `space-y-3`.
- The page header (`product-catalog-terminal.tsx`) is `mb-4 sm:mb-5 md:mb-5`: title
  `min-w-0 truncate text-2xl font-bold tracking-tight`, with the primary create CTA aligned right
  (`Button asChild` → route `/inventory/items/new`, `shrink-0`).

### 3.2 Dual View Modes

A view toggle in the toolbar switches between two presentations of the same records:

1. **Table view** ([product-list-table.tsx](../apps/web/components/products/product-list-table.tsx)):
   scroll container `surface-inset overflow-x-auto [scrollbar-gutter:stable]`; table
   `w-full min-w-[720px] border-separate border-spacing-0 bg-background text-sm`; header row
   `bg-muted/40 text-left`.
2. **Compact card view** ([product-list-compact-card.tsx](../apps/web/components/products/product-list-compact-card.tsx)):
   `grid gap-3` with responsive columns (`grid-cols-1`, `md:grid-cols-2`, up to `lg:grid-cols-4`
   depending on the chosen density).

### 3.3 Row Packing Density & Typography Hierarchy

- **Density**: cell padding `p-2.5` (image cells `p-1`); rows divided by
  `border-b border-border`. No fixed viewport height — the first server page is **100 rows** and
  a "Load more" control appends additional pages. This packs well past 12 visible rows on a
  standard desktop viewport before scrolling.
- **Line 1** (primary identifier): `font-medium` (Name/Code/SKU). SKU/barcode use
  `font-mono text-muted-foreground`.
- **Line 2** (muted subtext / variant rows): `mt-0.5 block truncate text-xs font-normal text-muted-foreground`.
- **Right-aligned numerics**: monetary and quantity columns (`selling_price`, `purchase_price`,
  `stock_on_hand`) use `text-right tabular-nums`, values wrapped in `<span className="tabular-nums">`.
- Compact card: line-1 name `text-base font-semibold leading-tight`, line-2 subline
  `truncate text-xs text-muted-foreground`, thumbnail `h-14 w-14 rounded-lg ... sm:h-16 sm:w-16`.

### 3.4 Row Interaction & Selection

- Body row: `group cursor-pointer transition-colors duration-[25ms]`.
- **Hover**: subtle background tint on unfrozen cells
  (`group-hover:bg-[hsl(214_28%_96%)]` / dark `color-mix` accent).
- **Selected (drawer open)**: persistent `ring-1 ring-inset ring-primary/20` plus a tinted
  background; the compact card uses `border-primary/50 bg-primary/5 ring-1 ring-primary/20`.
- Clicking anywhere on a row calls `onSelect(id)` and opens the **right-side drawer instantly**
  without shifting table columns (frozen columns keep their inset shadow).
- The bulk-selection checkbox column is `sticky left-0`, `w-10`, and **stops click propagation** so
  ticking a row does not open the drawer.

### 3.5 Toolbar

[product-list-toolbar.tsx](../apps/web/components/products/product-list-toolbar.tsx) — control shell
`w-full min-w-0 rounded-lg border border-primary/25 bg-[color-mix(...)] px-3 py-2.5 shadow-sm sm:px-4 sm:py-3`:

- **Saved views** selector (`ModuleViewSelect`).
- **Category / primary filter** select (`h-8`).
- **Sort** control (compact view), **Show variants** switch (table view).
- **View toggle** (table vs compact): `inline-flex h-8 items-center rounded-md border border-border bg-muted p-0.5`, active button `bg-background text-primary shadow-sm`.
- **Column settings** dropdown (`ProductListColumnSettings` → shared `ListColumnSettings`).
- **Global search** is the top-strip omnibar; **applied filters** render as an inline chip bar
  (`OmnibarFilterChipBar variant="inline"`) below the control shell.
- **Result count**: `text-xs text-muted-foreground` ("Showing X of Y").

### 3.6 Bulk Action Toolbar

[product-bulk-action-toolbar.tsx](../apps/web/components/products/product-bulk-action-toolbar.tsx)
— appears when selection count > 0:
`sticky top-0 z-30 animate-in fade-in slide-in-from-top-2 duration-200 backdrop-blur-sm`. Desktop
shows primary outline actions + destructive Archive + a "More" dropdown; mobile collapses to a
single "Actions" dropdown. Selection label `truncate text-sm font-semibold tracking-tight`.

---

## 4. Right-Side Slide-Over Drawer (Read-Only Peek)

[apps/web/components/ui/right-drawer.tsx](../apps/web/components/ui/right-drawer.tsx)

Clicking a list row opens a contextual **read-only peek** drawer (the deep create/edit flow lives on
full-page routes — see §5).

- **Desktop width matrix**: default **40 vw**, with a header toggle that cycles **40 → 60 → 80 vw**
  (`Maximize2 h-4 w-4` + `text-xs tabular-nums` percent). The preference persists in `sessionStorage`
  (key `aib-right-drawer-width`).
- **Mobile (< lg)**: the drawer becomes a **full-screen takeover** — `width: 100vw`, classes
  `w-full max-w-full sm:max-w-full`; the width toggle is hidden.
- **Peek mode**: `allowBackgroundInteraction` defaults to true → `modal={false}`, no overlay, so the
  list behind stays interactive.
- **Header**: `flex flex-row items-center justify-between ... border-b ... px-4 py-4 sm:px-6`; title
  `truncate text-left text-lg font-semibold sm:text-xl`; close = ghost `X h-4 w-4` (the default
  Radix close is hidden via `[&>button:last-of-type]:hidden`).
- **Drawer body** ([product-drawer-form.tsx](../apps/web/components/products/product-drawer-form.tsx)):
  read-only summary with header actions **Open** (`ExternalLink` → `/inventory/items/{id}`) and
  **Edit** (→ `/inventory/items/{id}/edit`). While loading it shows `ProductFormSkeleton`.
- **`Esc`** dismisses the drawer via the Radix Dialog root (no custom handler needed).

---

## 5. Full-Page Create / Edit Editor

[product-form-route.tsx](../apps/web/components/products/product-form-route.tsx) →
[product-editor/product-editor-shell.tsx](../apps/web/components/products/product-editor/product-editor-shell.tsx)

Heavy create/edit/view uses dedicated routes, not the drawer:

- `/inventory/items/new` → `mode="create"`
- `/inventory/items/[id]` → `mode="view"` (read-only)
- `/inventory/items/[id]/edit` → `mode="edit"`

### 5.1 Section Navigation + Scroll Spy

- **Desktop**: `lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-6`. The left nav (`hidden lg:block`,
  sticky `top-4 space-y-1`) lists sections; active item `bg-secondary font-medium text-secondary-foreground`, inactive `text-muted-foreground hover:bg-muted/60`.
- **Mobile/tablet**: a sticky `SectionScrollChipBar`
  (`sticky top-0 z-20 ... rounded-lg border border-border bg-background/95 backdrop-blur lg:hidden`),
  active chip `border-primary text-foreground ring-1 ring-inset ring-primary`.
- **Scroll spy**: `IntersectionObserver` (`rootMargin: "-96px 0px -60% 0px"`, `threshold: 0`);
  each `SectionBlock` anchor carries `scroll-mt-20`.

### 5.2 Form Layout & Section Cards

- Section card (`SectionBlock`): `rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6`;
  section title `text-sm font-semibold uppercase tracking-wide text-muted-foreground`.
- Field grid: `grid grid-cols-1 gap-4 sm:grid-cols-2`; full-width fields `sm:col-span-2`; toggle rows
  `flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 sm:col-span-2`.

### 5.3 Read-Only Default, Save Shortcut & Sticky Footer

- The `view` route initializes **read-only** (`readOnly = mode === "view"`); the sticky save bar is
  hidden and an **Edit** button (in the page chrome) routes to `/edit`.
- **`Cmd/Ctrl + Enter`** saves the active form (a keydown listener, skipped while read-only). The
  save button advertises the shortcut in its `title`.
- Sticky footer save bar:
  `sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-background/95 py-3 backdrop-blur`.

> Note: the live editor uses a single inline `SECTIONS` constant (Overview, Pricing & Tax,
> Inventory & Costing, Variants, Media, Catalog & Tags). There is currently **no "Show Advanced"
> toggle** — all sections render continuously and are reached through the section nav.

---

## 6. Single-Page Configuration Form (Organization Settings Pattern)

[organization-settings-terminal.tsx](../apps/web/components/settings/organization-settings-terminal.tsx)
is the canonical pattern for tenant-level configuration screens. It reuses §5's section-nav, scroll
spy, and read-only/edit primitives but renders as one continuous scrollable form rather than routed
modes.

- **Form wrapper**: `canvas-scroll-endpad flex flex-col gap-4 lg:gap-5`, driven by `react-hook-form`
  + `zodResolver`.
- **Sticky org header**: `sticky top-0 z-30 -mx-4 border-b border-border bg-background/95 backdrop-blur ... md:-mx-6 md:px-6` (the negative margins bleed it to the canvas edges). It holds the org name
  (`text-lg font-semibold sm:text-xl`), status badges (`text-[10px] font-medium`), and the
  **Edit / Save / Cancel** actions.
- **Read-only by default**: `isEditing = false`; `fieldsDisabled = !isEditing || isPending` is passed
  to every section. Cancel resets the form and exits edit mode; Save calls the server action, toasts,
  exits edit mode, and `router.refresh()`. (No `Cmd/Ctrl+Enter` shortcut here — submit only.)
- **Section navigation**: 8 tabs from
  [apps/web/lib/organization/section-nav.ts](../apps/web/lib/organization/section-nav.ts) — Identity,
  Regional, Billing & Fiscal, Branding, Locations, Numbering, Accounting, Access (Lucide icons
  `Building2, Globe2, Wallet, Palette, Network, Hash, Calculator, ShieldCheck`). Desktop rail width
  `14rem`; mobile uses `SectionScrollChipBar`.
- **Scroll spy**: a custom `IntersectionObserver` whose root resolves to `<main data-dashboard-scroll-root>`; `rootMargin` accounts for the sticky org header + chip bar heights (measured via
  `ResizeObserver`). Programmatic jumps use `scrollElementInDashboardRoot()` from
  [apps/web/lib/settings/form-section-spy.ts](../apps/web/lib/settings/form-section-spy.ts).
- **Section card**: `OrgSettingsSection` — `rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6`.
- **Policy summary tiles** (`OrganizationPolicySummary`): inline hero card on `lg+`
  (`hidden ... lg:block`), standalone `surface-panel` on smaller viewports; grid
  `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`.

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

Semantic HSL CSS variables in [globals.css](../apps/web/app/globals.css) (`--background`,
`--foreground`, `--card`, `--primary`, `--secondary`, `--muted`, `--muted-foreground`, `--accent`,
`--destructive`, `--border`, `--input`, `--ring`, `--radius: 0.75rem`, glow tokens `--glow-cyan`,
`--glow-violet`) are mapped to Tailwind color keys in `tailwind.config.ts`. **Use semantic token
classes (`bg-card`, `text-muted-foreground`, `border-border`) — never hardcode hex colors.**

### 7.3 Surface & Layout Utilities

| Utility | Definition | Use |
|---------|------------|-----|
| `surface-panel` | `rounded-xl border border-border bg-card/60 p-4 shadow-sm dark:bg-card/50` | Standalone cards / panels |
| `surface-inset` | `rounded-lg border border-border bg-muted/20 shadow-sm` | Table/scroll containers |
| `hub-canvas` / `hub-grid` | gradient + grid background | Main scroll canvas |
| `canvas-workspace-pad` | `px-4 pt-4 md:px-6 md:pt-6 lg:px-8 lg:pt-8` | Canvas content padding |
| `canvas-scroll-endpad` | `pb-16 md:pb-6 lg:pb-8` | Bottom clearance for mobile nav |
| `shimmer` | animated gradient | Skeleton placeholders |

### 7.4 Status Badges

Use the `badge.tsx` variants (`completed`, `active`, `action_required`, `locked`, `administrative`,
`default`) for lifecycle/status display. Keep tones low-saturation: settled/success → emerald,
informational/active → indigo/sky, critical/hold → amber/crimson.

---

## 8. Interaction States, Empty Views & Iconography

- **Action elements** must include explicit transitions (`transition-colors`) and visible states
  (`hover:bg-accent`/tint, `focus-visible:ring-2`, `disabled:opacity-50`).
- **Empty states**: list modules never show a blank box. The catalog uses a dashed inline prompt
  (`rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground`)
  with create-oriented copy; the richer `ProductEmptyState`
  ([product-empty-state.tsx](../apps/web/components/products/product-empty-state.tsx)) provides an
  icon well (`bg-primary/10 ring-1 ring-primary/20`, `Package h-8 w-8 text-primary`) plus a single
  primary CTA. Every empty list must surface **one** primary "create" CTA.
- **Loading**: use **localized skeletons** with the `shimmer` utility (e.g. `ProductListSkeleton`,
  `ProductFormSkeleton`, `ProductEditorSkeleton`, `ProductCatalogPageSkeleton`) — **never** a
  full-screen spinner — to prevent layout shift during Supabase queries.
- **Iconography**: **Lucide React only**. Keep stroke weight and sizing consistent (`h-4 w-4` for
  controls/nav, `h-3.5 w-3.5` for chips, `h-2 w-2` for status dots). Do not mix in other icon sets.

---

## 9. List Module Replication Checklist

Any new module that lists records (Customers, Suppliers, Sales Orders, Invoices, Locations,
Categories, etc.) **must** mirror the Items Master. Copy from the canonical files and satisfy every
item below.

**Layout & list**
- [ ] Full-width canvas list (no split pane); page header with `text-2xl font-bold tracking-tight`
      title + right-aligned primary create CTA.
- [ ] Dual view modes (Table + Compact card) with a `bg-muted` segmented view toggle.
- [ ] Table: `surface-inset` scroll container, `bg-muted/40` header, `p-2.5` cell density,
      `border-b border-border` rows.
- [ ] Row typography: line-1 `font-medium` identifier, line-2 `text-xs text-muted-foreground`
      subtext; numerics `text-right tabular-nums`; identifiers `font-mono`.
- [ ] Hover tint + persistent selected `ring-1 ring-inset ring-primary/20`.
- [ ] Sticky `w-10` bulk checkbox column that stops propagation.

**Toolbar & data controls**
- [ ] Control shell with saved views, primary filter select, sort, view toggle, column settings.
- [ ] Global search via the top-strip omnibar; applied filters as an inline chip bar; result count
      `text-xs text-muted-foreground`.
- [ ] Bulk action toolbar (sticky, `z-30`) shown when selection > 0.
- [ ] Pagination via server page size + "Load more".

**Detail & editing**
- [ ] Row click opens the read-only `RightDrawer` peek (40/60/80 desktop, 100vw mobile,
      `Open` + `Edit` actions).
- [ ] Create/edit on full-page routes (`/new`, `/[id]`, `/[id]/edit`) using the
      `14rem` section-nav rail + mobile chip bar + IntersectionObserver scroll spy.
- [ ] Section cards `rounded-xl border bg-card p-4 sm:p-6`; field grid `grid-cols-1 sm:grid-cols-2`.
- [ ] Read-only default in view mode → Edit; `Cmd/Ctrl+Enter` save; sticky footer save bar; `Esc`
      closes the drawer.

**States & polish**
- [ ] Empty state with a single primary create CTA (dashed inline prompt or `ProductEmptyState`).
- [ ] Localized `shimmer` skeletons for list, detail, and editor loading.
- [ ] Lucide React icons only, consistent sizing.
- [ ] All data scrolls inside `<main data-dashboard-scroll-root>` — no nested scroll roots.

**Canonical files to copy from**

| Concern | Reference file |
|---------|----------------|
| Terminal / orchestration | `components/products/product-catalog-terminal.tsx` |
| Stream + list switching | `components/products/product-stream-panel.tsx` |
| Table view | `components/products/product-list-table.tsx`, `product-list-cells.tsx` |
| Compact view | `components/products/product-list-compact-card.tsx` |
| Toolbar | `components/products/product-list-toolbar.tsx` |
| Bulk actions | `components/products/product-bulk-action-toolbar.tsx` |
| Right drawer | `components/ui/right-drawer.tsx`, `components/products/product-drawer-form.tsx` |
| Full-page editor | `components/products/product-form-route.tsx`, `components/products/product-editor/product-editor-shell.tsx` |
| Single-page config form | `components/settings/organization-settings-terminal.tsx` |
| Section nav + spy | `components/layout/section-scroll-chip-bar.tsx`, `lib/settings/form-section-spy.ts` |
