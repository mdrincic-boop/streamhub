import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Users, Activity, Settings, Database, AlertCircle, TrendingUp, Server } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SystemSettings {
  key: string;
  value: any;
  category: string;
  description: string;
}

interface ServerHealth {
  id: string;
  server_name: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_streams: number;
  total_viewers: number;
  bandwidth_mbps: number;
  status: string;
  created_at: string;
}

interface AdminLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: any;
  created_at: string;
}

export function AdminPanel() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'streams' | 'system' | 'health' | 'logs'>('health');
  const [users, setUsers] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings[]>([]);
  const [serverHealth, setServerHealth] = useState<ServerHealth[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, activeTab]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase.rpc('is_admin');
    setIsAdmin(data === true);
    setLoading(false);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'users':
          await loadUsers();
          break;
        case 'streams':
          await loadStreams();
          break;
        case 'system':
          await loadSystemSettings();
          break;
        case 'health':
          await loadServerHealth();
          break;
        case 'logs':
          await loadAdminLogs();
          break;
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const { data } = await supabase
      .from('streams')
      .select('created_by')
      .then(result => {
        const uniqueUsers = [...new Set(result.data?.map(s => s.created_by) || [])];
        return { data: uniqueUsers.map(id => ({ id })) };
      });
    setUsers(data || []);
  };

  const loadStreams = async () => {
    const { data } = await supabase
      .from('streams')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setStreams(data || []);
  };

  const loadSystemSettings = async () => {
    const { data } = await supabase
      .from('system_settings')
      .select('*')
      .order('category');
    setSystemSettings(data || []);
  };

  const loadServerHealth = async () => {
    const { data } = await supabase
      .from('server_health')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setServerHealth(data || []);
  };

  const loadAdminLogs = async () => {
    const { data } = await supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setAdminLogs(data || []);
  };

  const updateSystemSetting = async (key: string, newValue: string) => {
    await supabase
      .from('system_settings')
      .update({ value: newValue, updated_by: user?.id })
      .eq('key', key);

    await logAdminAction('update_system_setting', 'system_settings', key);
    loadSystemSettings();
  };

  const logAdminAction = async (action: string, targetType: string, targetId: string) => {
    await supabase
      .from('admin_logs')
      .insert({
        admin_id: user?.id,
        action,
        target_type: targetType,
        target_id: targetId,
        details: {},
      });
  };

  const deleteStream = async (streamId: string) => {
    if (!confirm('Are you sure you want to delete this stream?')) return;

    await supabase.from('streams').delete().eq('id', streamId);
    await logAdminAction('delete_stream', 'streams', streamId);
    loadStreams();
  };

  const checkAllStreams = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/stream-processor/check-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to check streams:', await response.text());
        alert('Failed to check streams. See console for details.');
      } else {
        const result = await response.json();
        alert(`Checked ${result.checked} streams successfully!`);
        loadStreams();
      }
    } catch (error) {
      console.error('Error checking streams:', error);
      alert('Error checking streams. See console for details.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-slate-600">You do not have permission to access the admin panel.</p>
        </div>
      </div>
    );
  }

  const latestHealth = serverHealth[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 mb-6">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab('health')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'health'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Activity size={20} />
              Server Health
            </button>
            <button
              onClick={() => setActiveTab('streams')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'streams'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp size={20} />
              Streams
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'system'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Settings size={20} />
              System Settings
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors border-b-2 ${
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Database size={20} />
              Audit Logs
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'health' && latestHealth && (
              <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-blue-600 font-medium">CPU Usage</p>
                        <p className="text-2xl font-bold text-blue-900">{latestHealth.cpu_usage}%</p>
                      </div>
                      <Server size={32} className="text-blue-600 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">Memory</p>
                        <p className="text-2xl font-bold text-green-900">{latestHealth.memory_usage}%</p>
                      </div>
                      <Database size={32} className="text-green-600 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-purple-600 font-medium">Active Streams</p>
                        <p className="text-2xl font-bold text-purple-900">{latestHealth.active_streams}</p>
                      </div>
                      <Activity size={32} className="text-purple-600 opacity-50" />
                    </div>
                  </div>

                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-orange-600 font-medium">Viewers</p>
                        <p className="text-2xl font-bold text-orange-900">{latestHealth.total_viewers}</p>
                      </div>
                      <Users size={32} className="text-orange-600 opacity-50" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 mb-3">Recent Health Metrics</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left p-3 text-slate-700 font-medium">Time</th>
                          <th className="text-left p-3 text-slate-700 font-medium">CPU</th>
                          <th className="text-left p-3 text-slate-700 font-medium">Memory</th>
                          <th className="text-left p-3 text-slate-700 font-medium">Streams</th>
                          <th className="text-left p-3 text-slate-700 font-medium">Viewers</th>
                          <th className="text-left p-3 text-slate-700 font-medium">Bandwidth</th>
                          <th className="text-left p-3 text-slate-700 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serverHealth.map((health) => (
                          <tr key={health.id} className="border-b border-slate-100">
                            <td className="p-3 text-slate-600">
                              {new Date(health.created_at).toLocaleString()}
                            </td>
                            <td className="p-3 text-slate-900">{health.cpu_usage}%</td>
                            <td className="p-3 text-slate-900">{health.memory_usage}%</td>
                            <td className="p-3 text-slate-900">{health.active_streams}</td>
                            <td className="p-3 text-slate-900">{health.total_viewers}</td>
                            <td className="p-3 text-slate-900">{health.bandwidth_mbps} Mbps</td>
                            <td className="p-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                health.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {health.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'streams' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">All Streams</h3>
                  <button
                    onClick={checkAllStreams}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    Check All RTSP Streams
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left p-3 text-slate-700 font-medium">Name</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Title</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Type</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Status</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Last Check</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Viewers</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Created</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {streams.map((stream) => (
                        <tr key={stream.id} className="border-b border-slate-100">
                          <td className="p-3 text-slate-900 font-medium">{stream.stream_name}</td>
                          <td className="p-3 text-slate-600">{stream.title || '-'}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {stream.input_type || 'rtmp'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              stream.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {stream.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 text-xs">
                            {stream.last_checked_at
                              ? new Date(stream.last_checked_at).toLocaleString()
                              : 'Never'}
                          </td>
                          <td className="p-3 text-slate-900">{stream.viewer_count || 0}</td>
                          <td className="p-3 text-slate-600">
                            {new Date(stream.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => deleteStream(stream.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'system' && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">System Configuration</h3>
                <div className="space-y-4">
                  {systemSettings.map((setting) => (
                    <div key={setting.key} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-900">{setting.key}</h4>
                          <p className="text-sm text-slate-600 mt-1">{setting.description}</p>
                          <p className="text-xs text-slate-500 mt-1">Category: {setting.category}</p>
                        </div>
                        <input
                          type="text"
                          defaultValue={String(setting.value)}
                          onBlur={(e) => updateSystemSetting(setting.key, e.target.value)}
                          className="ml-4 px-3 py-1 border border-slate-300 rounded text-sm w-32"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'logs' && (
              <div>
                <h3 className="font-semibold text-slate-900 mb-3">Admin Activity Logs</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-left p-3 text-slate-700 font-medium">Time</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Action</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Target</th>
                        <th className="text-left p-3 text-slate-700 font-medium">Admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminLogs.map((log) => (
                        <tr key={log.id} className="border-b border-slate-100">
                          <td className="p-3 text-slate-600">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 text-slate-900 font-medium">{log.action}</td>
                          <td className="p-3 text-slate-600">
                            {log.target_type}: {log.target_id}
                          </td>
                          <td className="p-3 text-slate-600">{log.admin_id.slice(0, 8)}...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
