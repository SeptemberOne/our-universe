-- Phase 2 — Step 1: Private Supabase Storage bucket & RLS policies for future couple photos.
-- Path convention: couple-photos/<couple_id>/<photo_uuid>.<ext>
-- Note: Upload/download UI is intentionally deferred to Phase 3.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'couple-photos',
  'couple-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.try_parse_uuid(p_text text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF p_text IS NULL OR p_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN p_text::uuid;
END;
$$;

REVOKE ALL ON FUNCTION public.try_parse_uuid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.try_parse_uuid(text) TO authenticated;

DROP POLICY IF EXISTS couple_photos_select_member ON storage.objects;
CREATE POLICY couple_photos_select_member
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'couple-photos'
    AND name NOT LIKE '%..%'
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS couple_photos_insert_member ON storage.objects;
CREATE POLICY couple_photos_insert_member
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'couple-photos'
    AND owner = auth.uid()
    AND name NOT LIKE '%..%'
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS couple_photos_update_member ON storage.objects;
CREATE POLICY couple_photos_update_member
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'couple-photos'
    AND name NOT LIKE '%..%'
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  )
  WITH CHECK (
    bucket_id = 'couple-photos'
    AND name NOT LIKE '%..%'
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );

DROP POLICY IF EXISTS couple_photos_delete_member ON storage.objects;
CREATE POLICY couple_photos_delete_member
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'couple-photos'
    AND name NOT LIKE '%..%'
    AND public.is_couple_member(public.try_parse_uuid((storage.foldername(name))[1]))
  );
