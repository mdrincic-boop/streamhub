import { useEffect, useState } from 'react';
import { supabase, Stream } from '../lib/supabase';

export function useStreamStatus(streamId: string | undefined) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!streamId) {
      setLoading(false);
      return;
    }

    loadStream();

    if (stream?.input_type === 'rtsp' && stream?.rtsp_url) {
      checkStreamStatus();
    }

    const statusInterval = setInterval(() => {
      if (stream?.input_type === 'rtsp' && stream?.rtsp_url) {
        checkStreamStatus();
      }
    }, 30000);

    const channel = supabase
      .channel(`stream-status-${streamId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'streams',
        filter: `id=eq.${streamId}`,
      }, (payload) => {
        setStream(payload.new as Stream);
      })
      .subscribe();

    return () => {
      clearInterval(statusInterval);
      channel.unsubscribe();
    };
  }, [streamId, stream?.input_type, stream?.rtsp_url]);

  const loadStream = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (!data) {
        setError('Stream not found');
        return;
      }

      setStream(data);
    } catch (err) {
      console.error('Error loading stream:', err);
      setError('Failed to load stream');
    } finally {
      setLoading(false);
    }
  };

  const checkStreamStatus = async () => {
    if (!streamId || !stream?.rtsp_url) return;

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/stream-processor/check`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          streamId,
          rtspUrl: stream.rtsp_url,
        }),
      });

      if (!response.ok) {
        console.error('Failed to check stream status:', await response.text());
      }
    } catch (err) {
      console.error('Error checking stream status:', err);
    }
  };

  return { stream, loading, error, refetch: loadStream, checkStreamStatus };
}
