-- Reconciles sandbox schema_migrations history only (no-op SELECT applied out-of-band via MCP).
-- Full console impersonation JWT RPCs ship in 20260801150000_console_impersonation_jwt.sql via CI.
SELECT 1;
