import { describe, expect, it } from "vitest";
import { transfersHrefWithStatusFilter } from "@/lib/inventory/transfers/navigation";

describe("transfersHrefWithStatusFilter", () => {
  it("builds a transfers list URL with encoded status filter", () => {
    expect(transfersHrefWithStatusFilter("DISPATCHED_IN_TRANSIT")).toBe(
      "/inventory/transfers?status=DISPATCHED_IN_TRANSIT"
    );
  });
});
