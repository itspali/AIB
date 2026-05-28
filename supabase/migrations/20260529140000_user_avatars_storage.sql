-- ====================================================================
-- AIB SMART ERP - USER AVATARS STORAGE BUCKET
-- Migration: 20260529140000_user_avatars_storage.sql
-- ====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-avatars',
    'user-avatars',
    FALSE,
    2097152,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY user_avatars_select_own
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'user-avatars'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

CREATE POLICY user_avatars_insert_own
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'user-avatars'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

CREATE POLICY user_avatars_update_own
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'user-avatars'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (storage.foldername(name))[2] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'user-avatars'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );

CREATE POLICY user_avatars_delete_own
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'user-avatars'
        AND (storage.foldername(name))[1] = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
        AND (storage.foldername(name))[2] = auth.uid()::text
    );
