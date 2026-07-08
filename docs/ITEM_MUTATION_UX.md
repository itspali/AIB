# Item mutation UX — drawers, forms, and editor stages

**Status:** Active (Glass V2 rollout)  
**Related:** [ITEM_CREATION_V2.md](./ITEM_CREATION_V2.md), [GLASS_V2_PLAN.md](./GLASS_V2_PLAN.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

This document describes how item peek, create, and edit surfaces are composed in `apps/web`. Use it when adding fields, new drawer flows, or wizard stages.

---

## 1. Two form archetypes

| Archetype | Where | Chrome | Primary actions |
|-----------|-------|--------|-----------------|
| **Catalog wizard** | Item create / full edit | `ItemEditorShell` + `MutationGlassRoot` | Footer: `CatalogWizardActionBar` (Back / Skip / Save & continue) |
| **Document POS** | Sales, procurement, payments | `DocumentPosActionBar` in drawer **header** | Header: save / post actions |

Items use the catalog wizard. Do not put wizard primary actions in the drawer header for items.

---

## 2. Drawer surfaces and widths

URL-driven via `useModuleDrawerUrl` (`lib/layout/module-drawer-url.ts`).

| Surface | Width policy | Interaction | Component |
|---------|--------------|-------------|-----------|
| `peek` | 42vw (`drawer-width-policy.ts`) | Background list stays interactive | `ProductItemDrawer` → view mode → `ItemDetailView` |
| `create` / `edit` | 60vw | Modal overlay | `ProductItemDrawer` → wizard or flat edit |
| `closed` | — | — | No drawer |

Pop-out opens the full-page route (`product-form-route.tsx`) without cycling drawer width.

Key files:

- `components/ui/right-drawer.tsx` — shell, `widthPolicy`, `popOutHref`
- `components/layout/drawer-pop-out-button.tsx`
- `components/products/product-item-drawer.tsx` — item drawer entry
- `components/products/product-panel-form.tsx` — mode routing (view / wizard / flat edit)

---

## 3. List workspace layouts

Canonical route: `app/(workspace)/items/page.tsx` → `ItemsListWorkspaceLoader` → `ItemsListWorkspaceTerminal`.

| Layout | Peek detail | Create / edit |
|--------|-------------|---------------|
| **Split** | `ItemsDetailCanvas` + `ItemDetailView` (inline pane) | `ProductItemDrawer` |
| **Matrix** | `ProductItemDrawer` `surface="peek"` | `ProductItemDrawer` |
| **Feed** | Same as matrix | Same as matrix |

Peek lazy sections: `useProductPeekPanel` (`lib/products/use-product-peek-panel.ts`) — URL sync, cache merge, section fetches.

---

## 4. Wizard stages

Defined in `lib/products/editor-stages.ts`:

```
Essentials → Variants? → Composition? → Catalog & reach
```

| Stage | Component | Sections |
|-------|-----------|----------|
| Essentials | `ItemEssentialsStage` | overview (Basics grid + expandable cards: tax, units, physical, composition, pricing, inventory) |
| Variants | `ItemVariantsStage` | variants |
| Composition | `ItemCompositionStage` | composition |
| Catalog & reach | `ItemReachStage` | purchasable (vendors), media, product_attributes, custom_fields, tags, visibility |

Orchestration:

- `ProductEditorShell` — form state, save, wizard chrome, section nav
- `useItemEditorStageModels` — builds stage model props from shell state
- `ItemEditorStageBody` — renders the four stages
- `ItemCatalogWizardEditor` — glass shell wrapper for wizard in drawer / pop-out

Stage metadata: `components/items/item-editor/*-stage.ts`.

---

## 5. What to touch for common tasks

| Task | Files |
|------|-------|
| New essentials field | `item-essentials-stage.tsx`, `use-product-form.ts`, actions |
| New peek tab / section | `peek-panels.ts`, `item-detail-view.tsx`, `use-product-peek-panel.ts` |
| Drawer width / pop-out | `drawer-width-policy.ts`, `right-drawer.tsx` |
| Wizard navigation | `use-product-create-wizard.ts`, `product-editor-shell.tsx` |
| Matrix / split list only | `items-list-workspace-terminal.tsx` (frozen — minimal edits) |

Do not bypass `tenant_id` RLS in server actions. Do not use raw button/table markup — use the shared UI kit.

---

## 7. Visual migration (Glass V2 wizard sections)

Wizard create/edit in the drawer uses frosted **outer section cards** while nested matrices, tables, and inset widgets stay flattened/readable.

### Scope

| Flow | Wrapper | Glass outer sections? |
|------|---------|------------------------|
| Wizard create/edit (drawer or pop-out) | `ItemCatalogWizardEditor` → `ItemEditorShell` → `MutationGlassRoot` | **Yes** — `EditorGlassSectionsProvider` |
| Flat drawer edit (no wizard) | `MutationGlassRoot` + `ProductEditorShell` only | **No** — legacy panel sections |
| Full-page wizard | Same provider via `ItemEditorShell` | **Yes** — page layout already uses `editorPageSectionClass` |

### Implementation

- **Context:** `EditorGlassSectionsProvider` wraps wizard body in `item-editor-shell.tsx` only.
- **Drawer wizard navigation:** stepper and stage header are hidden in the drawer (`layout="panel"`); use footer Back / Skip / Next (create) or Continue (edit). Full-page pop-out still shows the left stepper rail.
- **Wizard chrome:** `editorWizardTopBarGlassClass` / `editorWizardLeftRailGlassAsideClass` on full-page wizard only.
- **Drawer shell (Phase 4):** `ProductItemDrawer` passes `surfaceVariant="glass"` on create/edit (`mutate` width). `RightDrawer` applies `right-drawer-glass-surface` + transparent body; peek and document POS drawers unchanged.
- **Dedicated outer class:** `EDITOR_GLASS_SECTION_CLASS` (`editor-glass-section`) on top-level `EditorSectionBlock` cards via `editorCardClassName(..., { glass: true })`.
- **CSS (`globals.css`):**
  - Flatten rule: `.product-editor-panel .surface-panel:not(.editor-glass-section)` — nested widgets lose double-glass.
  - Restore rule: `.mutation-glass-root.item-editor-shell .product-editor-panel .editor-glass-section` — mirrors mutation-form glass tokens.
  - Nested tuning: `.surface-inset`, nested `.surface-panel`, and table headers inside `.editor-glass-section`.

### QA checklist

- [ ] Drawer create: Essentials → Reach — glass section cards; no duplicate stepper/header chrome in drawer.
- [ ] Footer shows **Next** on create stages, **Finish** on last stage.
- [ ] Variant matrix / price tables render as inset panels, not stacked glass cards.
- [ ] Flat edit (non-wizard) drawer unchanged (muted panel sections).
- [ ] Light-warm and dark themes — section titles, amber alerts, and borders readable.
- [ ] Mutate drawer (create/edit) shows frosted shell; peek drawer unchanged.

### Roadmap

Glass V2 item wizard migration is complete through drawer shell polish. Further work is parity-only (e.g. category editor) or list workspace changes outside this scope.

---

## 8. Legacy removal

`ProductCatalogTerminal` and `ProductCatalogLoader` were retired in favor of `ItemsListWorkspaceTerminal`. All new work targets the items list workspace and shared drawer stack above.
