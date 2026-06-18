import { describe, expect, it } from "vitest";
import { amountInWordsInr, parsePrintAmountToRupees } from "@/lib/documents/print/amount-in-words";

describe("amount-in-words", () => {
  it("parses formatted currency amounts", () => {
    expect(parsePrintAmountToRupees("₹4,432.00")).toBe(4432);
    expect(parsePrintAmountToRupees("40,356.00")).toBe(40356);
  });

  it("converts rupee amounts to Indian English words", () => {
    expect(amountInWordsInr("4,432.00")).toBe("Four Thousand Four Hundred Thirty Two Rupees Only");
    expect(amountInWordsInr("1,00,000.00")).toBe("One Lakh Rupees Only");
  });

  it("returns null for unparseable amounts", () => {
    expect(amountInWordsInr("—")).toBeNull();
    expect(amountInWordsInr("")).toBeNull();
  });
});
