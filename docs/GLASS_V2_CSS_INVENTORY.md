# Glass V2 CSS duplicate inventory (Phase 0 → Phase 6)

Tracks overlap between the **live list workspace** stack and the **appearance preview** stack for Phase 6 deduplication.

## Live stack (production Items/Categories + future `surface="glass-v2"`)

| Scope | Location | Notes |
|-------|----------|--------|
| Root + `--lw-*` tokens | `globals.css` — `:is(.list-workspace-root, .glass-v2-root)` | Canonical Glass V2 list workspace |
| Matrix table | `.matrix-glass-card`, `.matrix-table__*` under list workspace | Glass table chrome |
| Split feed | `.spatial-master-*`, `.spatial-feed-*` | Master feed cards |
| Tree rows | `.glass-v2-tree-row` | Category tree (reference) |
| List images | `.glass-v2-list-image` | Thumbnails |

## Live overview stack (Phase 4+)

| Scope | Location | Notes |
|-------|----------|--------|
| Overview root | `.overview-glass-root` + `OverviewGlassShell` | Production module overviews + dashboard |
| Revamp command center | `:is([data-appearance-root], .overview-glass-root) .revamp-*` | Procurement command center, shared with preview |
| Hub panels | `.hub-panel` + `.surface-panel` | Dashboard KPI tiles and sections |
| Settings | `.settings-glass-shell` | Configuration pages |

## Preview stack (`data-appearance-root`)

| Scope | Location | Notes |
|-------|----------|--------|
| Revamp catalog chrome | `[data-appearance-root] .list-module-revamp` | Preview-only generation toggle |
| Matrix workspace | `[data-appearance-root] .matrix-glass-card`, `.matrix-table__*` | Overlaps live matrix rules |
| Spatial cards | `[data-appearance-root] .spatial-master-*` | Overlaps split feed |
| Density / visual variants | `[data-appearance-root][data-visual="glass"]`, `[data-density="compact"]` | Not on live path |

## Phase 6 merge candidates

1. **Revamp command center** — `:is([data-appearance-root], .overview-glass-root)` → single root class after preview audit
2. **Matrix table** — `[data-appearance-root] .matrix-table__header` vs `.list-workspace-root .matrix-table__header`
2. **Glass card panel** — preview `.matrix-glass-card` vs live `.list-workspace-root .matrix-glass-card`
3. **Revamp toolbar** — `.list-module-revamp .revamp-catalog-toolbar` vs unified catalog header strip
4. **Hard-coded hex** — `--lw-bg-canvas: #06080a` etc. → theme variables

## Safe to keep separate

- `ModulePreviewShell` / `AppearancePreviewBar` — document designer until audit complete
- `list-workspace-column-settings-panel` — portaled dropdown (not under root scope)

## Alias note (Phase 0)

`.glass-v2-root` is grouped with `.list-workspace-root` via `:is()` in all list-workspace rules. `LIST_WORKSPACE_GLASS_V2_ROOT` includes both class names.
