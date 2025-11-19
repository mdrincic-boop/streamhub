import { useState } from 'react';
import { X, Copy, Check, Code, Share2, Camera as CameraIcon } from 'lucide-react';
import { Stream } from '../lib/supabase';

interface EmbedModalProps {
  stream: Stream;
  onClose: () => void;
}

interface EmbedOptions {
  width: string;
  height: string;
  autoplay: boolean;
  muted: boolean;
  controls: boolean;
  allowFullscreen: boolean;
  skin: 'default' | 'minimal';
}

export function EmbedModal({ stream, onClose }: EmbedModalProps) {
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);

  const [options, setOptions] = useState<EmbedOptions>({
    width: '800',
    height: '450',
    autoplay: false,
    muted: false,
    controls: true,
    allowFullscreen: true,
    skin: 'default',
  });

  const baseUrl = window.location.origin;
  const publicUrl = `${baseUrl}/watch/${stream.id}`;
  const embedUrl = `${baseUrl}/embed/${stream.id}`;
  const snapshotUrl = `${baseUrl}/snapshot/${stream.id}`;

  const generateEmbedCode = () => {
    const params = new URLSearchParams();
    if (options.autoplay) params.append('autoplay', '1');
    if (options.muted) params.append('muted', '1');
    if (!options.controls) params.append('controls', '0');
    if (options.skin !== 'default') params.append('skin', options.skin);

    const queryString = params.toString();
    const url = queryString ? `${embedUrl}?${queryString}` : embedUrl;

    return `<iframe src="${url}" width="${options.width}" height="${options.height}" frameborder="0" ${
      options.allowFullscreen ? 'allowfullscreen' : ''
    }></iframe>`;
  };

  const embedCode = generateEmbedCode();

  const copyToClipboard = async (text: string, type: 'embed' | 'url' | 'snapshot') => {
    await navigator.clipboard.writeText(text);

    if (type === 'embed') {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    } else if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedSnapshot(true);
      setTimeout(() => setCopiedSnapshot(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <Share2 size={24} className="text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Share & Embed</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Share2 size={20} className="text-blue-600" />
              Public Camera Page
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              Share the live video of the camera with a simple link:
            </p>
            <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between gap-3">
              <code className="text-sm text-blue-600 font-mono break-all flex-1">
                {publicUrl}
              </code>
              <button
                onClick={() => copyToClipboard(publicUrl, 'url')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
              >
                {copiedUrl ? <Check size={16} /> : <Copy size={16} />}
                {copiedUrl ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Code size={20} className="text-blue-600" />
              Embedded Live Video
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Snippet below shows you how easily to embed live video of your IP camera into your web page:
            </p>

            <div className="bg-slate-900 rounded-lg p-4 mb-4 relative">
              <code className="text-sm text-green-400 font-mono whitespace-pre-wrap break-all block">
                {embedCode}
              </code>
              <button
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className="absolute top-3 right-3 flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                {copiedEmbed ? <Check size={16} /> : <Copy size={16} />}
                {copiedEmbed ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              Don't forget to adjust the height of the IFRAME according to the ASPECT RATIO of your camera!
            </p>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={options.width}
                    onChange={(e) => setOptions({ ...options, width: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={options.height}
                    onChange={(e) => setOptions({ ...options, height: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Player Skin
                  </label>
                  <select
                    value={options.skin}
                    onChange={(e) => setOptions({ ...options, skin: e.target.value as 'default' | 'minimal' })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="default">Default</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="autoplay"
                    checked={options.autoplay}
                    onChange={(e) => setOptions({ ...options, autoplay: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="autoplay" className="text-sm text-slate-700">
                    Start video automatically
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="muted"
                    checked={options.muted}
                    onChange={(e) => setOptions({ ...options, muted: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="muted" className="text-sm text-slate-700">
                    Mute the audio channel
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="controls"
                    checked={options.controls}
                    onChange={(e) => setOptions({ ...options, controls: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="controls" className="text-sm text-slate-700">
                    Show player controls
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allowFullscreen"
                    checked={options.allowFullscreen}
                    onChange={(e) => setOptions({ ...options, allowFullscreen: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label htmlFor="allowFullscreen" className="text-sm text-slate-700">
                    Allow fullscreen
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <CameraIcon size={20} className="text-blue-600" />
              Snapshot Image
            </h3>
            <p className="text-sm text-slate-600 mb-3">
              You can access the snapshot image captured from the live stream on the following URL:
            </p>
            <div className="bg-slate-50 rounded-lg p-4 flex items-center justify-between gap-3">
              <code className="text-sm text-blue-600 font-mono break-all flex-1">
                {snapshotUrl}
              </code>
              <button
                onClick={() => copyToClipboard(snapshotUrl, 'snapshot')}
                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
              >
                {copiedSnapshot ? <Check size={16} /> : <Copy size={16} />}
                {copiedSnapshot ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Use this URL to display a still image from your stream in websites, emails, or applications
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Preview</h4>
            <div className="bg-slate-900 rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                {stream.status === 'live' ? (
                  <div className="text-center">
                    <div className="text-green-400 mb-2">● LIVE</div>
                    <p className="text-sm">{stream.stream_name}</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-slate-500 mb-2">○ OFFLINE</div>
                    <p className="text-sm">Stream not live</p>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-blue-800 mt-3">
              <strong>Dimensions:</strong> {options.width}px × {options.height}px
              <br />
              <strong>Aspect Ratio:</strong> {(parseInt(options.width) / parseInt(options.height)).toFixed(2)}:1
              {parseInt(options.width) / parseInt(options.height) === 16/9 && ' (16:9 - Standard)'}
            </p>
          </div>
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
