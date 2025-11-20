import { Stream } from '../lib/supabase';
import { X, Copy, Check, Key, Radio, Video } from 'lucide-react';
import { useState } from 'react';
import { getRTMPUrl, getPublicRTMPUrl } from '../config/environment';

interface StreamDetailsModalProps {
  stream: Stream;
  onClose: () => void;
}

export function StreamDetailsModal({ stream, onClose }: StreamDetailsModalProps) {
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedRTMP, setCopiedRTMP] = useState(false);

  const rtmpUrl = getPublicRTMPUrl();
  const streamKey = stream.stream_key;

  const copyToClipboard = async (text: string, type: 'key' | 'rtmp') => {
    await navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedRTMP(true);
      setTimeout(() => setCopiedRTMP(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Stream Configuration</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Radio size={20} className="text-blue-600" />
              Stream Information
            </h3>
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div>
                <span className="text-sm text-slate-600">Name:</span>
                <p className="font-medium text-slate-900">{stream.stream_name}</p>
              </div>
              <div>
                <span className="text-sm text-slate-600">Title:</span>
                <p className="font-medium text-slate-900">{stream.title || 'No title set'}</p>
              </div>
              <div>
                <span className="text-sm text-slate-600">Status:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs font-medium ${
                  stream.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {stream.status.toUpperCase()}
                </span>
              </div>
              <div>
                <span className="text-sm text-slate-600">Visibility:</span>
                <p className="font-medium text-slate-900">{stream.is_public ? 'Public' : 'Private'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
              <Video size={20} className="text-blue-600" />
              Publishing Configuration
            </h3>
            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">RTMP Server URL</label>
                  <button
                    onClick={() => copyToClipboard(rtmpUrl, 'rtmp')}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {copiedRTMP ? <Check size={16} /> : <Copy size={16} />}
                    {copiedRTMP ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <code className="block bg-white px-3 py-2 rounded border border-slate-200 text-sm text-slate-900 font-mono break-all">
                  {rtmpUrl}
                </code>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                    <Key size={16} />
                    Stream Key (Keep Secret!)
                  </label>
                  <button
                    onClick={() => copyToClipboard(streamKey, 'key')}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    {copiedKey ? <Check size={16} /> : <Copy size={16} />}
                    {copiedKey ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <code className="block bg-white px-3 py-2 rounded border border-slate-200 text-sm text-slate-900 font-mono break-all">
                  {streamKey}
                </code>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">OBS Studio Setup</h4>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Open OBS Studio</li>
              <li>Go to Settings → Stream</li>
              <li>Select "Custom" as Service</li>
              <li>Paste the RTMP Server URL</li>
              <li>Paste the Stream Key</li>
              <li>Click "Start Streaming"</li>
            </ol>
          </div>

          {stream.status === 'live' && stream.hls_url && (
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Playback URL</h3>
              <div className="bg-slate-50 rounded-lg p-4">
                <code className="block bg-white px-3 py-2 rounded border border-slate-200 text-sm text-slate-900 font-mono break-all">
                  {stream.hls_url}
                </code>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
