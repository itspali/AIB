export type CoaAccountTemplate = {
  account_code: string;
  account_name: string;
  classification: "ASSET" | "LIABILITY" | "REVENUE" | "EXPENSE";
};

const CORE_COA_ACCOUNTS: CoaAccountTemplate[] = [
  { account_code: "1200-AR", account_name: "Accounts Receivable", classification: "ASSET" },
  { account_code: "1400-INVENTORY", account_name: "Inventory Stock Assets", classification: "ASSET" },
  {
    account_code: "1390-OUTPUT-TAX-RECEIVABLE",
    account_name: "Output Tax Receivable",
    classification: "ASSET",
  },
  { account_code: "4100-REV-STOREFRONT", account_name: "Storefront Revenue", classification: "REVENUE" },
  { account_code: "5000-COGS", account_name: "Cost of Goods Sold", classification: "EXPENSE" },
  {
    account_code: "6900-FOREX-VARIANCE",
    account_name: "Forex Variance Gain/Loss",
    classification: "EXPENSE",
  },
];

export const INDIA_COA_TEMPLATE: CoaAccountTemplate[] = [
  ...CORE_COA_ACCOUNTS,
  { account_code: "1380-INPUT-IGST", account_name: "Input IGST (ITC)", classification: "ASSET" },
  { account_code: "1381-INPUT-CGST", account_name: "Input CGST (ITC)", classification: "ASSET" },
  { account_code: "1382-INPUT-SGST", account_name: "Input SGST (ITC)", classification: "ASSET" },
  { account_code: "2110-IGST-LIABILITY", account_name: "IGST Tax Liability", classification: "LIABILITY" },
  { account_code: "2111-CGST-LIABILITY", account_name: "CGST Tax Liability", classification: "LIABILITY" },
  { account_code: "2112-SGST-LIABILITY", account_name: "SGST Tax Liability", classification: "LIABILITY" },
  { account_code: "2115-RCM-LIABILITY", account_name: "RCM Tax Liability", classification: "LIABILITY" },
  { account_code: "2120-IMPORT-IGST-PAYABLE", account_name: "Import IGST Payable", classification: "LIABILITY" },
  { account_code: "2100-AP", account_name: "Accounts Payable", classification: "LIABILITY" },
];

export const US_COA_TEMPLATE: CoaAccountTemplate[] = [
  ...CORE_COA_ACCOUNTS,
  {
    account_code: "2110-SALES-TAX-LIABILITY",
    account_name: "Sales Tax Liability",
    classification: "LIABILITY",
  },
];

export const VAT_COA_TEMPLATE: CoaAccountTemplate[] = [
  ...CORE_COA_ACCOUNTS,
  { account_code: "2110-VAT-LIABILITY", account_name: "VAT Liability", classification: "LIABILITY" },
];

/** @deprecated Use coaTemplateForCountry from locale-presets */
export const STANDARD_COA_TEMPLATE = INDIA_COA_TEMPLATE;
