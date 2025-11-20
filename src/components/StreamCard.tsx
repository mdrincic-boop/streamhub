import { Stream } from '../lib/supabase';
import { Radio, Users, Clock, Play } from 'lucide-react';

interface StreamCardProps {
  stream: Stream;
  onPlay: (stream: Stream) => void;
}

export function StreamCard({ stream, onPlay }: StreamCardProps) {
  const isLive = stream.status === 'live';

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative aspect-video bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        {stream.thumbnail_url ? (
          <img src={stream.thumbnail_url} alt={stream.title} className="w-full h-full object-cover" />
        ) : (
          <div className="text-slate-600">
            <Radio size={48} />
          </div>
        )}
        {isLive && (
          <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            LIVE
          </div>
        )}
        {isLive && (
          <button
            onClick={() => onPlay(stream)}
            className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center group"
          >
            <div className="bg-white rounded-full p-4 group-hover:scale-110 transition-transform">
              <Play size={32} className="text-slate-900" fill="currentColor" />
            </div>
          </button>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-semibold text-lg text-slate-900 mb-1 truncate">
          {stream.title || stream.stream_name}
        </h3>
        <p className="text-sm text-slate-600 mb-3 truncate">{stream.stream_name}</p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-600">
              <Users size={16} />
              <span>{stream.viewer_count}</span>
            </div>
            {stream.started_at && (
              <div className="flex items-center gap-1.5 text-slate-600">
                <Clock size={16} />
                <span>{new Date(stream.started_at).toLocaleTimeString()}</span>
              </div>
            )}
          </div>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            isLive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {stream.status.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
