import { describe, expect, it } from "vitest";
import {
  resolveActivityEventDescription,
  resolveActivityEventLabel,
} from "@/lib/activity/event-catalog";

describe("activity event catalog", () => {
  it("uses posting step labels when available", () => {
    expect(resolveActivityEventLabel("po_status_issued", "Posting completed")).toBe(
      "Order sent to supplier"
    );
  });

  it("falls back to stored title", () => {
    expect(resolveActivityEventLabel("unknown_code", "Custom title")).toBe("Custom title");
  });

  it("describes linked bill events", () => {
    expect(
      resolveActivityEventDescription("linked", "Bill linked to goods receipt", {
        goods_receipt_id: "grn-1",
      })
    ).toContain("goods receipt");
  });
});
