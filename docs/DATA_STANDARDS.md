# AIB Smart ERP: Core Enterprise Data Standards

This document establishes the absolute architectural data handling rules for the AIB system. All database routines, schema mutations, and API handlers written by Cursor must strictly comply with these standards.

## 1. Relational Keys & Global System IDs
- **Format**: All primary and foreign keys must be strictly `UUIDv4`. Integer-incremented sequencing is prohibited for database keys to prevent enumeration vulnerabilities and merge conflicts.
- **Null Handling**: Database column fields must be explicitly declared `NOT NULL` with structural fallback defaults (e.g., `DEFAULT '{}'::jsonb` or `DEFAULT 0.0000`) unless the column records a genuinely optional lifecycle property.

## 2. Global Multi-Tenancy Boundary Rules
- Every operational data table must feature a `tenant_id UUID` constraint linked back to the master `tenants(id)` entry.
- **RLS Predicate Safeguard**: No custom server-side functions or API handlers may bypass PostgreSQL Row-Level Security (RLS). Every read, write, update, or delete query must structurally pass through the tenant execution context filtering logic:
  ```sql
  WHERE tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid

##  3. Financial Metrics & Currency Standards (Point 3)
Monetary Storage Fields: Currency values must never be stored using standard floating-point numbers (FLOAT or REAL) due to binary rounding drift. All financial metrics, calculations, purchase costs, and wholesale rates must use the NUMERIC(15,4) parameters.

Currency Representation: Global currencies must follow strict ISO 4217 alpha-3 string standardization profiles (e.g., USD, INR, EUR, AED).

## 4. International Localization & Communications (Point 4)
Country References: All geographic countries must be logged using their exact two-letter uppercase standard format matching ISO 3166-1 alpha-2 parameters (e.g., US, IN, GB, DE).

Administrative Phone Formatting: Phone fields must be captured using standard E.164 notation strings up to 30 characters maximum (e.g., +12125550123, +919876543210).

Electronic Mail Stamping: Email attributes must be stored strictly as unified lowercase texts checked against native validation strings at the API interface layer.

## 5. 5. Temporal Audit Integrity & Timestamps (Point 5)
All records must preserve historical creation and modification offsets.

Data Constraints: Fields must always be declared as created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() and updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(). Raw timestamps lacking timezone visibility (TIMESTAMP WITHOUT TIME ZONE) are strictly banned.