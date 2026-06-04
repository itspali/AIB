# Item / Product UX — Vocabulary & Simplification Plan

**Status:** Superseded by implementation (see decisions below)  
**Last updated:** 2026-06-03  
**Canonical rollout:** Variant management consolidated plan (Cursor plan *Variant Management Improvements*)  
**Related modules:** `/inventory/items`, item drawer, `ProductEditorShell`, `ProductVariantPanel`, list toolbar, `variant-strategy.ts`  
**Related docs:** [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md), [DATA_STANDARDS.md](./DATA_STANDARDS.md), [PRODUCT_CATALOG_UI_PLAN.md](./PRODUCT_CATALOG_UI_PLAN.md)

---

## 1. Problem

The data model is standard for ERP/catalog apps (**item** + **variants**), but user-facing copy mixes several concepts:

- **Item** / product master / parent (list grouping)
- **Master variant** (`item_variants.is_master`)
- **Style anchor** (master variant with `is_sellable = false` on multi-SKU items)
- **Parent row** (synthetic list row when “show variants” is on)

Operators should not need to learn all of these. Single-SKU businesses especially should see “one product, one code.”

### Internal vs user mental model

| Internal | User-facing term (target) | Notes |
|----------|---------------------------|--------|
| `items` row | **Product** | Bulk, drawer, search scope “Items” |
| `items.code` | **Product code** | Multi-SKU; style-level identity |
| Master variant SKU (single-SKU) | **SKU** | Do not say “master” |
| Sellable `item_variants` row | **SKU** (column) | Section/nav title **Variants** |
| `is_master` + not sellable | **Style definition** / chip **Not sold** | Hide jargon where possible |
| Synthetic parent list row | **Group header** (no badge) | Future: not a duplicate selectable row |
| `variant_strategy` | **How many SKUs?** → One / More than one | Create/edit only |

**Retire in user copy:** Master, Style anchor, Parent, Variant (as row badge), Has variants, Item master profile.

---

## 2. One-sentence mental models

Use in section descriptions or field info — not long docs.

**Single-SKU product**

> One product, one SKU. Everything you edit here is what you sell and stock.

**Multi-SKU — main form**

> Define the product once (name, category, tax). Sellable SKUs are added under **SKUs**.

**Multi-SKU — SKUs section**

> Each row is a sellable SKU (e.g. Red / Large). The product definition at the top is not sold separately when marked not sold.

**List — collapsed (default)**

> One row per product.

**List — expanded**

> Show each sellable SKU on its own row. (Toolbar: **Show SKUs**, not “Variants”.)

---

## 3. Copy replacement map

| Location | Current (approx.) | Suggested |
|----------|-------------------|-----------|
| Toolbar toggle | Variants | **Show SKUs** |
| List badge | Style | **Product** or hide |
| List badge | Has variants | **Multiple SKUs** or icon only |
| List badge | Variant | **SKU** (indented; avoid badge) |
| Summary Identity | Item code (when = SKU) | Hide; keep **SKU** only |
| Editor field | Does this come in versions? | **How many SKUs does this product have?** |
| Strategy choices | Single / Multiple | **One SKU** / **More than one SKU (sizes, colors, …)** |
| Section nav | Versions | **Variants** |
| Variant panel title | Variant Management | **SKUs for this product** |
| Panel help (multi) | style anchor… profile form | **Add sellable SKUs here. Name, category, and tax are in the sections above.** |
| Table badge | Master | **Default SKU** (single) or hide |
| Table badge | Style anchor | **Not sold** (muted) |
| Drawer / save | Product master profile | **Product** / **Product saved** |
| Bulk dialogs | item master(s) | **product(s)** |

**Centralize** in `lib/products/variant-strategy.ts`, `lib/products/product-user-labels.ts` (new), and variant panel / list presentation helpers.

---

## 4. Behavior recommendations

### Defaults

- List: **Show SKUs** off — one row per product (`showVariants: false`).
- New products: default **One SKU** unless category strongly implies matrix (optional rule later).
- Drawer: peek = summary; edit = full form (unchanged).

### Progressive disclosure

- Hide **SKUs** section in editor nav until strategy is multi-SKU **or** extra sellable SKUs exist.
- Hide **SKU mask** until multi-SKU.
- Do not expose `is_master` as a user-editable flag.

### Single-SKU

