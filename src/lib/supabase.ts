import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Stream = {
  id: string;
  stream_key: string;
  stream_name: string;
  title: string;
  description: string;
  status: 'offline' | 'live' | 'error';
  input_type: 'rtmp' | 'rtsp';
  rtmp_url: string;
  rtsp_url?: string;
  rtsp_username?: string;
  rtsp_password?: string;
  hls_url: string;
  thumbnail_url: string;
  viewer_count: number;
  is_public: boolean;
  created_by: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
};
