import { useState, useEffect } from 'react';
import { X, Settings, Zap, HardDrive, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StreamSettingsModalProps {
  streamId: string;
  onClose: () => void;
  onSave: () => void;
}

interface StreamSettings {
  bitrate_preset: string;
  custom_bitrate: number | null;
  resolution: string;
  fps: number;
  adaptive_bitrate: boolean;
  keyframe_interval: number;
  encoding_preset: string;
  audio_bitrate: number;
  dvr_enabled: boolean;
  dvr_window_seconds: number;
}

const BITRATE_PRESETS = {
  low: 1500,
  medium: 3000,
  high: 5000,
  ultra: 8000,
};

const RESOLUTIONS = ['480p', '720p', '1080p', '1440p', '4K'];
const FPS_OPTIONS = [24, 30, 60];
const ENCODING_PRESETS = ['ultrafast', 'veryfast', 'fast', 'medium', 'slow'];

export function StreamSettingsModal({ streamId, onClose, onSave }: StreamSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<StreamSettings>({
    bitrate_preset: 'medium',
    custom_bitrate: null,
    resolution: '1080p',
    fps: 30,
    adaptive_bitrate: false,
    keyframe_interval: 2,
    encoding_preset: 'veryfast',
    audio_bitrate: 128,
    dvr_enabled: false,
    dvr_window_seconds: 3600,
  });

  useEffect(() => {
    loadSettings();
  }, [streamId]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('stream_settings')
        .select('*')
        .eq('stream_id', streamId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          bitrate_preset: data.bitrate_preset,
          custom_bitrate: data.custom_bitrate,
          resolution: data.resolution,
          fps: data.fps,
          adaptive_bitrate: data.adaptive_bitrate,
          keyframe_interval: data.keyframe_interval,
          encoding_preset: data.encoding_preset,
          audio_bitrate: data.audio_bitrate,
          dvr_enabled: data.dvr_enabled,
          dvr_window_seconds: data.dvr_window_seconds,
        });
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: existing } = await supabase
        .from('stream_settings')
        .select('id')
        .eq('stream_id', streamId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('stream_settings')
          .update({
            ...settings,
            updated_at: new Date().toISOString(),
          })
          .eq('stream_id', streamId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('stream_settings')
          .insert({
            stream_id: streamId,
            ...settings,
          });

        if (error) throw error;
      }

      await supabase
        .from('streams')
        .update({
          max_bitrate: settings.custom_bitrate || BITRATE_PRESETS[settings.bitrate_preset as keyof typeof BITRATE_PRESETS],
          target_resolution: settings.resolution,
          target_fps: settings.fps,
          dvr_enabled: settings.dvr_enabled,
          dvr_window: settings.dvr_window_seconds,
          transcoding_enabled: settings.adaptive_bitrate,
        })
        .eq('id', streamId);

      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = <K extends keyof StreamSettings>(key: K, value: StreamSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const currentBitrate = settings.custom_bitrate ||
    BITRATE_PRESETS[settings.bitrate_preset as keyof typeof BITRATE_PRESETS];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <Settings size={24} className="text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Stream Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-blue-600" />
              <h3 className="font-semibold text-slate-900">Quality Settings</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Bitrate Preset
                </label>
                <select
                  value={settings.bitrate_preset}
                  onChange={(e) => updateSetting('bitrate_preset', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="low">Low (1.5 Mbps)</option>
                  <option value="medium">Medium (3 Mbps)</option>
                  <option value="high">High (5 Mbps)</option>
                  <option value="ultra">Ultra (8 Mbps)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Bitrate (kbps)
                </label>
                <input
                  type="number"
                  value={settings.custom_bitrate || ''}
                  onChange={(e) => updateSetting('custom_bitrate', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder={`Default: ${BITRATE_PRESETS[settings.bitrate_preset as keyof typeof BITRATE_PRESETS]}`}
                  min="500"
                  max="15000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Resolution
                </label>
                <select
                  value={settings.resolution}
                  onChange={(e) => updateSetting('resolution', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {RESOLUTIONS.map(res => (
                    <option key={res} value={res}>{res}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Frame Rate (FPS)
                </label>
                <select
                  value={settings.fps}
                  onChange={(e) => updateSetting('fps', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {FPS_OPTIONS.map(fps => (
                    <option key={fps} value={fps}>{fps} fps</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Current Bitrate:</span> {currentBitrate} kbps | {settings.resolution} @ {settings.fps} fps
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900">Advanced Options</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Encoding Preset
                </label>
                <select
                  value={settings.encoding_preset}
                  onChange={(e) => updateSetting('encoding_preset', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {ENCODING_PRESETS.map(preset => (
                    <option key={preset} value={preset}>
                      {preset.charAt(0).toUpperCase() + preset.slice(1)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Faster = lower CPU, lower quality
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Keyframe Interval (seconds)
                </label>
                <input
                  type="number"
                  value={settings.keyframe_interval}
                  onChange={(e) => updateSetting('keyframe_interval', parseInt(e.target.value))}
                  min="1"
                  max="10"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Audio Bitrate (kbps)
                </label>
                <select
                  value={settings.audio_bitrate}
                  onChange={(e) => updateSetting('audio_bitrate', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="64">64 kbps</option>
                  <option value="96">96 kbps</option>
                  <option value="128">128 kbps</option>
                  <option value="192">192 kbps</option>
                  <option value="256">256 kbps</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="adaptive"
                checked={settings.adaptive_bitrate}
                onChange={(e) => updateSetting('adaptive_bitrate', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="adaptive" className="text-sm font-medium text-slate-700">
                Enable Adaptive Bitrate (Multi-quality transcoding)
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-blue-600" />
              <h3 className="font-semibold text-slate-900">DVR / Time-shift</h3>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dvr"
                checked={settings.dvr_enabled}
                onChange={(e) => updateSetting('dvr_enabled', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="dvr" className="text-sm font-medium text-slate-700">
                Enable DVR (Allow viewers to rewind live stream)
              </label>
            </div>

            {settings.dvr_enabled && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  DVR Window (seconds)
                </label>
                <input
                  type="number"
                  value={settings.dvr_window_seconds}
                  onChange={(e) => updateSetting('dvr_window_seconds', parseInt(e.target.value))}
                  min="300"
                  max="7200"
                  step="300"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  {Math.floor(settings.dvr_window_seconds / 60)} minutes of rewind buffer
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
