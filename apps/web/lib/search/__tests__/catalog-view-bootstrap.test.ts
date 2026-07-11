import { describe, expect, it } from "vitest";
import { resolveActiveCustomModuleView } from "@/lib/search/views/catalog-view-bootstrap";
import type { CustomModuleView } from "@/lib/search/types";

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

describe("resolveActiveCustomModuleView", () => {
  it("returns null when there are no views", () => {
    expect(resolveActiveCustomModuleView([])).toBeNull();
  });

  it("prefers the cookie-selected view when it exists", () => {
    const views = [
      view("default", { is_system_default: true }),
      view("last-active"),
    ];
    expect(resolveActiveCustomModuleView(views, "last-active")?.id).toBe("last-active");
  });

  it("falls back to the system default when the preferred id is missing", () => {
    const views = [view("default", { is_system_default: true }), view("other")];
    expect(resolveActiveCustomModuleView(views, "missing")?.id).toBe("default");
  });

  it("returns null when no preferred id and no default exists", () => {
    const views = [view("a"), view("b")];
    expect(resolveActiveCustomModuleView(views)).toBeNull();
  });
});
