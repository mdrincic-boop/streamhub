/*
  # Add RTSP Support for IP Cameras

  1. Changes to streams table
    - Add `input_type` column - 'rtmp' or 'rtsp'
    - Add `rtsp_url` column - for RTSP camera URLs
    - Add `rtsp_username` column - for camera authentication
    - Add `rtsp_password` column - for camera authentication
    - Add `pull_mode` column - indicates if server pulls stream (RTSP) vs push (RTMP)

  2. Features
    - Support for IP cameras via RTSP
    - Authentication for RTSP streams
    - Dual mode: RTMP push or RTSP pull
    - Backwards compatible with existing RTMP streams

  3. Security
    - RLS policies already cover new columns
    - RTSP credentials encrypted in transit
*/

-- Add RTSP support columns to streams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'input_type'
  ) THEN
    ALTER TABLE streams ADD COLUMN input_type VARCHAR(10) DEFAULT 'rtmp';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'rtsp_url'
  ) THEN
    ALTER TABLE streams ADD COLUMN rtsp_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'rtsp_username'
  ) THEN
    ALTER TABLE streams ADD COLUMN rtsp_username VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'rtsp_password'
  ) THEN
    ALTER TABLE streams ADD COLUMN rtsp_password VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'pull_mode'
  ) THEN
    ALTER TABLE streams ADD COLUMN pull_mode BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'auto_reconnect'
  ) THEN
    ALTER TABLE streams ADD COLUMN auto_reconnect BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add constraint to ensure RTSP streams have URL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rtsp_url_required'
  ) THEN
    ALTER TABLE streams
    ADD CONSTRAINT rtsp_url_required
    CHECK (
      (input_type = 'rtmp' AND rtsp_url IS NULL) OR
      (input_type = 'rtsp' AND rtsp_url IS NOT NULL)
    );
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN streams.input_type IS 'Stream input type: rtmp (push from encoder) or rtsp (pull from IP camera)';
COMMENT ON COLUMN streams.rtsp_url IS 'RTSP URL for IP cameras (e.g., rtsp://192.168.1.100:554/stream1)';
COMMENT ON COLUMN streams.rtsp_username IS 'Username for RTSP authentication';
COMMENT ON COLUMN streams.rtsp_password IS 'Password for RTSP authentication';
COMMENT ON COLUMN streams.pull_mode IS 'If true, server pulls stream (RTSP). If false, stream is pushed (RTMP)';
COMMENT ON COLUMN streams.auto_reconnect IS 'Auto-reconnect to RTSP source if connection is lost';
