/*
  # Add Stream Overlay Support

  1. New Tables
    - `stream_overlays` - Configuration for stream overlays (logos, watermarks, etc.)

  2. Features
    - Upload PNG/image overlays
    - Position configuration (top-left, top-right, bottom-left, bottom-right, center, custom)
    - Size configuration (percentage or fixed pixels)
    - Opacity control
    - Multiple overlays per stream
    - Enable/disable per overlay

  3. Security
    - Enable RLS on overlays table
    - Users can only manage overlays for their own streams

  4. Storage
    - Uses Supabase Storage for overlay images
*/

-- Stream Overlays Table
CREATE TABLE IF NOT EXISTS stream_overlays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  
  -- Overlay Configuration
  name VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  
  -- Position (predefined or custom)
  position VARCHAR(20) DEFAULT 'top-right',
  custom_x INTEGER,
  custom_y INTEGER,
  
  -- Size Configuration
  size_mode VARCHAR(20) DEFAULT 'percentage',
  width_percentage INTEGER DEFAULT 15,
  height_percentage INTEGER DEFAULT 15,
  width_pixels INTEGER,
  height_pixels INTEGER,
  
  -- Appearance
  opacity INTEGER DEFAULT 100,
  
  -- Control
  enabled BOOLEAN DEFAULT true,
  layer_order INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stream_overlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view overlays for their streams"
  ON stream_overlays FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_overlays.stream_id 
      AND streams.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can manage overlays for their streams"
  ON stream_overlays FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_overlays.stream_id 
      AND streams.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams 
      WHERE streams.id = stream_overlays.stream_id 
      AND streams.created_by = auth.uid()
    )
  );

-- Add overlay_enabled flag to streams table
ALTER TABLE streams ADD COLUMN IF NOT EXISTS overlay_enabled BOOLEAN DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stream_overlays_stream_id ON stream_overlays(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_overlays_enabled ON stream_overlays(enabled) WHERE enabled = true;

-- Function to update overlay timestamp
CREATE OR REPLACE FUNCTION update_overlay_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stream_overlays_timestamp
  BEFORE UPDATE ON stream_overlays
  FOR EACH ROW
  EXECUTE FUNCTION update_overlay_timestamp();
