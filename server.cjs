const NodeMediaServer = require('node-media-server');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const { spawn } = require('child_process');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rtmpPort = parseInt(process.env.VITE_RTMP_PORT || '1935');
const httpPort = parseInt(process.env.VITE_HTTP_PORT || '8000');
const httpHost = process.env.VITE_HTTP_HOST || 'localhost';
const isProduction = process.env.NODE_ENV === 'production';

const rtspProcesses = new Map();
const activeRTSPStreams = new Map();

const config = {
  rtmp: {
    port: rtmpPort,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: httpPort,
    allow_origin: '*',
    mediaroot: './media'
  },
  trans: {
    ffmpeg: process.env.FFMPEG_PATH || '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',
        dash: false
      }
    ]
  },
  logType: isProduction ? 2 : 3
};

const nms = new NodeMediaServer(config);

async function startRTSPPull(stream) {
  const streamKey = stream.stream_key;

  if (rtspProcesses.has(streamKey)) {
    console.log(`[RTSP] Stream ${stream.stream_name} already pulling`);
    return;
  }

  let rtspUrl = stream.rtsp_url;

  if (stream.rtsp_username && stream.rtsp_password) {
    const urlParts = rtspUrl.replace('rtsp://', '').split('/');
    const host = urlParts[0];
    const path = urlParts.slice(1).join('/');
    const encodedUsername = encodeURIComponent(stream.rtsp_username);
    const encodedPassword = encodeURIComponent(stream.rtsp_password);
    rtspUrl = `rtsp://${encodedUsername}:${encodedPassword}@${host}/${path}`;
  }

  const hlsOutputDir = `./media/live/${stream.stream_name}`;
  const hlsOutputPath = `${hlsOutputDir}/index.m3u8`;

  console.log(`[RTSP] Starting pull for ${stream.stream_name}`);
  console.log(`[RTSP] Source: ${rtspUrl.replace(/:([^:@]+)@/, ':****@')}`);

  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', `${hlsOutputDir}/%03d.ts`,
    hlsOutputPath
  ];

  const { mkdirSync } = require('fs');

  try {
    mkdirSync(hlsOutputDir, { recursive: true });
  } catch (e) {
    console.error(`[RTSP] Error creating directory: ${e.message}`);
  }

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('error') || message.includes('Error')) {
      console.error(`[RTSP][${stream.stream_name}] ${message}`);
    }
  });

  ffmpeg.on('close', async (code) => {
    console.log(`[RTSP][${stream.stream_name}] Process exited with code ${code}`);
    rtspProcesses.delete(streamKey);
    activeRTSPStreams.delete(stream.stream_name);

    await supabase
      .from('streams')
      .update({ status: 'offline', ended_at: new Date().toISOString() })
      .eq('id', stream.id);
  });

  rtspProcesses.set(streamKey, ffmpeg);
  activeRTSPStreams.set(stream.stream_name, {
    streamKey,
    streamId: stream.id,
    streamName: stream.stream_name
  });

  const protocol = process.env.VITE_HTTP_SECURE === 'true' ? 'https' : 'http';
  const hlsUrl = `${protocol}://${httpHost}${httpPort === 80 || httpPort === 443 ? '' : ':' + httpPort}/live/${stream.stream_name}/index.m3u8`;

  await supabase
    .from('streams')
    .update({
      status: 'live',
      started_at: new Date().toISOString(),
      hls_url: hlsUrl
    })
    .eq('id', stream.id);
}

function stopRTSPPull(streamKey) {
  const process = rtspProcesses.get(streamKey);
  if (process) {
    console.log(`[RTSP] Stopping pull for stream key: ${streamKey}`);
    process.kill('SIGTERM');
    rtspProcesses.delete(streamKey);
  }
}

async function loadAndStartRTSPStreams() {
  console.log('[RTSP] Loading RTSP streams from database...');

  const { data: rtspStreams, error } = await supabase
    .from('streams')
    .select('*')
    .eq('input_type', 'rtsp');

  if (error) {
    console.error('[RTSP] Error loading RTSP streams:', error);
    return;
  }

  if (rtspStreams && rtspStreams.length > 0) {
    console.log(`[RTSP] Found ${rtspStreams.length} RTSP stream(s)`);
    for (const stream of rtspStreams) {
      console.log(`[RTSP] Starting pull for: ${stream.stream_name}`);
      await startRTSPPull(stream);
    }
  } else {
    console.log('[RTSP] No RTSP streams configured');
  }
}

nms.on('prePublish', async (id, StreamPath, args) => {
  if (typeof id === 'object') {
    StreamPath = id.streamPath;
    args = id.streamQuery;
    id = id.id;
  }

  console.log('[Auth] Checking stream authorization...');

  if (!StreamPath || StreamPath === 'undefined') {
    console.log('[Auth] Invalid StreamPath');
    return;
  }

  const streamName = StreamPath.split('/').pop();
  const rtspStream = activeRTSPStreams.get(streamName);

  if (rtspStream) {
    console.log('[Auth] RTSP stream authorized:', streamName);
    return;
  }

  if (!args) {
    console.log('[Auth] No stream key provided');
    const session = nms.getSession(id);
    if (session) session.reject();
    return;
  }

  const streamKey = args.split('=')[1];

  const { data: stream, error } = await supabase
    .from('streams')
    .select('*')
    .eq('stream_key', streamKey)
    .maybeSingle();

  if (error || !stream) {
    console.log('[Auth] Invalid stream key:', streamKey);
    const session = nms.getSession(id);
    if (session) session.reject();
    return;
  }

  console.log('[Auth] Stream authorized:', stream.stream_name);
});

