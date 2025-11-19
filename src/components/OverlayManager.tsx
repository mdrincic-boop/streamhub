import { useState, useEffect } from 'react';
import { X, Plus, Upload, Eye, EyeOff, Trash2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OverlayManagerProps {
  streamId: string;
  onClose: () => void;
}

interface Overlay {
  id: string;
  name: string;
  image_url: string;
  position: string;
  custom_x: number | null;
  custom_y: number | null;
  size_mode: string;
  width_percentage: number;
  height_percentage: number;
  width_pixels: number | null;
  height_pixels: number | null;
  opacity: number;
  enabled: boolean;
  layer_order: number;
}

const POSITIONS = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-center', label: 'Top Center' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'center-left', label: 'Center Left' },
  { value: 'center', label: 'Center' },
  { value: 'center-right', label: 'Center Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-center', label: 'Bottom Center' },
  { value: 'bottom-right', label: 'Bottom Right' },
  { value: 'custom', label: 'Custom Position' },
];

export function OverlayManager({ streamId, onClose }: OverlayManagerProps) {
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newOverlay, setNewOverlay] = useState({
    name: '',
    image_url: '',
    position: 'top-right',
    custom_x: null as number | null,
    custom_y: null as number | null,
    size_mode: 'percentage',
    width_percentage: 15,
    height_percentage: 15,
    width_pixels: null as number | null,
    height_pixels: null as number | null,
    opacity: 100,
  });

  useEffect(() => {
    loadOverlays();
  }, [streamId]);

  const loadOverlays = async () => {
    try {
      const { data, error } = await supabase
        .from('stream_overlays')
        .select('*')
        .eq('stream_id', streamId)
        .order('layer_order');

      if (error) throw error;
      setOverlays(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (PNG, JPG, etc.)');
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const imageUrl = URL.createObjectURL(file);
      setNewOverlay(prev => ({ ...prev, image_url: imageUrl, name: prev.name || file.name }));
    } catch (err: any) {
      setError(err.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddOverlay = async () => {
    if (!newOverlay.name || !newOverlay.image_url) {
      setError('Please provide a name and upload an image');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('stream_overlays')
        .insert({
          stream_id: streamId,
          ...newOverlay,
          layer_order: overlays.length + 1,
        })
        .select()
        .single();

      if (error) throw error;

      setOverlays([...overlays, data]);
      setShowAddForm(false);
      setNewOverlay({
        name: '',
        image_url: '',
        position: 'top-right',
        custom_x: null,
        custom_y: null,
        size_mode: 'percentage',
        width_percentage: 15,
        height_percentage: 15,
        width_pixels: null,
        height_pixels: null,
        opacity: 100,
      });

      await supabase
        .from('streams')
        .update({ overlay_enabled: true })
        .eq('id', streamId);
    } catch (err: any) {
      setError(err.message || 'Failed to add overlay');
    } finally {
      setLoading(false);
    }
  };

  const toggleOverlay = async (overlayId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('stream_overlays')
        .update({ enabled: !enabled })
        .eq('id', overlayId);

      if (error) throw error;

      setOverlays(overlays.map(o =>
        o.id === overlayId ? { ...o, enabled: !enabled } : o
      ));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteOverlay = async (overlayId: string) => {
    if (!confirm('Are you sure you want to delete this overlay?')) return;

    try {
      const { error } = await supabase
        .from('stream_overlays')
        .delete()
        .eq('id', overlayId);

      if (error) throw error;

      setOverlays(overlays.filter(o => o.id !== overlayId));

      if (overlays.length === 1) {
        await supabase
          .from('streams')
          .update({ overlay_enabled: false })
          .eq('id', streamId);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateOverlay = async (overlayId: string, updates: Partial<Overlay>) => {
    try {
      const { error } = await supabase
        .from('stream_overlays')
        .update(updates)
        .eq('id', overlayId);

      if (error) throw error;

      setOverlays(overlays.map(o =>
        o.id === overlayId ? { ...o, ...updates } : o
      ));
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <ImageIcon size={24} className="text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Stream Overlays</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 mb-4">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mb-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Add Overlay
            </button>
          )}

          {showAddForm && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-slate-900 mb-4">New Overlay</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Overlay Name
                  </label>
                  <input
                    type="text"
                    value={newOverlay.name}
                    onChange={(e) => setNewOverlay({ ...newOverlay, name: e.target.value })}
                    placeholder="Logo, Watermark, etc."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Upload Image (PNG recommended)
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                      <Upload size={20} className="text-slate-600" />
                      <span className="text-sm text-slate-700">
                        {uploadingImage ? 'Uploading...' : 'Choose File'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                    {newOverlay.image_url && (
                      <span className="text-sm text-green-600">✓ Image uploaded</span>
                    )}
                  </div>
                  {newOverlay.image_url && (
                    <img
                      src={newOverlay.image_url}
                      alt="Preview"
                      className="mt-2 h-20 object-contain bg-slate-100 rounded border border-slate-300"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Position
                    </label>
                    <select
                      value={newOverlay.position}
                      onChange={(e) => setNewOverlay({ ...newOverlay, position: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      {POSITIONS.map(pos => (
                        <option key={pos.value} value={pos.value}>{pos.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Size Mode
                    </label>
                    <select
                      value={newOverlay.size_mode}
                      onChange={(e) => setNewOverlay({ ...newOverlay, size_mode: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    >
                      <option value="percentage">Percentage</option>
                      <option value="pixels">Pixels</option>
                    </select>
                  </div>
                </div>

                {newOverlay.position === 'custom' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        X Position (pixels)
                      </label>
                      <input
                        type="number"
                        value={newOverlay.custom_x || ''}
                        onChange={(e) => setNewOverlay({ ...newOverlay, custom_x: parseInt(e.target.value) || null })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Y Position (pixels)
                      </label>
                      <input
                        type="number"
                        value={newOverlay.custom_y || ''}
                        onChange={(e) => setNewOverlay({ ...newOverlay, custom_y: parseInt(e.target.value) || null })}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                )}

                {newOverlay.size_mode === 'percentage' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Width (%)
                      </label>
                      <input
                        type="number"
                        value={newOverlay.width_percentage}
                        onChange={(e) => setNewOverlay({ ...newOverlay, width_percentage: parseInt(e.target.value) })}
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Height (%)
                      </label>
                      <input
                        type="number"
                        value={newOverlay.height_percentage}
                        onChange={(e) => setNewOverlay({ ...newOverlay, height_percentage: parseInt(e.target.value) })}
                        min="1"
                        max="100"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        value={newOverlay.width_pixels || ''}
                        onChange={(e) => setNewOverlay({ ...newOverlay, width_pixels: parseInt(e.target.value) || null })}
                        placeholder="200"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        value={newOverlay.height_pixels || ''}
                        onChange={(e) => setNewOverlay({ ...newOverlay, height_pixels: parseInt(e.target.value) || null })}
                        placeholder="200"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Opacity ({newOverlay.opacity}%)
                  </label>
                  <input
                    type="range"
                    value={newOverlay.opacity}
                    onChange={(e) => setNewOverlay({ ...newOverlay, opacity: parseInt(e.target.value) })}
                    min="0"
                    max="100"
                    className="w-full"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleAddOverlay}
                    disabled={!newOverlay.name || !newOverlay.image_url || loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Add Overlay
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {overlays.length === 0 && !showAddForm ? (
              <div className="text-center py-8 text-slate-500">
                No overlays added yet. Click "Add Overlay" to get started.
              </div>
            ) : (
              overlays.map((overlay) => (
                <div key={overlay.id} className="bg-white border border-slate-200 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={overlay.image_url}
                      alt={overlay.name}
                      className="w-20 h-20 object-contain bg-slate-100 rounded border border-slate-300"
                    />

                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900">{overlay.name}</h4>
                      <div className="text-sm text-slate-600 mt-1">
                        <p>Position: {POSITIONS.find(p => p.value === overlay.position)?.label}</p>
                        <p>
                          Size: {overlay.size_mode === 'percentage'
                            ? `${overlay.width_percentage}% x ${overlay.height_percentage}%`
                            : `${overlay.width_pixels}px x ${overlay.height_pixels}px`
                          }
                        </p>
                        <p>Opacity: {overlay.opacity}%</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleOverlay(overlay.id, overlay.enabled)}
                        className={`p-2 rounded-lg transition-colors ${
                          overlay.enabled
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-slate-400 hover:bg-slate-100'
                        }`}
                        title={overlay.enabled ? 'Disable' : 'Enable'}
                      >
                        {overlay.enabled ? <Eye size={20} /> : <EyeOff size={20} />}
                      </button>
                      <button
                        onClick={() => deleteOverlay(overlay.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
