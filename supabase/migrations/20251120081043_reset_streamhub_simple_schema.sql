/*
  # StreamHub Reset - Simple Schema

  1. Cleanup
    - Drop all existing tables and policies
    - Clean slate for simple architecture

  2. New Tables
    - `streams` - Basic stream information only
      - `id` (uuid, primary key)
      - `stream_key` (text, unique) - For RTMP authentication
      - `stream_name` (text) - Friendly name for URL
      - `title` (text) - Display title
      - `description` (text) - Stream description
      - `status` (text) - offline/live/error
      - `input_type` (text) - rtmp/rtsp
      - `rtmp_url` (text) - RTMP publish URL
      - `rtsp_url` (text) - RTSP source URL (for IP cameras)
      - `rtsp_username` (text) - RTSP auth
      - `rtsp_password` (text) - RTSP auth
      - `hls_url` (text) - HLS playback URL
      - `thumbnail_url` (text) - Stream thumbnail
      - `viewer_count` (integer) - Current viewers
      - `is_public` (boolean) - Public/private stream
      - `created_by` (uuid) - User who created stream
      - `created_at` (timestamptz)
      - `started_at` (timestamptz) - When stream went live
      - `ended_at` (timestamptz) - When stream ended

  3. Security
    - Enable RLS on streams table
    - Public can view public streams
    - Authenticated users can create streams
    - Users can manage their own streams
*/

-- Drop all existing tables
DROP TABLE IF EXISTS stream_overlays CASCADE;
DROP TABLE IF EXISTS stream_analytics CASCADE;
DROP TABLE IF EXISTS stream_recordings CASCADE;
DROP TABLE IF EXISTS stream_settings CASCADE;
DROP TABLE IF EXISTS stream_schedules CASCADE;
DROP TABLE IF EXISTS stream_templates CASCADE;
DROP TABLE IF EXISTS viewers CASCADE;
DROP TABLE IF EXISTS admin_logs CASCADE;
DROP TABLE IF EXISTS server_health CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS streams CASCADE;

-- Create simple streams table
CREATE TABLE IF NOT EXISTS streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_key text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  stream_name text NOT NULL,
  title text DEFAULT '',
  description text DEFAULT '',
  status text DEFAULT 'offline' CHECK (status IN ('offline', 'live', 'error')),
  input_type text DEFAULT 'rtmp' CHECK (input_type IN ('rtmp', 'rtsp')),
  rtmp_url text DEFAULT '',
  rtsp_url text,
  rtsp_username text,
  rtsp_password text,
  hls_url text DEFAULT '',
  thumbnail_url text DEFAULT '',
  viewer_count integer DEFAULT 0,
  is_public boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

-- Enable RLS
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- Public can view public streams
CREATE POLICY "Anyone can view public streams"
  ON streams FOR SELECT
  USING (is_public = true);

-- Authenticated users can view all streams
CREATE POLICY "Authenticated users can view all streams"
  ON streams FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create streams
CREATE POLICY "Authenticated users can create streams"
  ON streams FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Users can update their own streams
CREATE POLICY "Users can update own streams"
  ON streams FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Users can delete their own streams
CREATE POLICY "Users can delete own streams"
  ON streams FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_streams_created_by ON streams(created_by);
CREATE INDEX IF NOT EXISTS idx_streams_stream_key ON streams(stream_key);
