const NodeMediaServer = require('node-media-server');
const { createClient } = require('@supabase/supabase-js');
const os = require('os');
const { spawn } = require('child_process');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rtmpPort = parseInt(process.env.VITE_RTMP_PORT || '1935');
const httpPort = parseInt(process.env.VITE_HTTP_PORT || '8000');
const httpHost = process.env.VITE_HTTP_HOST || 'localhost';
const isProduction = process.env.NODE_ENV === 'production';
const serverName = process.env.SERVER_NAME || os.hostname();

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

const rtspProcesses = new Map();

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
    rtspUrl = `rtsp://${stream.rtsp_username}:${stream.rtsp_password}@${host}/${path}`;
  }

  const rtmpOutput = `rtmp://localhost:${rtmpPort}/live/${stream.stream_name}?key=${streamKey}`;

  console.log(`[RTSP] Starting pull for ${stream.stream_name}`);
  console.log(`[RTSP] Source: ${rtspUrl.replace(/:([^:@]+)@/, ':****@')}`);
  console.log(`[RTSP] Output: ${rtmpOutput.replace(/key=[^&]+/, 'key=****')}`);

  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-c:a', 'aac',
    '-f', 'flv',
    rtmpOutput
  ];

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stdout.on('data', (data) => {
    console.log(`[RTSP][${stream.stream_name}] ${data}`);
  });

  ffmpeg.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.includes('error') || message.includes('Error')) {
      console.error(`[RTSP][${stream.stream_name}] Error: ${message}`);
    }
  });

  ffmpeg.on('close', async (code) => {
    console.log(`[RTSP][${stream.stream_name}] Process exited with code ${code}`);
    rtspProcesses.delete(streamKey);

    if (stream.auto_reconnect && code !== 0) {
      console.log(`[RTSP][${stream.stream_name}] Reconnecting in 5 seconds...`);
      setTimeout(() => {
        startRTSPPull(stream);
      }, 5000);
    } else {
      await supabase
        .from('streams')
        .update({ status: 'offline', ended_at: new Date().toISOString() })
        .eq('id', stream.id);
    }
  });

  rtspProcesses.set(streamKey, ffmpeg);
  activeRTSPStreams.set(stream.stream_name, {
    streamKey,
    streamId: stream.id,
    streamName: stream.stream_name
  });

  await supabase
    .from('streams')
    .update({ status: 'live', started_at: new Date().toISOString() })
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
    .eq('input_type', 'rtsp')
    .eq('pull_mode', true);

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

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

function getOverlayFilter(overlays) {
  if (!overlays || overlays.length === 0) return '';

  const filters = overlays
    .filter(o => o.enabled)
    .sort((a, b) => a.layer_order - b.layer_order)
    .map((overlay, index) => {
      let position = '';

      switch(overlay.position) {
        case 'top-left':
          position = '10:10';
          break;
        case 'top-center':
          position = '(W-w)/2:10';
          break;
        case 'top-right':
          position = 'W-w-10:10';
          break;
        case 'center-left':
          position = '10:(H-h)/2';
          break;
        case 'center':
          position = '(W-w)/2:(H-h)/2';
          break;
        case 'center-right':
          position = 'W-w-10:(H-h)/2';
          break;
        case 'bottom-left':
          position = '10:H-h-10';
          break;
        case 'bottom-center':
          position = '(W-w)/2:H-h-10';
          break;
        case 'bottom-right':
          position = 'W-w-10:H-h-10';
          break;
        case 'custom':
          position = `${overlay.custom_x || 0}:${overlay.custom_y || 0}`;
          break;
        default:
          position = 'W-w-10:10';
      }

      const opacity = overlay.opacity / 100;

      return `[0:v]overlay=${position}:format=auto:alpha=${opacity}[v${index}]`;
    });

  return filters.join(';');
}

