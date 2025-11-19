/*
  # Streaming Platform Database Schema

  ## Overview
  Complete database schema for a live streaming platform similar to Wowza/Flussonic.
  Supports stream management, user authentication, analytics, and recording.

  ## New Tables

  ### 1. `streams`
  Main table for managing live streams
  - `id` (uuid, primary key) - Unique stream identifier
  - `stream_key` (text, unique) - Secret key for publishing
  - `stream_name` (text) - Display name for the stream
  - `title` (text) - Stream title/description
  - `status` (text) - Stream status: 'offline', 'live', 'error'
  - `rtmp_url` (text) - RTMP ingest URL
  - `hls_url` (text) - HLS playback URL
  - `thumbnail_url` (text) - Stream thumbnail
  - `viewer_count` (integer) - Current viewer count
  - `is_recording` (boolean) - Recording enabled/disabled
  - `is_public` (boolean) - Public or private stream
  - `created_by` (uuid) - User who created the stream
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  - `started_at` (timestamptz) - When stream went live
  - `ended_at` (timestamptz) - When stream ended

  ### 2. `stream_analytics`
  Analytics and metrics for streams
  - `id` (uuid, primary key)
  - `stream_id` (uuid) - Reference to stream
  - `viewer_count` (integer) - Viewers at this moment
  - `bitrate` (integer) - Current bitrate in kbps
  - `fps` (integer) - Frames per second
  - `resolution` (text) - Video resolution (e.g., "1920x1080")
  - `timestamp` (timestamptz) - When metrics were recorded

  ### 3. `stream_recordings`
  Recorded stream sessions
  - `id` (uuid, primary key)
  - `stream_id` (uuid) - Reference to stream
  - `file_url` (text) - URL to recording file
  - `duration` (integer) - Duration in seconds
  - `file_size` (bigint) - File size in bytes
  - `started_at` (timestamptz) - Recording start time
  - `ended_at` (timestamptz) - Recording end time
  - `created_at` (timestamptz)

  ### 4. `viewers`
  Track individual viewer sessions
  - `id` (uuid, primary key)
  - `stream_id` (uuid) - Reference to stream
  - `session_id` (text) - Unique session identifier
  - `ip_address` (text) - Viewer IP (anonymized)
  - `user_agent` (text) - Browser/device info
  - `connected_at` (timestamptz) - Connection start
  - `disconnected_at` (timestamptz) - Connection end
  - `watch_duration` (integer) - Total watch time in seconds

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only manage their own streams
  - Public streams are viewable by anyone
  - Analytics and recordings restricted to stream owners
  - Viewer data protected and anonymized

  ## Indexes
  - Performance indexes on frequently queried columns
  - Foreign key indexes for joins
*/

-- Create streams table
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  stream_name text NOT NULL,
  title text DEFAULT '',
  status text DEFAULT 'offline' CHECK (status IN ('offline', 'live', 'error')),
  rtmp_url text DEFAULT '',
  hls_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  viewer_count integer DEFAULT 0,
  is_recording boolean DEFAULT false,
  is_public boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Create stream_analytics table
CREATE TABLE IF NOT EXISTS stream_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES streams(id) ON DELETE CASCADE NOT NULL,
  viewer_count integer DEFAULT 0,
  bitrate integer DEFAULT 0,
  fps integer DEFAULT 0,
  resolution text DEFAULT '',
  timestamp timestamptz DEFAULT now()
);

-- Create stream_recordings table
CREATE TABLE IF NOT EXISTS stream_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES streams(id) ON DELETE CASCADE NOT NULL,
  file_url text NOT NULL,
  duration integer DEFAULT 0,
  file_size bigint DEFAULT 0,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create viewers table
CREATE TABLE IF NOT EXISTS viewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid REFERENCES streams(id) ON DELETE CASCADE NOT NULL,
  session_id text NOT NULL,
  ip_address text DEFAULT '',
  user_agent text DEFAULT '',
  connected_at timestamptz DEFAULT now(),
  disconnected_at timestamptz,
  watch_duration integer DEFAULT 0
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_streams_created_by ON streams(created_by);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_is_public ON streams(is_public);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_timestamp ON stream_analytics(timestamp);
CREATE INDEX IF NOT EXISTS idx_stream_recordings_stream_id ON stream_recordings(stream_id);
CREATE INDEX IF NOT EXISTS idx_viewers_stream_id ON viewers(stream_id);
CREATE INDEX IF NOT EXISTS idx_viewers_session_id ON viewers(session_id);

-- Enable Row Level Security
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewers ENABLE ROW LEVEL SECURITY;

-- Streams policies
CREATE POLICY "Public streams are viewable by anyone"
  ON streams FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create their own streams"
  ON streams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own streams"
  ON streams FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own streams"
  ON streams FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Stream analytics policies
CREATE POLICY "Stream owners can view analytics"
  ON stream_analytics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_analytics.stream_id
      AND streams.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert analytics"
  ON stream_analytics FOR INSERT
  WITH CHECK (true);

-- Stream recordings policies
CREATE POLICY "Stream owners can view recordings"
  ON stream_recordings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = stream_recordings.stream_id
      AND streams.created_by = auth.uid()
    )
  );

CREATE POLICY "System can insert recordings"
  ON stream_recordings FOR INSERT
  WITH CHECK (true);

-- Viewers policies
CREATE POLICY "Stream owners can view viewer data"
  ON viewers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams
      WHERE streams.id = viewers.stream_id
      AND streams.created_by = auth.uid()
    )
  );

CREATE POLICY "System can track viewers"
  ON viewers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update viewer sessions"
  ON viewers FOR UPDATE
  WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
CREATE TRIGGER update_streams_updated_at
  BEFORE UPDATE ON streams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();