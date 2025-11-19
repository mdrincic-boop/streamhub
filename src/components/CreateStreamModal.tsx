import { useState } from 'react';
import { X, AlertCircle, Radio, Camera } from 'lucide-react';
import { validateStreamName, validateTitle, sanitizeInput, ValidationError } from '../lib/validation';

interface CreateStreamModalProps {
  onClose: () => void;
  onCreate: (streamName: string, title: string, isPublic: boolean, inputType: 'rtmp' | 'rtsp', rtspConfig?: RTSPConfig) => Promise<void>;
}

interface RTSPConfig {
  rtspUrl: string;
  username?: string;
  password?: string;
  autoReconnect: boolean;
}

export function CreateStreamModal({ onClose, onCreate }: CreateStreamModalProps) {
  const [streamName, setStreamName] = useState('');
  const [title, setTitle] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [inputType, setInputType] = useState<'rtmp' | 'rtsp'>('rtmp');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rtspUrl, setRtspUrl] = useState('');
  const [rtspUsername, setRtspUsername] = useState('');
  const [rtspPassword, setRtspPassword] = useState('');
  const [autoReconnect, setAutoReconnect] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const sanitizedStreamName = sanitizeInput(streamName);
      const sanitizedTitle = sanitizeInput(title);

      validateStreamName(sanitizedStreamName);
      validateTitle(sanitizedTitle);

      if (inputType === 'rtsp') {
        if (!rtspUrl) {
          throw new ValidationError('RTSP URL is required for IP camera streams');
        }
        if (!rtspUrl.startsWith('rtsp://')) {
          throw new ValidationError('RTSP URL must start with rtsp://');
        }
      }

      const rtspConfig = inputType === 'rtsp' ? {
        rtspUrl,
        username: rtspUsername || undefined,
        password: rtspPassword || undefined,
        autoReconnect,
      } : undefined;

      await onCreate(sanitizedStreamName, sanitizedTitle, isPublic, inputType, rtspConfig);
      onClose();
    } catch (error) {
      if (error instanceof ValidationError) {
        setError(error.message);
      } else {
        setError('Failed to create stream. Please try again.');
        console.error('Error creating stream:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-slate-900">Create New Stream</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Stream Source Type *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setInputType('rtmp')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  inputType === 'rtmp'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Radio size={24} className={inputType === 'rtmp' ? 'text-blue-600' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">RTMP</div>
                    <div className="text-xs text-slate-600">OBS, Encoder</div>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setInputType('rtsp')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  inputType === 'rtsp'
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Camera size={24} className={inputType === 'rtsp' ? 'text-blue-600' : 'text-slate-400'} />
                  <div className="text-left">
                    <div className="font-semibold text-slate-900">RTSP</div>
                    <div className="text-xs text-slate-600">IP Camera</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="streamName" className="block text-sm font-medium text-slate-700 mb-1">
              Stream Name *
            </label>
            <input
              type="text"
              id="streamName"
              value={streamName}
              onChange={(e) => setStreamName(e.target.value)}
              placeholder="my-awesome-stream"
              required
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
            />
            <p className="text-xs text-slate-500 mt-1">Used in stream URL (no spaces)</p>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-slate-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Awesome Live Stream"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
            />
            <p className="text-xs text-slate-500 mt-1">Display title for viewers</p>
          </div>

          {inputType === 'rtsp' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                <Camera size={18} />
                IP Camera Configuration
              </h3>

              <div>
                <label htmlFor="rtspUrl" className="block text-sm font-medium text-slate-700 mb-1">
                  RTSP URL *
                </label>
                <input
                  type="text"
                  id="rtspUrl"
                  value={rtspUrl}
                  onChange={(e) => setRtspUrl(e.target.value)}
                  placeholder="rtsp://192.168.1.100:554/stream1"
                  required={inputType === 'rtsp'}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow font-mono text-sm"
                />
                <p className="text-xs text-slate-600 mt-1">
                  Example: rtsp://192.168.1.100:554/stream1
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rtspUsername" className="block text-sm font-medium text-slate-700 mb-1">
                    Username (optional)
                  </label>
                  <input
                    type="text"
                    id="rtspUsername"
                    value={rtspUsername}
                    onChange={(e) => setRtspUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                  />
                </div>

                <div>
                  <label htmlFor="rtspPassword" className="block text-sm font-medium text-slate-700 mb-1">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    id="rtspPassword"
                    value={rtspPassword}
                    onChange={(e) => setRtspPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoReconnect"
                  checked={autoReconnect}
                  onChange={(e) => setAutoReconnect(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="autoReconnect" className="text-sm font-medium text-slate-700">
                  Auto-reconnect if connection is lost
                </label>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isPublic"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="isPublic" className="text-sm font-medium text-slate-700">
              Public stream (visible to everyone)
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !streamName || (inputType === 'rtsp' && !rtspUrl)}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Creating...' : 'Create Stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
