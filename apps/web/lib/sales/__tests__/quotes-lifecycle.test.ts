import { describe, expect, it } from "vitest";
import {
  confirmSalesQuotationSchema,
  sendSalesQuotationSchema,
} from "@/lib/sales/quotes/schemas";
import { formatSalesQuoteRpcError } from "@/lib/sales/quotes/rpc-errors";

describe("quote lifecycle schemas", () => {
  it("accepts confirm with quotation id", () => {
    const parsed = confirmSalesQuotationSchema.safeParse({
      quotation_id: "00000000-0000-4000-8000-000000000001",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts send with email channel", () => {
    const parsed = sendSalesQuotationSchema.safeParse({
      quotation_id: "00000000-0000-4000-8000-000000000001",
      sent_to_email: "buyer@example.com",
      send_channel: "EMAIL",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.send_channel).toBe("EMAIL");
  });

  it("accepts manual send without email", () => {
    const parsed = sendSalesQuotationSchema.safeParse({
      quotation_id: "00000000-0000-4000-8000-000000000001",
      send_channel: "MANUAL",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.send_channel).toBe("MANUAL");
  });
});

describe("formatSalesQuoteRpcError lifecycle messages", () => {
  it("maps confirm and send errors to user-facing text", () => {
    expect(
      formatSalesQuoteRpcError("only confirmed quotations can be sent").message
    ).toContain("Confirm the quote");
    expect(
      formatSalesQuoteRpcError("this sales quotation cannot be edited after it has been sent")
        .message
    ).toContain("after it has been sent");
    expect(
      formatSalesQuoteRpcError("approval is not required for this quotation").message
    ).toContain("Confirm it instead");
  });
});
