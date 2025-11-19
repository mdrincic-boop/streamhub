import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stream, supabase } from '../lib/supabase';
import { VideoPlayer } from '../components/VideoPlayer';
import { Radio, Users, Clock, AlertCircle } from 'lucide-react';

export function WatchPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStream();

    const channel = supabase
      .channel(`stream-${streamId}`)
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

      if (!data.is_public) {
        setError('This stream is private');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading stream...</p>
        </div>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-xl p-8 max-w-md w-full text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Stream Not Available</h1>
          <p className="text-slate-400 mb-6">{error || 'Stream not found'}</p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="bg-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="aspect-video bg-black">
            {stream.status === 'live' && stream.hls_url ? (
              <VideoPlayer src={stream.hls_url} autoPlay muted={false} />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Radio size={64} className="text-slate-600 mx-auto mb-4" />
                  <p className="text-xl text-slate-400">Stream is offline</p>
                  <p className="text-sm text-slate-500 mt-2">
                    Check back later when the stream goes live
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-white">{stream.stream_name}</h1>
                  {stream.status === 'live' && (
                    <span className="flex items-center gap-2 px-3 py-1 bg-red-600 text-white text-sm font-semibold rounded-full">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  )}
                </div>
                {stream.description && (
                  <p className="text-slate-400 text-sm">{stream.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-400">
              {stream.status === 'live' && (
                <>
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    <span>{stream.viewer_count || 0} viewers</span>
                  </div>
                  {stream.started_at && (
                    <div className="flex items-center gap-2">
                      <Clock size={16} />
                      <span>
                        Started {new Date(stream.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </>
              )}
              {stream.status === 'offline' && stream.ended_at && (
                <div className="flex items-center gap-2">
                  <Clock size={16} />
                  <span>
                    Last live: {new Date(stream.ended_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {stream.tags && stream.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {stream.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-slate-700 text-slate-300 text-xs rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">About this stream</h2>
          <div className="space-y-3 text-sm">
            {stream.category && (
              <div className="flex items-center justify-between py-2 border-b border-slate-700">
                <span className="text-slate-400">Category</span>
                <span className="text-white font-medium">{stream.category}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Resolution</span>
              <span className="text-white font-medium">{stream.target_resolution || '1080p'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-slate-700">
              <span className="text-slate-400">Frame Rate</span>
              <span className="text-white font-medium">{stream.target_fps || 30} FPS</span>
            </div>
            {stream.low_latency_mode && (
              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400">Low Latency</span>
                <span className="text-green-400 font-medium">Enabled</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
