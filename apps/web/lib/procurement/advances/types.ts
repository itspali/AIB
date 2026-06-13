export type VendorAdvancePaymentRow = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  payment_reference: string;
  amount: string;
  unapplied_balance: string;
  currency_code: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

export type BillAdvanceApplicationRow = {
  id: string;
  vendor_advance_payment_id: string;
  payment_reference: string;
  amount_applied: string;
  applied_at: string;
};
