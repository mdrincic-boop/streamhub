import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Stream, supabase } from '../lib/supabase';
import { VideoPlayer } from '../components/VideoPlayer';
import { Radio } from 'lucide-react';

export function EmbedPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const [searchParams] = useSearchParams();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);

  const autoplay = searchParams.get('autoplay') === '1';
  const muted = searchParams.get('muted') === '1';
  const controls = searchParams.get('controls') !== '0';
  const skin = searchParams.get('skin') || 'default';

  useEffect(() => {
    loadStream();

    const channel = supabase
      .channel(`embed-stream-${streamId}`)
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

      const { data, error: fetchError } = await supabase
        .from('streams')
        .select('*')
        .eq('id', streamId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data && data.is_public) {
        setStream(data);
      }
    } catch (err) {
      console.error('Error loading stream:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="text-center">
          <Radio size={48} className="text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Stream not available</p>
        </div>
      </div>
    );
  }

  const containerClass = skin === 'minimal'
    ? 'w-full h-full bg-black'
    : 'w-full h-full bg-slate-900';

  return (
    <div className={containerClass}>
      {stream.status === 'live' && stream.hls_url ? (
        <div className="w-full h-full">
          <VideoPlayer
            src={stream.hls_url}
            autoPlay={autoplay}
            muted={muted}
            controls={controls}
          />
          {skin === 'default' && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded-full">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                    LIVE
                  </span>
                  <span className="text-white text-sm font-medium">{stream.stream_name}</span>
                </div>
                {stream.viewer_count > 0 && (
                  <span className="text-slate-300 text-xs">
                    {stream.viewer_count} watching
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-black">
          <div className="text-center">
            <Radio size={skin === 'minimal' ? 32 : 48} className="text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">
              {skin === 'minimal' ? 'Offline' : 'Stream is currently offline'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
