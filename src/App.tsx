import { useState, useEffect } from 'react';
import { supabase, Stream } from './lib/supabase';
import { StreamCard } from './components/StreamCard';
import { CreateStreamModal } from './components/CreateStreamModal';
import { StreamDetailsModal } from './components/StreamDetailsModal';
import { VideoPlayer } from './components/VideoPlayer';
import { AuthModal } from './components/AuthModal';
import { useAuth } from './contexts/AuthContext';
import { Plus, Radio, Activity, Users, LogOut, User } from 'lucide-react';

function App() {
  const { user, signOut, loading: authLoading } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);
  const [playingStream, setPlayingStream] = useState<Stream | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStreams();

    const subscription = supabase
      .channel('streams-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'streams' }, () => {
        loadStreams();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadStreams = async () => {
    try {
      const { data, error } = await supabase
        .from('streams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStreams(data || []);
    } catch (error) {
      console.error('Error loading streams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStream = async (
    streamName: string,
    title: string,
    description: string,
    isPublic: boolean,
    inputType: 'rtmp' | 'rtsp' = 'rtmp',
    rtspConfig?: {
      rtspUrl: string;
      username?: string;
      password?: string;
    }
  ) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      const streamData: any = {
        stream_name: streamName,
        title: title,
        description: description,
        is_public: isPublic,
        created_by: user.id,
        input_type: inputType,
      };

      if (inputType === 'rtsp' && rtspConfig) {
        streamData.rtsp_url = rtspConfig.rtspUrl;
        streamData.rtsp_username = rtspConfig.username;
        streamData.rtsp_password = rtspConfig.password;
      }

      const { data, error } = await supabase
        .from('streams')
        .insert(streamData)
        .select()
        .single();

      if (error) throw error;

      setStreams([data, ...streams]);
      setSelectedStream(data);
    } catch (error) {
      console.error('Error creating stream:', error);
      alert('Error creating stream. Please try again.');
    }
  };

  const liveStreams = streams.filter(s => s.status === 'live');
  const totalViewers = streams.reduce((acc, s) => acc + s.viewer_count, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-2.5 rounded-lg">
                <Radio className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">StreamHub</h1>
                <p className="text-sm text-slate-600">Professional Live Streaming Platform</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                  >
                    <Plus size={20} />
                    Create Stream
                  </button>
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                    <User size={18} className="text-slate-600" />
                    <span className="text-sm text-slate-700 max-w-[150px] truncate">{user.email}</span>
                  </div>
                  <button
                    onClick={() => signOut()}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Sign Out"
                  >
                    <LogOut size={20} />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                  <User size={20} />
                  Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Streams</p>
                <p className="text-3xl font-bold text-slate-900">{streams.length}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Radio className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Live Now</p>
                <p className="text-3xl font-bold text-slate-900">{liveStreams.length}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <Activity className="text-red-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Viewers</p>
                <p className="text-3xl font-bold text-slate-900">{totalViewers}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="text-green-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : streams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center border border-slate-200">
            <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Radio className="text-slate-400" size={32} />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No Streams Yet</h3>
            <p className="text-slate-600 mb-6">Create your first stream to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus size={20} />
              Create Your First Stream
            </button>
          </div>
        ) : (
          <>
            {liveStreams.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="text-red-600" size={24} />
                  <h2 className="text-xl font-bold text-slate-900">Live Now</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {liveStreams.map(stream => (
                    <StreamCard
                      key={stream.id}
                      stream={stream}
                      onPlay={setPlayingStream}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">All Streams</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {streams.map(stream => (
                  <div key={stream.id} onClick={() => setSelectedStream(stream)} className="cursor-pointer">
                    <StreamCard
                      stream={stream}
                      onPlay={setPlayingStream}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            setShowCreateModal(true);
          }}
        />
      )}

      {showCreateModal && (
        <CreateStreamModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateStream}
        />
      )}

      {selectedStream && (
        <StreamDetailsModal
          stream={selectedStream}
          onClose={() => setSelectedStream(null)}
        />
      )}

      {playingStream && (
        <VideoPlayer
          stream={playingStream}
          onClose={() => setPlayingStream(null)}
        />
      )}
    </div>
  );
}

export default App;
