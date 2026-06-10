import { describe, expect, it } from "vitest";
import {
  apportionTransactionDiscount,
  normalizeTransactionDiscountForSave,
  resolveTransactionDiscount,
} from "@/lib/procurement/purchase-orders/po-transaction-discount";

describe("po-transaction-discount", () => {
  it("resolves percent trade discount capped at subtotal", () => {
    expect(
      resolveTransactionDiscount(1000, {
        transaction_discount_percentage: "10",
        transaction_discount_amount: "0",
        transaction_discount_type: "percent",
      })
    ).toBe(100);
  });

  it("resolves fixed amount trade discount capped at subtotal", () => {
    expect(
      resolveTransactionDiscount(100, {
        transaction_discount_percentage: "50",
        transaction_discount_amount: "250",
        transaction_discount_type: "amount",
      })
    ).toBe(100);
  });

  it("apportions discount with remainder on last line", () => {
    expect(apportionTransactionDiscount([100, 100, 100], 10)).toEqual([3.3333, 3.3333, 3.3334]);
  });

  it("normalizes save payload to a single active discount field", () => {
    expect(
      normalizeTransactionDiscountForSave(
        {
          transaction_discount_type: "percent",
          transaction_discount_percentage: "10",
          transaction_discount_amount: "99",
        },
        200
      )
    ).toEqual({
      transaction_discount_percentage: 10,
      transaction_discount_amount: 20,
      transaction_discount_type: "percent",
    });

    expect(
      normalizeTransactionDiscountForSave(
        {
          transaction_discount_type: "amount",
          transaction_discount_percentage: "50",
          transaction_discount_amount: "25",
        },
        200
      )
    ).toEqual({
      transaction_discount_percentage: 0,
      transaction_discount_amount: 25,
      transaction_discount_type: "amount",
    });
  });
});
