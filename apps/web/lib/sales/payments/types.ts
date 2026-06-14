export type GatewayProviderType =
  | "STRIPE"
  | "RAZORPAY"
  | "PAYPAL"
  | "INTERNAL_CREDIT"
  | "BANK_TRANSFER"
  | "CASH_ON_DELIVERY";

export type PaymentApplicationRow = {
  id: string;
  sales_invoice_id: string;
  invoice_number: string;
  amount_applied: string;
  applied_at: string;
};

export type CustomerPaymentRow = {
  id: string;
  payment_number: string;
  customer_id: string;
  customer_name: string;
  amount_received: string;
  amount_applied: string;
  unapplied_balance: string;
  payment_method: GatewayProviderType;
  currency_code: string;
  reference_number: string | null;
  received_at: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  applications?: PaymentApplicationRow[];
};
