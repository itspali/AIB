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
| Essentials | `ItemEssentialsStage` | overview, salable, purchasable, inventory |
| Variants | `ItemVariantsStage` | variants |
| Composition | `ItemCompositionStage` | composition |
| Catalog & reach | `ItemReachStage` | media, product_attributes, custom_fields, tags, visibility |

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

## 6. Legacy removal

`ProductCatalogTerminal` and `ProductCatalogLoader` were retired in favor of `ItemsListWorkspaceTerminal`. All new work targets the items list workspace and shared drawer stack above.
