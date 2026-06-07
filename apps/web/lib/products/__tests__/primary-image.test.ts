import { describe, expect, it } from "vitest";
import { resolveEffectivePrimaryMediaId } from "@/lib/products/primary-image";

const media = [
  {
    id: "shared-primary",
    variant_id: "master",
    is_primary: true,
    sort_order: 0,
    created_at: "2026-01-01",
  },
  {
    id: "variant-primary",
    variant_id: "red",
    is_primary: true,
    sort_order: 0,
    created_at: "2026-01-02",
  },
  {
    id: "product-primary",
    variant_id: null,
    is_primary: true,
    sort_order: 0,
    created_at: "2026-01-03",
  },
];

describe("resolveEffectivePrimaryMediaId", () => {
  it("picks one primary for product-level galleries", () => {
    expect(
      resolveEffectivePrimaryMediaId(media, { masterVariantId: "master" })
    ).toBe("shared-primary");
  });

  it("prefers the selected variant scope before shared master images", () => {
    expect(
      resolveEffectivePrimaryMediaId(media, {
        variantId: "red",
        masterVariantId: "master",
      })
    ).toBe("variant-primary");
  });
});
