export const STANDARD_COA_TEMPLATE = [
  { account_code: "1200-AR", account_name: "Accounts Receivable", classification: "ASSET" as const },
  { account_code: "1400-INVENTORY", account_name: "Inventory Stock Assets", classification: "ASSET" as const },
  { account_code: "1390-OUTPUT-TAX-RECEIVABLE", account_name: "Output Tax Receivable", classification: "ASSET" as const },
  { account_code: "2110-IGST-LIABILITY", account_name: "IGST Tax Liability", classification: "LIABILITY" as const },
  { account_code: "2111-CGST-LIABILITY", account_name: "CGST Tax Liability", classification: "LIABILITY" as const },
  { account_code: "2112-SGST-LIABILITY", account_name: "SGST Tax Liability", classification: "LIABILITY" as const },
  { account_code: "4100-REV-STOREFRONT", account_name: "Storefront Revenue", classification: "REVENUE" as const },
  { account_code: "5000-COGS", account_name: "Cost of Goods Sold", classification: "EXPENSE" as const },
  { account_code: "6900-FOREX-VARIANCE", account_name: "Forex Variance Gain/Loss", classification: "EXPENSE" as const },
];
