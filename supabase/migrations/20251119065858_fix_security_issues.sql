/*
  # Fix Security and Performance Issues

  1. Performance Improvements
    - Add missing foreign key index on stream_schedules.stream_id
    - Optimize RLS policies to use (SELECT auth.uid()) instead of auth.uid()
    - Remove unused indexes that add overhead

  2. Security Improvements
    - Fix multiple permissive policies by consolidating them
    - Fix function search paths to prevent SQL injection
    - Functions now use SECURITY DEFINER with stable search_path

  3. RLS Policy Optimizations
    - Wrap all auth.uid() calls in SELECT subquery
    - Wrap all auth.jwt() calls in SELECT subquery
    - This prevents re-evaluation for each row and improves performance at scale

  4. Index Management
    - Add missing indexes for foreign keys
    - Remove unused indexes to reduce write overhead
*/

-- ==========================================
-- 1. ADD MISSING FOREIGN KEY INDEX
-- ==========================================

-- Add index for stream_schedules.stream_id foreign key
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'stream_schedules' 
    AND indexname = 'idx_stream_schedules_stream_id_fkey'
  ) THEN
    CREATE INDEX idx_stream_schedules_stream_id_fkey 
    ON stream_schedules(stream_id);
  END IF;
END $$;

-- ==========================================
-- 2. REMOVE UNUSED INDEXES
-- ==========================================

DROP INDEX IF EXISTS idx_streams_status;
DROP INDEX IF EXISTS idx_stream_analytics_timestamp;
DROP INDEX IF EXISTS idx_viewers_session_id;
DROP INDEX IF EXISTS idx_stream_schedules_user_id;
DROP INDEX IF EXISTS idx_stream_schedules_scheduled_start;
DROP INDEX IF EXISTS idx_stream_templates_user_id;
DROP INDEX IF EXISTS idx_stream_templates_public;
DROP INDEX IF EXISTS idx_admin_logs_admin_id;
DROP INDEX IF EXISTS idx_admin_logs_created_at;
DROP INDEX IF EXISTS idx_server_health_created_at;
DROP INDEX IF EXISTS idx_streams_scheduled_start;
DROP INDEX IF EXISTS idx_stream_overlays_enabled;

-- ==========================================
-- 3. FIX RLS POLICIES - STREAMS TABLE
-- ==========================================

DROP POLICY IF EXISTS "Public streams are viewable by anyone" ON streams;
DROP POLICY IF EXISTS "Users can create their own streams" ON streams;
DROP POLICY IF EXISTS "Users can update their own streams" ON streams;
DROP POLICY IF EXISTS "Users can delete their own streams" ON streams;

CREATE POLICY "Public streams are viewable by anyone"
  ON streams FOR SELECT
  USING (is_public = true OR created_by = (SELECT auth.uid()));

CREATE POLICY "Users can create their own streams"
  ON streams FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can update their own streams"
  ON streams FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can delete their own streams"
  ON streams FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

-- ==========================================
-- 4. FIX RLS POLICIES - STREAM_ANALYTICS
-- ==========================================

DROP POLICY IF EXISTS "Stream owners can view analytics" ON stream_analytics;

CREATE POLICY "Stream owners can view analytics"
  ON stream_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_analytics.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

-- ==========================================
-- 5. FIX RLS POLICIES - STREAM_RECORDINGS
-- ==========================================

DROP POLICY IF EXISTS "Stream owners can view recordings" ON stream_recordings;

CREATE POLICY "Stream owners can view recordings"
  ON stream_recordings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_recordings.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

-- ==========================================
-- 6. FIX RLS POLICIES - VIEWERS
-- ==========================================

DROP POLICY IF EXISTS "Stream owners can view viewer data" ON viewers;

CREATE POLICY "Stream owners can view viewer data"
  ON viewers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = viewers.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

-- ==========================================
-- 7. FIX RLS POLICIES - STREAM_SETTINGS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own stream settings" ON stream_settings;
DROP POLICY IF EXISTS "Users can update own stream settings" ON stream_settings;
DROP POLICY IF EXISTS "Users can insert own stream settings" ON stream_settings;

