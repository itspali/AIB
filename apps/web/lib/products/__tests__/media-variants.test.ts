import { describe, expect, it } from "vitest";
import {
  filterSharedMedia,
  filterVariantSpecificMedia,
  listMediaVariantRows,
} from "@/lib/products/media-variants";
import type { ProductMediaSnapshot, ProductVariantSnapshot } from "@/lib/products/types";

const masterId = "master-id";
const redId = "red-id";
const blueId = "blue-id";

const variants: ProductVariantSnapshot[] = [
  {
    id: masterId,
    sku: "SHIRT",
    is_master: true,
    is_sellable: true,
  } as ProductVariantSnapshot,
  {
    id: redId,
    sku: "SHIRT-RED",
    is_master: false,
    is_sellable: true,
  } as ProductVariantSnapshot,
  {
    id: blueId,
    sku: "SHIRT-BLUE",
    is_master: false,
    is_sellable: true,
  } as ProductVariantSnapshot,
];

const media: ProductMediaSnapshot[] = [
  {
    id: "m1",
    variant_id: masterId,
    storage_url: "shared.jpg",
    sort_order: 0,
    is_primary: true,
    created_at: "2024-01-01",
  } as ProductMediaSnapshot,
  {
    id: "r1",
    variant_id: redId,
    storage_url: "red.jpg",
    sort_order: 0,
    is_primary: true,
    created_at: "2024-01-02",
  } as ProductMediaSnapshot,
];

describe("media-variants", () => {
  it("lists master first then sellable SKUs", () => {
    const rows = listMediaVariantRows(variants);
    expect(rows.map((row) => row.key)).toEqual([masterId, blueId, redId]);
    expect(rows[0]?.isMaster).toBe(true);
  });

  it("treats master and product-level media as shared", () => {
    const shared = filterSharedMedia(media, variants[0]!);
    expect(shared.map((entry) => entry.id)).toEqual(["m1"]);
  });

  it("returns only variant-owned media for a SKU", () => {
    const redOnly = filterVariantSpecificMedia(media, redId);
    expect(redOnly.map((entry) => entry.id)).toEqual(["r1"]);
  });
});