- One **SKU** field on the main form (maps to master variant).
- No SKUs section in nav; “Show SKUs” irrelevant for that row shape.

### Multi-SKU

- Main form: **Product code** (`items.code`); sellable codes only under **SKUs**.
- Optional: remove sellable SKU from Overview to avoid split-brain editing.

### Expanded list (Phase B — UX)

Prefer **group header** over injectable parent row:

```
▸ Cotton T-Shirt · ITM001          [Multiple SKUs]
    ITM001-RED-L    Red · L    ₹…
    ITM001-BLUE-M   Blue · M   ₹…
```

- Header click → open product (peek).
- SKU row click → open product with `?variant=` (existing behavior).

### List + drawer

| Action | Behavior |
|--------|----------|
| Collapsed row click | Open product |
| Expanded group header click | Open product |
| Expanded SKU row click | Open product + variant context |
| Bulk on SKU rows | Product-level bulk (existing `resolveBulkSelectionItemIds`) — tooltip: applies to whole product |

---

## 5. Implementation phases

### Phase A — Copy only (≈1–2 days)

- Rename toolbar, badges, section titles, toasts, variant panel strings.
- Replace Master / Style anchor badges with **Not sold** or remove.
- No schema or API changes.

**Key files:** `variant-strategy.ts`, `product-variant-panel.tsx`, `product-list-toolbar.tsx`, `product-catalog-terminal.tsx`, `item-editor-field-help.tsx`, `product-item-summary-card.tsx`, bulk dialogs.

### Phase B — List clarity (≈2–3 days)

- Group header instead of `injectVariantParentRows` duplicate row (optional).
- Hide SKUs nav when single-SKU.
- Toggle label + one-line helper under **Show SKUs**.

**Key files:** `list-row-key.ts`, `product-stream-panel.tsx`, `product-list-table.tsx`, card components, `product-editor-shell.tsx` (section visibility).

### Phase C — Form alignment (≈3–5 days)

- Multi-SKU: SKU entry only under SKUs; Overview shows product code only.
- Single-SKU: single SKU field only.
- Align field help with vocabulary above.

**Key files:** `product-editor-shell.tsx`, `use-product-form.ts`, `save_product_master_profile` RPC expectations (verify).

### Phase D — Onboarding (optional)

- First multi-SKU save: one-time hint — “Add more SKUs under SKUs.”

---

## 6. Out of scope (keep internal)

- Merging `items` and `item_variants` tables.
- User-editable master flag.
- Using **Parent** in item UI (reserved for category tree).
- Removing variant model from DB.

---

## 7. Success criteria

Untrained users can answer:

1. **Where is price for Large / Red?** → SKUs section or expanded SKU row.
2. **Why two lines for one product?** → **Show SKUs** is on; turn off for one line per product.
3. **Product code vs SKU?** → Only for multi-SKU: code = product; SKUs = what you sell.

---

## 8. Technical reference (do not show users)

- `items` — product record; `items.code` — stable style code.
- `item_variants.is_master` — exactly one per item; required for stock/commerce defaults.
- Multi-SKU + `is_sellable = false` on master — style anchor; edited via product profile form.
- `injectVariantParentRows` — UI-only parent row before variant rows when `showVariants` is true.
- List “master mode” in tests = collapsed list (`showVariants: false`), not the `is_master` flag.

---

## 9. Refinement log

| Date | Author | Change |
|------|--------|--------|
| 2026-06-03 | — | Initial draft from UX review (item vs master vs parent) |

_Add refinements below as decisions are made._

### Open questions

- [ ] Default multi-SKU when category has variant axes templates?
- [ ] Hindi/regional labels for Indian GST operators?

### Decisions

| Date | Decision |
|------|----------|
| 2026-06-03 | User-facing section title: **Variants** (not Versions). SKU remains the column label for codes. |
| 2026-06-03 | Expanded list keeps **group header** rows via `injectVariantParentRows`; badge **Product** (was Style). |
| 2026-06-03 | **Suppliers** grid (`save_supplier_catalog_entries`) for per-variant multi-vendor buy prices; commerce form keeps item-level defaults. |

### Procurement integration (Phase 6)

When purchase orders ship: PO header `supplier_id` + line `variant_id` → default `unit_price` from `supplier_items` where `(item_id, variant_id, supplier_id)` matches, with the same variant-then-item fallback as list `purchase_price`.