nms.on('postPublish', async (id, StreamPath, args) => {
  if (typeof id === 'object') {
    StreamPath = id.streamPath;
    args = id.streamQuery;
    id = id.id;
  }

  console.log('[Publish] Stream is now publishing...');

  if (!StreamPath || StreamPath === 'undefined') {
    console.log('[Publish] Invalid StreamPath');
    return;
  }

  const streamName = StreamPath.split('/').pop();
  const rtspStream = activeRTSPStreams.get(streamName);

  if (rtspStream) {
    console.log('[Publish] RTSP stream is now live:', streamName);
    return;
  }

  if (!args) {
    console.log('[Publish] No args provided');
    return;
  }

  const streamKey = args.split('=')[1];

  const { data: stream, error } = await supabase
    .from('streams')
    .select('id, stream_name')
    .eq('stream_key', streamKey)
    .maybeSingle();

  if (error || !stream) {
    console.log('[Publish] Stream not found for key:', streamKey);
    return;
  }

  const protocol = process.env.VITE_HTTP_SECURE === 'true' ? 'https' : 'http';
  const hlsUrl = `${protocol}://${httpHost}${httpPort === 80 || httpPort === 443 ? '' : ':' + httpPort}/live/${stream.stream_name}/index.m3u8`;

  await supabase
    .from('streams')
    .update({
      status: 'live',
      started_at: new Date().toISOString(),
      rtmp_url: StreamPath,
      hls_url: hlsUrl
    })
    .eq('id', stream.id);

  console.log('[Publish] Stream is now live:', stream.stream_name);
});

nms.on('donePublish', async (id, StreamPath, args) => {
  if (typeof id === 'object' && id.publishStreamPath) {
    StreamPath = id.publishStreamPath;
    args = id.publishArgs;
    id = id.id;
  }

  console.log('[Cleanup] Stream ended');

  if (!StreamPath || StreamPath === 'undefined') {
    console.log('[Cleanup] Invalid StreamPath');
    return;
  }

  const streamName = StreamPath.split('/').pop();
  const rtspStream = activeRTSPStreams.get(streamName);

  if (rtspStream) {
    console.log('[Cleanup] RTSP stream ended:', streamName);
    activeRTSPStreams.delete(streamName);
    return;
  }

  if (!args) {
    console.log('[Cleanup] No args');
    return;
  }

  const streamKey = args.split('=')[1];

  const { data: stream } = await supabase
    .from('streams')
    .select('id')
    .eq('stream_key', streamKey)
    .maybeSingle();

  if (stream) {
    await supabase
      .from('streams')
      .update({
        status: 'offline',
        ended_at: new Date().toISOString(),
        viewer_count: 0
      })
      .eq('id', stream.id);
  }
});

nms.on('postPlay', async (id, StreamPath, args) => {
  const streamName = StreamPath.split('/').pop();

  const { data: stream } = await supabase
    .from('streams')
    .select('id, viewer_count')
    .eq('stream_name', streamName)
    .maybeSingle();

  if (stream) {
    await supabase
      .from('streams')
      .update({
        viewer_count: (stream.viewer_count || 0) + 1
      })
      .eq('id', stream.id);
  }
});

nms.on('donePlay', async (id, StreamPath, args) => {
  const streamName = StreamPath.split('/').pop();

  const { data: stream } = await supabase
    .from('streams')
    .select('id, viewer_count')
    .eq('stream_name', streamName)
    .maybeSingle();

  if (stream) {
    await supabase
      .from('streams')
      .update({
        viewer_count: Math.max((stream.viewer_count || 1) - 1, 0)
      })
      .eq('id', stream.id);
  }
});

nms.run();

console.log('🎥 StreamHub Media Server');
console.log(`📡 RTMP: rtmp://${httpHost}:${rtmpPort}/live`);
console.log(`🌐 HLS: http://${httpHost}:${httpPort}/live`);
console.log(`🔧 Mode: ${isProduction ? 'Production' : 'Development'}`);

loadAndStartRTSPStreams();

const streamSubscription = supabase
  .channel('stream-changes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'streams',
    filter: 'input_type=eq.rtsp'
  }, async (payload) => {
    console.log('[RTSP] New RTSP stream detected:', payload.new.stream_name);
    await startRTSPPull(payload.new);
  })
  .on('postgres_changes', {
    event: 'DELETE',
    schema: 'public',
    table: 'streams'
  }, (payload) => {
    console.log('[RTSP] Stream deleted:', payload.old.stream_name);
    if (payload.old.stream_key) {
      stopRTSPPull(payload.old.stream_key);
    }
  })
  .subscribe();

process.on('SIGTERM', () => {
  console.log('\n[Server] Shutting down...');
  for (const [key, process] of rtspProcesses.entries()) {
    console.log(`[RTSP] Stopping stream: ${key}`);
    process.kill('SIGTERM');
  }
  streamSubscription.unsubscribe();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n[Server] Shutting down...');
  for (const [key, process] of rtspProcesses.entries()) {
    console.log(`[RTSP] Stopping stream: ${key}`);
    process.kill('SIGTERM');
  }
  streamSubscription.unsubscribe();
  process.exit(0);
});
