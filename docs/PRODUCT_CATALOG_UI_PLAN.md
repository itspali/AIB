# Product Catalog UI — Deferred Implementation Plan

**Status:** Implemented (Option B — close drawer → detail canvas).  
**Last updated:** 2026-05-28  
**Related modules:** `/items`, `/items/categories`, `RightDrawer`, `FormSectionNav`, `useFormSectionSpy`

---

## 1. Goal

Align the Product Master Catalog terminal with the Category Directory pattern while improving long-form orientation inside create/edit flows.

---

## 2. Target architecture (hybrid)

| Surface | Role |
|--------|------|
| **Left stream (4 cols)** | Product search, filters, summary cards (unchanged) |
| **Right canvas (8 cols)** | **Detail or empty only** — mirror `CategoryManagementTerminal` |
| **RightDrawer** | Create + edit product master profile |
| **FormSectionNav + scroll spy** | Sticky section chips inside drawer header (Essentials → Commerce → Advanced → Variants → Images) |
| **Detail viewport** | Read-only browse; variant/media management can remain here post-save or move fully into drawer at 80% |

### Section chip map (create/edit drawer)

| Chip | Visible when |
|------|----------------|
| Essentials | Always |
| Commerce | Always |
| Advanced | `show_advanced === true` |
| Variants | `item_id` present (after first save) |
| Images | `item_id` present |

Clicking an Advanced chip while toggle is off should auto-enable advanced (same behavior as Organization Settings).

### Post-save flow (decide before build)

- **Option A:** Stay in drawer after save; reveal Variants/Images sections in place.
- **Option B:** Close drawer → land on detail viewport; extensions managed on canvas (current behavior).

---

## 3. Known blocker: mobile `RightDrawer` width

### Problem

`RightDrawer` applies width as **`vw` at all breakpoints**:

```tsx
style={{ width: `${widthPct}vw`, maxWidth: `${widthPct}vw` }}
```

On mobile, 40% / 60% / 80% of viewport width is **too narrow** for product forms (grids, image galleries, variant tables, tag chips). Even 80% on a 390px phone leaves ~312px content minus padding — cramped and not aligned with Design System §2 (mobile = full-width stack).

This affects **Categories**, **Locations**, **Product variant drawer**, and any future **Product create/edit drawer**.

### Required fix (implement with or before product drawer migration)

**Status:** Implemented in `apps/web/components/ui/right-drawer.tsx` (2026-05-26).

Apply **responsive drawer width rules**:

| Breakpoint | Drawer width | Width cycle (40/60/80) |
|------------|--------------|-------------------------|
| `< md` (mobile) | **100vw** (full-screen sheet) | **Hidden** — no 40/60/80 toggle |
| `md` – `lg` | Default **90vw** or **100vw** | Optional: 60% / 80% only |
| `lg+` (desktop) | User preference **40 / 60 / 80 vw** | Show toggle (current behavior) |

Implementation notes:

1. Update `apps/web/components/ui/right-drawer.tsx` to use Tailwind breakpoints or `matchMedia`, not raw `vw` alone on small screens.
2. Persist width preference in `sessionStorage` only for `lg+` (or store separately for mobile vs desktop).
3. Section `FormSectionNav` chips: ensure horizontal scroll + `shortLabel` on mobile (already supported in `FormSectionNav`).
4. Nested drawers (e.g. variant drawer inside product drawer): on mobile, **avoid double sheets** — use inline expansion, full-screen replace, or single drawer with inner sections only.

### Design System alignment

- §2 Mobile: single-column full-width stack — drawer body should be `w-full`, not fractional viewport.
- §4 Progressive disclosure — keep Essentials default; Advanced/Variants/Images behind toggle or section nav.

---

## 4. Scroll spy adaptation

Organization Settings uses `useFormSectionSpy` against `[data-dashboard-scroll-root]`.

Product drawer scrolls inside the drawer body (`overflow-y-auto` on `RightDrawer` content). Before reuse:

- Extend `useFormSectionSpy` / `scrollToFormSection` to accept a **scroll root ref** (drawer body), or
- Add `data-drawer-scroll-root` and detect nearest scroll container.

Sticky chip header should sit **outside** the drawer scroll region (already true for drawer `SheetHeader`).

---

## 5. Files likely touched (when implemented)

| Area | Files |
|------|--------|
| Plan | `docs/PRODUCT_CATALOG_UI_PLAN.md` (this file) |
| Drawer mobile fix | `apps/web/components/ui/right-drawer.tsx` |
| Section registry | `apps/web/lib/products/section-nav.ts` (new) |
| Scroll spy | `apps/web/lib/settings/form-section-spy.ts` |
| Terminal layout | `apps/web/components/products/product-catalog-terminal.tsx` |
| Form shell | `apps/web/components/products/product-master-form.tsx` → drawer wrapper or `product-drawer-form.tsx` |
| Reference | `apps/web/components/categories/category-management-terminal.tsx` |

---

## 6. Resolved decisions

1. **Post-save flow:** **Option B** — close drawer → detail canvas; variants/images on detail viewport.
2. **Variant editing:** Nested variant drawer on detail canvas (unchanged).
3. **Edit entry points:** Drawer only via detail Edit and create button.
4. **Mobile primary workflow:** Desktop-first create/edit; mobile uses full-width drawer sheet.

---

## 7. Out of scope for this plan

- Tags, custom fields, SKU mask, UOM repeater, storefront visibility (already implemented in advanced form).
- Database / RPC changes.
- Replacing detail viewport with drawer for read-only browse.

---

## 8. Suggested implementation order (when unblocked)

1. **Fix `RightDrawer` mobile width** (benefits categories, locations, variants immediately).
2. Add `lib/products/section-nav.ts` + section IDs on form blocks.
3. Adapt scroll spy for drawer scroll root.
4. Refactor `ProductCatalogTerminal` to category-style canvas + drawer.
5. Wire `FormSectionNav` into product drawer header.
6. QA: mobile full-screen drawer, nested variant flow, image upload grid, keyboard Cmd/Ctrl+Enter save.
