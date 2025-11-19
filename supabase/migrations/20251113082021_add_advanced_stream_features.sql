/*
  # Add Advanced Stream Features

  1. New Tables
    - `stream_settings` - Quality and encoding settings per stream
    - `stream_schedules` - Scheduled streaming times
    - `stream_templates` - Reusable stream configurations
    - `system_settings` - Global system configuration
    - `admin_logs` - Audit logs for admin actions
    - `server_health` - Server monitoring metrics

  2. Columns Added to Existing Tables
    - `streams` table:
      - `max_bitrate` - Maximum allowed bitrate
      - `target_resolution` - Target resolution
      - `target_fps` - Target framerate
      - `low_latency_mode` - Enable low latency
      - `dvr_enabled` - Enable DVR/timeshift
      - `recording_enabled` - Auto-record streams
      - `scheduled_start` - Scheduled start time
      - `failover_url` - Backup stream URL

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
    - Admin-only policies for system settings

  4. Indexes
    - Performance indexes for frequently queried fields
*/

-- Add new columns to streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS max_bitrate INTEGER DEFAULT 5000;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS target_resolution VARCHAR(20) DEFAULT '1080p';
ALTER TABLE streams ADD COLUMN IF NOT EXISTS target_fps INTEGER DEFAULT 30;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS low_latency_mode BOOLEAN DEFAULT false;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS dvr_enabled BOOLEAN DEFAULT false;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS dvr_window INTEGER DEFAULT 3600;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS recording_enabled BOOLEAN DEFAULT false;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMPTZ;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS scheduled_end TIMESTAMPTZ;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS failover_url TEXT;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS transcoding_enabled BOOLEAN DEFAULT false;
ALTER TABLE streams ADD COLUMN IF NOT EXISTS template_id UUID;

-- Stream Settings Table
CREATE TABLE IF NOT EXISTS stream_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  
  -- Quality Settings
  bitrate_preset VARCHAR(20) DEFAULT 'medium',
  custom_bitrate INTEGER,
  resolution VARCHAR(20) DEFAULT '1080p',
  fps INTEGER DEFAULT 30,
  
  -- Transcoding
  adaptive_bitrate BOOLEAN DEFAULT false,
  transcoding_profiles JSONB DEFAULT '[]'::jsonb,
  
  -- Advanced Options
  keyframe_interval INTEGER DEFAULT 2,
  encoding_preset VARCHAR(20) DEFAULT 'veryfast',
  audio_bitrate INTEGER DEFAULT 128,
  audio_codec VARCHAR(20) DEFAULT 'aac',
  video_codec VARCHAR(20) DEFAULT 'h264',
  
  -- DVR Settings
  dvr_enabled BOOLEAN DEFAULT false,
  dvr_window_seconds INTEGER DEFAULT 3600,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stream_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own stream settings"
  ON stream_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_settings.stream_id 
      AND streams.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own stream settings"
  ON stream_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_settings.stream_id 
      AND streams.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_settings.stream_id 
      AND streams.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own stream settings"
  ON stream_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_settings.stream_id 
      AND streams.created_by = auth.uid()
    )
  );

-- Stream Schedules Table
CREATE TABLE IF NOT EXISTS stream_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(50),
  
  notification_sent BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'scheduled',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stream_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedules"
  ON stream_schedules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own schedules"
  ON stream_schedules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Stream Templates Table
CREATE TABLE IF NOT EXISTS stream_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Template Settings
  settings JSONB DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  
  usage_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stream_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own templates"
  ON stream_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can manage own templates"
  ON stream_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System Settings Table (Admin Only)
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage system settings"
  ON system_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Users can view system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (true);

-- Admin Logs Table
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all logs"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "System can insert logs"
  ON admin_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Server Health Metrics Table
CREATE TABLE IF NOT EXISTS server_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  server_name VARCHAR(100) NOT NULL,
  
  -- Resource Metrics
  cpu_usage DECIMAL(5,2),
  memory_usage DECIMAL(5,2),
  disk_usage DECIMAL(5,2),
  
  -- Stream Metrics
  active_streams INTEGER DEFAULT 0,
  total_viewers INTEGER DEFAULT 0,
  bandwidth_mbps DECIMAL(10,2),
  
  -- Health Status
  status VARCHAR(20) DEFAULT 'healthy',
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE server_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view server health"
  ON server_health FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "System can insert health metrics"
  ON server_health FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin role check function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT raw_app_meta_data->>'role' = 'admin'
    FROM auth.users
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stream_settings_stream_id ON stream_settings(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_schedules_user_id ON stream_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_schedules_scheduled_start ON stream_schedules(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_stream_templates_user_id ON stream_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_templates_public ON stream_templates(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_health_created_at ON server_health(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_scheduled_start ON streams(scheduled_start) WHERE scheduled_start IS NOT NULL;

-- Insert default system settings
INSERT INTO system_settings (key, value, category, description) VALUES
  ('max_bitrate_global', '10000', 'quality', 'Maximum bitrate allowed globally (kbps)')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, category, description) VALUES
  ('max_concurrent_streams_per_user', '5', 'limits', 'Maximum concurrent streams per user')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, category, description) VALUES
  ('recording_storage_limit_gb', '100', 'storage', 'Recording storage limit per user (GB)')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, category, description) VALUES
  ('enable_transcoding', 'true', 'features', 'Enable multi-bitrate transcoding')
  ON CONFLICT (key) DO NOTHING;

INSERT INTO system_settings (key, value, category, description) VALUES
  ('dvr_max_window', '7200', 'features', 'Maximum DVR window in seconds')
  ON CONFLICT (key) DO NOTHING;
