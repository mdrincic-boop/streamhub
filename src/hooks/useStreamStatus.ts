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
      channel.unsubscribe();
    };
  }, [streamId]);

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

  return { stream, loading, error, refetch: loadStream };
}
