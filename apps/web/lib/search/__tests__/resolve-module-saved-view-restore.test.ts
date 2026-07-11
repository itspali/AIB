import { describe, expect, it } from "vitest";
import { resolveModuleSavedViewRestoreTarget } from "@/lib/search/views/resolve-module-saved-view-restore";
import type { CustomModuleView } from "@/lib/search/types";
import type { SavedViewSnapshot } from "@/lib/search/views/saved-view-utils";

function view(id: string, overrides: Partial<CustomModuleView> = {}): CustomModuleView {
  return {
    id,
    tenant_id: "tenant-1",
    user_id: "user-1",
    module_name: "items",
    view_name: `View ${id}`,
    raw_search_text: "active true",
    compiled_ast: [],
    is_system_default: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function snapshot(id: string, overrides: Partial<SavedViewSnapshot> = {}): SavedViewSnapshot {
  return {
    id,
    module_name: "items",
    view_name: `View ${id}`,
    raw_search_text: "active true",
    compiled_ast: [],
    ...overrides,
  };
}

describe("resolveModuleSavedViewRestoreTarget", () => {
  const views = [view("default", { is_system_default: true }), view("saved")];

  it("hydrates SSR snapshot when stored id matches SSR active view", () => {
    const initialSavedView = snapshot("saved");
    const result = resolveModuleSavedViewRestoreTarget({
      storedViewId: "saved",
      initialSavedViews: views,
      initialSavedView,
      initialFilteredItemIds: ["item-1"],
    });

    expect(result).toEqual({
      kind: "hydrate",
      snapshot: initialSavedView,
      filteredItemIds: ["item-1"],
    });
  });

  it("loads stored view client-side when SSR missed the cookie", () => {
    const result = resolveModuleSavedViewRestoreTarget({
      storedViewId: "saved",
      initialSavedViews: views,
      initialSavedView: null,
      initialFilteredItemIds: null,
    });

    expect(result).toEqual({ kind: "load", view: views[1] });
  });

  it("loads stored view when SSR resolved a different active view", () => {
    const result = resolveModuleSavedViewRestoreTarget({
      storedViewId: "saved",
      initialSavedViews: views,
      initialSavedView: snapshot("default"),
      initialFilteredItemIds: null,
    });

    expect(result).toEqual({ kind: "load", view: views[1] });
  });

  it("hydrates SSR snapshot when no stored id is present", () => {
    const initialSavedView = snapshot("default");
    const result = resolveModuleSavedViewRestoreTarget({
      storedViewId: null,
      initialSavedViews: views,
      initialSavedView,
      initialFilteredItemIds: null,
    });

    expect(result).toEqual({
      kind: "hydrate",
      snapshot: initialSavedView,
      filteredItemIds: null,
    });
  });

  it("returns none when there is nothing to restore", () => {
    const result = resolveModuleSavedViewRestoreTarget({
      storedViewId: null,
      initialSavedViews: views,
      initialSavedView: null,
      initialFilteredItemIds: null,
    });

    expect(result).toEqual({ kind: "none" });
  });

  it("falls back to SSR when stored id is stale", () => {
    const initialSavedView = snapshot("default");
    const result = resolveModuleSavedViewRestoreTarget({
      storedViewId: "deleted-view",
      initialSavedViews: views,
      initialSavedView,
      initialFilteredItemIds: null,
    });

    expect(result).toEqual({
      kind: "hydrate",
      snapshot: initialSavedView,
      filteredItemIds: null,
    });
  });
});
