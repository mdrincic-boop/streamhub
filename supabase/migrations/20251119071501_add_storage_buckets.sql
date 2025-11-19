/*
  # Add Storage Buckets for Recordings and Snapshots

  1. Storage Setup
    - Create bucket for stream recordings
    - Create bucket for stream snapshots
    - Configure public access policies

  2. Security
    - Recordings accessible only to stream owner
    - Snapshots publicly accessible for sharing
    - Proper RLS policies for bucket access

  3. Storage Policies
    - Users can upload to their own stream folders
    - Public can view snapshots
    - Only owners can delete recordings
*/

-- ==========================================
-- 1. CREATE STORAGE BUCKETS
-- ==========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('stream-recordings', 'stream-recordings', false, 10737418240, ARRAY['video/mp4', 'video/x-flv', 'video/MP2T']::text[]),
  ('stream-snapshots', 'stream-snapshots', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ==========================================
-- 2. STORAGE POLICIES - RECORDINGS
-- ==========================================

DROP POLICY IF EXISTS "Users can upload recordings to own streams" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own stream recordings" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own stream recordings" ON storage.objects;

CREATE POLICY "Users can upload recordings to own streams"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stream-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM streams WHERE created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can view own stream recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'stream-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM streams WHERE created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Users can delete own stream recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stream-recordings'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM streams WHERE created_by = (SELECT auth.uid())
  )
);

-- ==========================================
-- 3. STORAGE POLICIES - SNAPSHOTS
-- ==========================================

DROP POLICY IF EXISTS "Users can upload snapshots to own streams" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view public snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own stream snapshots" ON storage.objects;

CREATE POLICY "Users can upload snapshots to own streams"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'stream-snapshots'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM streams WHERE created_by = (SELECT auth.uid())
  )
);

CREATE POLICY "Anyone can view public snapshots"
ON storage.objects FOR SELECT
USING (bucket_id = 'stream-snapshots');

CREATE POLICY "Users can delete own stream snapshots"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'stream-snapshots'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM streams WHERE created_by = (SELECT auth.uid())
  )
);

-- ==========================================
-- 4. ADD SNAPSHOT URL COLUMN
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams'
    AND column_name = 'snapshot_url'
  ) THEN
    ALTER TABLE streams ADD COLUMN snapshot_url text;
  END IF;
END $$;

-- ==========================================
-- 5. UPDATE STREAM_RECORDINGS TABLE
-- ==========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_recordings'
    AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE stream_recordings ADD COLUMN storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_recordings'
    AND column_name = 'file_size'
  ) THEN
    ALTER TABLE stream_recordings ADD COLUMN file_size bigint DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_recordings'
    AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE stream_recordings ADD COLUMN thumbnail_url text;
  END IF;
END $$;

-- ==========================================
-- 6. CREATE HELPER FUNCTION FOR CLEANUP
-- ==========================================

CREATE OR REPLACE FUNCTION cleanup_stream_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id IN ('stream-recordings', 'stream-snapshots')
  AND (storage.foldername(name))[1] = OLD.id::text;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_stream_files_trigger ON streams;

CREATE TRIGGER cleanup_stream_files_trigger
  BEFORE DELETE ON streams
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_stream_files();

COMMENT ON FUNCTION cleanup_stream_files() IS
  'Automatically cleanup storage files when stream is deleted';
