-- Resolve ambiguous call when two overloads of sync_document_sequences_from_naming exist:
--   (uuid, jsonb) and (uuid, jsonb, uuid default null)
-- Keep the location-aware 3-arg function; 2-arg callers bind via the default NULL location.

DROP FUNCTION IF EXISTS private.sync_document_sequences_from_naming(UUID, JSONB);
