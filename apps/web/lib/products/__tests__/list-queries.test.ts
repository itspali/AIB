import { describe, expect, it } from "vitest";
import { PRODUCT_LIST_PAGE_SIZE } from "@/lib/products/list-page-size";

describe("list-queries", () => {
  it("uses a bounded default page size for initial catalog load", () => {
    expect(PRODUCT_LIST_PAGE_SIZE).toBe(100);
  });

  it("chunks filter id batches at the page size", () => {
    const ids = Array.from({ length: 250 }, (_, index) => `id-${index}`);
    const chunkCount = Math.ceil(ids.length / PRODUCT_LIST_PAGE_SIZE);
    expect(chunkCount).toBe(3);
  });
});
