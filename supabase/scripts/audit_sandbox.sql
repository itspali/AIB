-- Pre-flight audit (read-only)
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'return_policies','accounts','tax_rate_registry',
    'storefront_channels','item_variants'
  )
ORDER BY table_name;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'item_variants'
  AND column_name IN ('dead_weight_kg','length_cm','weight','length')
ORDER BY column_name;

SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('return_policies','accounts','tax_rate_registry','storefront_channels')
ORDER BY tablename, policyname;

SELECT routine_schema, routine_name FROM information_schema.routines
WHERE routine_schema = 'private' AND routine_name = 'initialize_new_tenant';