CREATE POLICY "Users can view own stream settings"
  ON stream_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_settings.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own stream settings"
  ON stream_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_settings.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_settings.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own stream settings"
  ON stream_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_settings.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

-- ==========================================
-- 8. FIX RLS POLICIES - STREAM_SCHEDULES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own schedules" ON stream_schedules;
DROP POLICY IF EXISTS "Users can manage own schedules" ON stream_schedules;

CREATE POLICY "Users can manage own schedules"
  ON stream_schedules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_schedules.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_schedules.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

-- ==========================================
-- 9. FIX RLS POLICIES - STREAM_TEMPLATES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own templates" ON stream_templates;
DROP POLICY IF EXISTS "Users can manage own templates" ON stream_templates;

CREATE POLICY "Users can manage own templates"
  ON stream_templates FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid()) OR is_public = true
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- ==========================================
-- 10. FIX RLS POLICIES - SYSTEM_SETTINGS
-- ==========================================

DROP POLICY IF EXISTS "Admins can manage system settings" ON system_settings;
DROP POLICY IF EXISTS "Users can view system settings" ON system_settings;

CREATE POLICY "Users can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = (SELECT auth.uid())
      AND (auth.users.raw_app_meta_data->>'role')::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = (SELECT auth.uid())
      AND (auth.users.raw_app_meta_data->>'role')::text = 'admin'
    )
  );

-- ==========================================
-- 11. FIX RLS POLICIES - ADMIN_LOGS
-- ==========================================

DROP POLICY IF EXISTS "Admins can view all logs" ON admin_logs;

CREATE POLICY "Admins can view all logs"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = (SELECT auth.uid())
      AND (auth.users.raw_app_meta_data->>'role')::text = 'admin'
    )
  );

-- ==========================================
-- 12. FIX RLS POLICIES - SERVER_HEALTH
-- ==========================================

DROP POLICY IF EXISTS "Admins can view server health" ON server_health;

CREATE POLICY "Admins can view server health"
  ON server_health FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = (SELECT auth.uid())
      AND (auth.users.raw_app_meta_data->>'role')::text = 'admin'
    )
  );

-- ==========================================
-- 13. FIX RLS POLICIES - STREAM_OVERLAYS
-- ==========================================

DROP POLICY IF EXISTS "Users can view overlays for their streams" ON stream_overlays;
DROP POLICY IF EXISTS "Users can manage overlays for their streams" ON stream_overlays;

CREATE POLICY "Users can manage overlays for their streams"
  ON stream_overlays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_overlays.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_overlays.stream_id
      AND streams.created_by = (SELECT auth.uid())
    )
  );

-- ==========================================
-- 14. FIX FUNCTION SEARCH PATHS
-- ==========================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (raw_app_meta_data->>'role')::text = 'admin',
      false
    )
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION update_overlay_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==========================================
-- 15. ADD COMMENTS FOR DOCUMENTATION
-- ==========================================

COMMENT ON POLICY "Public streams are viewable by anyone" ON streams IS 
  'Optimized RLS: Uses (SELECT auth.uid()) to prevent re-evaluation per row';

COMMENT ON POLICY "Users can manage own schedules" ON stream_schedules IS 
  'Consolidated policy using FOR ALL instead of separate SELECT/INSERT/UPDATE/DELETE policies';

COMMENT ON POLICY "Users can manage own templates" ON stream_templates IS 
  'Consolidated policy using FOR ALL instead of separate SELECT/INSERT/UPDATE/DELETE policies';

COMMENT ON POLICY "Users can manage overlays for their streams" ON stream_overlays IS 
  'Consolidated policy using FOR ALL instead of separate SELECT/INSERT/UPDATE/DELETE policies';

COMMENT ON FUNCTION is_admin() IS 
  'SECURITY DEFINER function with stable search_path to prevent SQL injection';

COMMENT ON INDEX idx_stream_schedules_stream_id_fkey IS 
  'Index to support foreign key lookups and improve join performance';