nms.on('prePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

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
    console.log('[Auth] No stream key provided for non-RTSP stream');
    const session = nms.getSession(id);
    if (session) session.reject();
    return;
  }

  const streamKey = args.split('=')[1];

  const { data: stream, error } = await supabase
    .from('streams')
    .select('*, stream_settings(*), stream_overlays(*)')
    .eq('stream_key', streamKey)
    .maybeSingle();

  if (error || !stream) {
    console.log('[Auth] Invalid stream key:', streamKey);
    const session = nms.getSession(id);
    session.reject();
    return;
  }

  const protocol = process.env.VITE_HTTP_SECURE === 'true' ? 'https' : 'http';
  const hlsUrl = `${protocol}://${httpHost}${httpPort === 80 || httpPort === 443 ? '' : ':' + httpPort}${StreamPath.replace('/live/', '/live/')}/index.m3u8`;

  const settings = stream.stream_settings?.[0];
  const bitrate = settings?.custom_bitrate || settings?.bitrate_preset || stream.max_bitrate || 5000;
  const lowLatency = stream.low_latency_mode || settings?.low_latency_mode;
  const overlays = stream.stream_overlays?.filter(o => o.enabled) || [];

  console.log('[Stream Settings]', {
    bitrate,
    resolution: stream.target_resolution,
    fps: stream.target_fps,
    lowLatency,
    transcoding: stream.transcoding_enabled,
    overlays: overlays.length
  });

  if (overlays.length > 0) {
    console.log('[Overlays]', overlays.map(o => ({
      name: o.name,
      position: o.position,
      size: o.size_mode === 'percentage'
        ? `${o.width_percentage}%x${o.height_percentage}%`
        : `${o.width_pixels}px x ${o.height_pixels}px`,
      opacity: `${o.opacity}%`
    })));
  }

  await supabase
    .from('streams')
    .update({
      status: 'live',
      started_at: new Date().toISOString(),
      rtmp_url: StreamPath,
      hls_url: hlsUrl
    })
    .eq('id', stream.id);

  console.log('[Auth] Stream authorized:', stream.stream_name);
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

  if (!StreamPath || StreamPath === 'undefined') {
    console.log('[Cleanup] Invalid StreamPath, skipping');
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
    console.log('[Cleanup] No args for non-RTSP stream');
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

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('postPlay', async (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

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
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

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

async function collectHealthMetrics() {
  try {
    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;

    const { data: streams } = await supabase
      .from('streams')
      .select('status, viewer_count')
      .eq('status', 'live');

    const activeStreams = streams?.length || 0;
    const totalViewers = streams?.reduce((acc, s) => acc + (s.viewer_count || 0), 0) || 0;

    await supabase
      .from('server_health')
      .insert({
        server_name: serverName,
        cpu_usage: cpuUsage.toFixed(2),
        memory_usage: memoryUsage.toFixed(2),
        disk_usage: 0,
        active_streams: activeStreams,
        total_viewers: totalViewers,
        bandwidth_mbps: 0,
        status: cpuUsage < 80 && memoryUsage < 90 ? 'healthy' : 'warning'
      });

    console.log(`[Health] CPU: ${cpuUsage.toFixed(1)}% | Memory: ${memoryUsage.toFixed(1)}% | Streams: ${activeStreams} | Viewers: ${totalViewers}`);
  } catch (error) {
    console.error('[Health] Error collecting metrics:', error);
  }
}

setInterval(collectHealthMetrics, 60000);

nms.run();

console.log('🎥 Node Media Server started!');
console.log(`📡 RTMP Server running on port ${rtmpPort}`);
console.log(`🌐 HTTP Server running on port ${httpPort}`);
console.log(`🖥️  Server: ${serverName}`);
console.log(`🔧 Mode: ${isProduction ? 'Production' : 'Development'}`);
console.log('\n📝 To publish a stream use:');
console.log(`   rtmp://${httpHost}:${rtmpPort}/live/{stream_name}?key={stream_key}`);
console.log('\n▶️  To play a stream use:');
console.log(`   http://${httpHost}:${httpPort}/live/{stream_name}/index.m3u8`);
console.log('\n📊 Health monitoring enabled (60s interval)');
console.log('\n📹 RTSP support enabled for IP cameras');

collectHealthMetrics();
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
