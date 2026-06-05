# Item creation V2 — composition, supply chain, and wizard

**Status:** Foundation in progress (Essentials + Composition stage shell)  
**Related:** [DATA_STANDARDS.md](./DATA_STANDARDS.md), [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)

This document separates concepts that were previously mixed in one “supply-chain role” picker and defines how item creation should evolve without blocking sales/tax work in V2.

---

## 1. Three independent axes

| Axis | Field(s) | Question it answers | Examples |
|------|----------|---------------------|----------|
| **Item type** | `item_type` | What kind of product is this? | Goods, Service, Digital |
| **Supply-chain role** | `classification` | Where does it sit in reporting / manufacturing? | Raw, WIP, Finished, Consumable, Service |
| **Composition** | `is_bundle` (UI: “Sold as a set”) | Is it sold or built from other items? | TV package, factory sub-assembly |

**Do not** put Kit/Bundle in the supply-chain role dropdown.  
**Do not** sync composition with classification.

Legacy `KIT_BUNDLE` classification is migrated to **Finished good + composition on** when loading/saving.

---

## 2. Wizard stages (guided create)

Order is computed from the saved item:

```
Essentials → Variants? → Composition? → Catalog & reach
```

| Stage | When shown | Saves item? |
|-------|------------|-------------|
| **Essentials** | Always | Yes — first save creates the item |
| **Variants** | `variant_strategy = MULTI_SKU` | Optional save |
| **Composition** | `is_bundle = true` and item persisted | Lines edited here (V2 table) |
| **Catalog & reach** | Always (after create) | Optional save |

Sections hidden until first save: **Variants**, **Media**, **Composition**.

---

## 3. Essentials — what belongs here

- Identity: name, SKU/product code, category, description  
- Item type + supply-chain role (no Kit/Bundle role)  
- Tax category, tax rule, HSN/SAC (on the **parent**; components keep their own tax in Composition)  
- Variant strategy (goods only today)  
- Salable / purchasable / returnable  
- **Sold as a set** toggle (composition) — simple on/off  
- Track inventory (goods only; **off by default when composition is on**)

Physical-only fields (weight, dimensions, GTIN) stay on goods items.

---

## 4. Composition rules (by supply-chain role)

Validated in app (`composition.ts`) and enforced in Composition stage UI.

| Parent role | Allowed component item types (V1) | V2 |
|-------------|-----------------------------------|-----|
| **WIP** | Goods only | Same (manufacturing BOM) |
| **Finished good** | Goods only | + Service, Digital (mixed packages) |
| **Raw / consumable** | Composition discouraged | Internal BOM only (future) |
| **Service / Digital parent** | — | Service/digital packages (V2) |

**V1 implementation:** composition toggle on **goods** items only; component picker ships in a follow-up migration (`item_composition_lines`).

---

## 5. Composition line model (V2 — not all built in V1)

Each line on the parent (optionally scoped to a sellable variant):

| Field | Purpose |
|-------|---------|
| `component_item_id`, `variant_id` | What is included |
| `qty`, `uom` | How much per parent |
| `is_mandatory` | Always on quote/order (e.g. TV) |
| `is_optional_addon` | Customer can add/drop (e.g. warranty) |
| `default_unit_price`, `price_mode` | List / fixed / discount / complimentary (₹0) |
| `default_selected` | Optional add-on pre-checked on quote |
| `sort_order` | Display order |

**Sales behaviour (V2 — quotes/orders):**

- Mandatory lines → always explode to separate transaction lines  
- Optional lines → explode only when selected  
- Tax: `resolve_line_tax` **per exploded line** (never one blended rate on parent)  
- Parent bundle line: commercial UX only; invoice uses child lines with correct HSN/SAC  

---

## 6. Variants + composition

- Multi-SKU parents may define **variant-scoped** composition lines.  
- Single-SKU: one composition set on the sellable SKU.  
- Variant strategy is independent of composition (bundles may have sizes/colors).

---

## 7. Stock and costing

| Parent | `track_inventory` | Stock movement |
|--------|-------------------|----------------|
| Composed sales package (FG) | **Off** (default) | On **components** when shipped |
| WIP assembly | May be **on** | Consumes components via production (future) |

Parent tax code on a composed FG package is for reference only; taxable amounts live on components after explosion.

---

## 8. Pricing

| Layer | Where |
|-------|--------|
| Component default prices | Composition lines |
| Parent list price | Optional; may equal sum of mandatory + selected optional lines |
| Channel overrides | Price books / storefront (Reach stage) |

Complimentary mandatory add-ons: line price **₹0**, still exploded for SAC/HSN.

---

## 9. Validation summary

| Rule | When |
|------|------|
| Composition on + goods | Allowed |
| Composition on + track inventory on parent | Auto-clear track inventory (warn in UI) |
| WIP + non-goods component | Block (V2 picker) |
| `has_composition` + zero lines | `needs_review` / stay draft until lines added (V2) |
| Circular/nested composition | Block in RPC (V2) |

---

## 10. Phased delivery

| Phase | Scope |
|-------|--------|
| **Now (foundation)** | Doc, decouple classification/composition, toggle + Composition stage shell, wizard order, DB validation relax, legacy `KIT_BUNDLE` migration |
| **V2.1** | `item_composition_lines` table + editor grid + save RPC |
| **V2.2** | Quote/order explosion, optional add-ons, per-line tax |
| **V2.3** | Service/digital parents, mixed FG packages |
| **V2.4** | WIP consumption, composition versioning on orders |

---

## 11. UI copy (keep simple)

| Old | New |
|-----|-----|
| Kit / Bundle (supply-chain role) | *(removed from picker)* |
| Bundle toggle | **Sold as a set** |
| BOM | **Composition** (stage name) |
| Supply-chain role | Unchanged label; FG / WIP / Raw / Consumable only |

---

*Last updated: 2026-06-05*
