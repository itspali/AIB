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

  it("renders quotation sent template variables", () => {
    const output = renderNotificationTemplate(
      "Quotation {{quotation_number}} for {{customer_name}} — valid until {{valid_until}}. Total {{total_net_amount}}. From {{sender_name}}.",
      {
        quotation_number: "QT-100",
        customer_name: "Acme",
        valid_until: "2026-07-01",
        total_net_amount: "INR 12,000.00",
        sender_name: "Jane",
      }
    );

    expect(output).toBe(
      "Quotation QT-100 for Acme — valid until 2026-07-01. Total INR 12,000.00. From Jane."
    );
  });
});
