import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Stream = {
  id: string;
  stream_key: string;
  stream_name: string;
  title: string;
  status: 'offline' | 'live' | 'error';
  rtmp_url: string;
  hls_url: string;
  thumbnail_url: string;
  viewer_count: number;
  is_recording: boolean;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  ended_at?: string;
};

export type StreamAnalytics = {
  id: string;
  stream_id: string;
  viewer_count: number;
  bitrate: number;
  fps: number;
  resolution: string;
  timestamp: string;
};

export type StreamRecording = {
  id: string;
  stream_id: string;
  file_url: string;
  duration: number;
  file_size: number;
  started_at: string;
  ended_at?: string;
  created_at: string;
};
