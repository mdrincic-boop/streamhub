# RTSP Media Server Setup

## Overview
This guide will help you deploy the Node.js media server that converts RTSP streams to HLS format.

## Requirements
- Node.js 18+ installed
- FFmpeg installed
- Access to your Supabase credentials
- Server with public IP or domain

## Installation Steps

### 1. Install FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg -y
```

**CentOS/RHEL:**
```bash
sudo yum install epel-release -y
sudo yum install ffmpeg -y
```

**macOS:**
```bash
brew install ffmpeg
```

**Verify installation:**
```bash
ffmpeg -version
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Make sure your `.env` file has these variables:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

VITE_RTMP_HOST=your-server-ip-or-domain
VITE_RTMP_PORT=1935
VITE_RTMP_SECURE=false

VITE_HTTP_HOST=your-server-ip-or-domain
VITE_HTTP_PORT=8000
VITE_HTTP_SECURE=false

VITE_APP_NAME=StreamHub
NODE_ENV=production
SERVER_NAME=media-server-01
```

### 4. Start the Media Server

**Development mode:**
```bash
npm run media-server
```

**Production mode with PM2:**
```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start server.cjs --name media-server

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

### 5. Configure Firewall

Open required ports:

```bash
# RTMP port
sudo ufw allow 1935/tcp

# HTTP port for HLS
sudo ufw allow 8000/tcp
```

### 6. Test RTSP Stream

Once the server is running, it will:
1. Load all RTSP streams from database with `pull_mode=true`
2. Start FFmpeg process for each stream
3. Convert RTSP to RTMP internally
4. Generate HLS files in `./media` directory
5. Update database with HLS URLs

**View logs:**
```bash
# PM2 logs
pm2 logs media-server

# Or if running directly
# Logs will appear in terminal
```

## How It Works

1. **RTSP Pull**: Server reads RTSP streams from database
2. **FFmpeg Conversion**: FFmpeg pulls RTSP → converts to RTMP → NodeMediaServer generates HLS
3. **HLS Output**: Files saved to `./media/live/{stream_name}/`
4. **Database Update**: `hls_url` field updated automatically
5. **Frontend**: Video player reads HLS URL from database

## Monitoring

The server automatically:
- Checks stream health every 30 seconds
- Collects CPU/Memory metrics every 60 seconds
- Auto-reconnects failed streams (if `auto_reconnect=true`)
- Logs all events to console

## Troubleshooting

### RTSP stream not pulling
1. Check FFmpeg is installed: `ffmpeg -version`
2. Verify RTSP URL is accessible: `ffmpeg -i rtsp://your-url -t 5 test.mp4`
3. Check server logs: `pm2 logs media-server`
4. Verify `pull_mode=true` in database

### HLS not generated
1. Check `./media/live/` directory exists and is writable
2. Verify FFmpeg process is running: `ps aux | grep ffmpeg`
3. Check NodeMediaServer logs for errors

### Cannot access HLS stream
1. Verify HTTP server is running on port 8000
2. Check firewall allows port 8000
3. Test URL directly: `curl http://your-server:8000/live/stream_name/index.m3u8`

### High CPU usage
1. Reduce number of concurrent streams
2. Lower bitrate in stream settings
3. Disable transcoding if not needed

## Production Deployment

### Using PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'media-server',
    script: './server.cjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

Start with:
```bash
pm2 start ecosystem.config.js
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .

EXPOSE 1935 8000

CMD ["node", "server.cjs"]
```

Build and run:
```bash
docker build -t media-server .
docker run -d -p 1935:1935 -p 8000:8000 --env-file .env media-server
```

### Using Systemd

Create `/etc/systemd/system/media-server.service`:

```ini
[Unit]
Description=RTSP to HLS Media Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/streamhub
ExecStart=/usr/bin/node server.cjs
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable media-server
sudo systemctl start media-server
sudo systemctl status media-server
```

## Security Considerations

1. **Use HTTPS** for production (set `VITE_HTTP_SECURE=true`)
2. **Firewall**: Only open required ports
3. **Authentication**: RTSP credentials stored encrypted in database
4. **Stream Keys**: Keep stream keys secret
5. **Rate Limiting**: Consider adding nginx reverse proxy

## Performance Tips

1. Use SSD storage for `./media` directory
2. Enable `low_latency_mode` for real-time streams
3. Set appropriate bitrates based on available bandwidth
4. Use CDN for distributing HLS files
5. Monitor CPU/Memory usage regularly

## Support

Check logs for errors:
```bash
pm2 logs media-server --lines 100
```

Common log patterns:
- `[RTSP] Starting pull for...` - Stream starting
- `[RTSP] Process exited with code 0` - Normal stop
- `[RTSP] Process exited with code 1` - Error occurred
- `[Auth] Stream authorized` - RTMP connection successful
- `[Health] CPU: XX% | Memory: XX%` - System metrics
