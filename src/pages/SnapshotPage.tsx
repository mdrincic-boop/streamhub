import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Stream, supabase } from '../lib/supabase';
import { Camera, AlertCircle } from 'lucide-react';

export function SnapshotPage() {
  const { streamId } = useParams<{ streamId: string }>();
  const [stream, setStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);

  useEffect(() => {
    loadStreamAndSnapshot();
  }, [streamId]);

  const loadStreamAndSnapshot = async () => {
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

        if (data.status === 'live' && data.hls_url) {
          const hlsBaseUrl = data.hls_url.replace('/index.m3u8', '');
          setSnapshotUrl(`${hlsBaseUrl}/snapshot.jpg`);
        } else {
          const placeholderUrl = await generatePlaceholder(data.stream_name);
          setSnapshotUrl(placeholderUrl);
        }
      }
    } catch (err) {
      console.error('Error loading snapshot:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePlaceholder = async (streamName: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      gradient.addColorStop(0, '#1e293b');
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#475569';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Stream Offline', canvas.width / 2, canvas.height / 2 - 50);

      ctx.fillStyle = '#64748b';
      ctx.font = '48px sans-serif';
      ctx.fillText(streamName, canvas.width / 2, canvas.height / 2 + 50);

      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 200, 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 200, 60, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 200, 30, 0, Math.PI * 2);
      ctx.fill();
    }

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  useEffect(() => {
    if (stream?.status === 'live') {
      const interval = setInterval(() => {
        loadStreamAndSnapshot();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [stream?.status]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading snapshot...</p>
        </div>
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle size={64} className="text-red-500 mx-auto mb-4" />
          <p className="text-xl text-slate-400">Stream not found</p>
        </div>
      </div>
    );
  }

  if (!snapshotUrl) {
    return (
      <div className="w-full h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Camera size={64} className="text-slate-600 mx-auto mb-4" />
          <p className="text-xl text-slate-400">No snapshot available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <img
        src={snapshotUrl}
        alt={`${stream.stream_name} snapshot`}
        className="max-w-full max-h-full object-contain"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          generatePlaceholder(stream.stream_name).then(url => {
            target.src = url;
          });
        }}
      />
      {stream.status === 'live' && (
        <div className="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          <span className="font-semibold">LIVE</span>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/70 text-white px-4 py-2 rounded-lg backdrop-blur-sm">
        <p className="font-semibold">{stream.stream_name}</p>
        <p className="text-sm text-slate-300">
          {stream.status === 'live' ? 'Auto-refreshing every 5s' : 'Stream offline'}
        </p>
      </div>
    </div>
  );
}
