import { describe, expect, it } from "vitest";
import {
  estimateSmsSegments,
  listUnknownMergeFields,
  renderNotificationTemplate,
} from "@/lib/notifications/render-template";

describe("renderNotificationTemplate", () => {
  it("replaces known merge fields", () => {
    const output = renderNotificationTemplate(
      "Approve {{document.number}} for {{party.name}}",
      {
        "document.number": "PO-1",
        "party.name": "Acme",
      }
    );

    expect(output).toBe("Approve PO-1 for Acme");
  });

  it("leaves unknown tokens intact", () => {
    const output = renderNotificationTemplate("Hello {{unknown.field}}");
    expect(output).toBe("Hello {{unknown.field}}");
  });
});

describe("listUnknownMergeFields", () => {
  it("detects unknown merge fields", () => {
    expect(
      listUnknownMergeFields("{{document.number}} {{custom.thing}} {{approver.name}}")
    ).toEqual(["custom.thing"]);
  });
});

describe("estimateSmsSegments", () => {
  it("counts single segment SMS", () => {
    expect(estimateSmsSegments("Short message")).toEqual({ length: 13, segments: 1 });
  });

  it("counts multi-segment SMS", () => {
    const long = "x".repeat(170);
    expect(estimateSmsSegments(long)).toEqual({ length: 170, segments: 2 });
  });
});
