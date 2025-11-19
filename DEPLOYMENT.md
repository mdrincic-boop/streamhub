# StreamHub - Production Deployment Guide

This guide covers deploying StreamHub to production with proper security, scalability, and reliability.

## Prerequisites

- Domain name with DNS access
- SSL certificates (Let's Encrypt recommended)
- Server with at least 2GB RAM and 2 CPU cores
- Node.js 18+ installed
- FFmpeg installed
- Supabase production project

## Environment Configuration

### 1. Backend Server (.env)

Create a `.env` file on your server:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key

# Streaming Configuration
VITE_RTMP_HOST=stream.yourdomain.com
VITE_RTMP_PORT=1935
VITE_RTMP_SECURE=true

# HLS Configuration
VITE_HTTP_HOST=stream.yourdomain.com
VITE_HTTP_PORT=443
VITE_HTTP_SECURE=true

# Application
VITE_APP_NAME=StreamHub
NODE_ENV=production

# FFmpeg Path (adjust based on your system)
FFMPEG_PATH=/usr/bin/ffmpeg
```

### 2. Frontend Environment

Update your frontend build environment variables for production URLs.

## Server Setup

### Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Verify installations
node --version
ffmpeg -version
```

### Install Application

```bash
# Clone repository
git clone your-repo-url
cd streamhub

# Install dependencies
npm install --production

# Build frontend
npm run build
```

## RTMP Server Configuration

### Option 1: Using Nginx-RTMP (Recommended for Production)

```bash
# Install Nginx with RTMP module
sudo apt install -y nginx libnginx-mod-rtmp

# Configure Nginx RTMP
sudo nano /etc/nginx/nginx.conf
```

Add RTMP configuration:

```nginx
rtmp {
    server {
        listen 1935;
        chunk_size 4096;

        application live {
            live on;
            record off;

            # Enable HLS
            hls on;
            hls_path /var/www/hls;
            hls_fragment 2s;
            hls_playlist_length 6s;

            # Authentication via HTTP callback
            on_publish http://localhost:3000/api/auth/rtmp;

            # Prevent unauthorized playback
            allow publish all;
            deny publish all;
        }
    }
}
```

### Option 2: Node Media Server with PM2

```bash
# Install PM2
npm install -g pm2

# Start media server with PM2
pm2 start server.js --name streamhub-media

# Setup PM2 to start on boot
pm2 startup
pm2 save
```

## SSL/TLS Configuration

### RTMPS (Secure RTMP)

Use Stunnel to wrap RTMP with TLS:

```bash
# Install Stunnel
sudo apt install -y stunnel4

# Configure Stunnel
sudo nano /etc/stunnel/stunnel.conf
```

```conf
[rtmps]
accept = 443
connect = 127.0.0.1:1935
cert = /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem
key = /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem
```

### HTTPS for HLS

Configure Nginx as reverse proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name stream.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/stream.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stream.yourdomain.com/privkey.pem;

    location /live {
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;

        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }

        alias /var/www/hls;
    }
}
```

## CDN Integration

### Cloudflare Setup

1. Add your domain to Cloudflare
2. Enable Cloudflare Stream or use standard CDN for HLS files
3. Configure caching rules:
   - `.m3u8` files: Cache for 2 seconds
   - `.ts` segments: Cache for 10 seconds

### AWS CloudFront

1. Create CloudFront distribution
2. Set origin to your streaming server
3. Configure caching behaviors for HLS content

## Database Configuration

### Supabase Production

1. Create production Supabase project
2. Run migrations from `supabase/migrations/`
3. Configure RLS policies
4. Set up database backups (automatic in Supabase)

### Connection Pooling

For high traffic, enable connection pooling in Supabase:

```javascript
const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
  },
  global: {
    headers: {
      'x-connection-pool': 'enabled',
    },
  },
});
```

## Security Hardening

### Firewall Configuration

```bash
# UFW setup
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 1935/tcp  # RTMP
sudo ufw enable
```

### Rate Limiting

Add to Nginx configuration:

```nginx
limit_req_zone $binary_remote_addr zone=rtmp_limit:10m rate=5r/s;

server {
    location / {
        limit_req zone=rtmp_limit burst=10;
    }
}
```

### Stream Key Security

- Rotate stream keys regularly
- Implement IP whitelisting for publishers
- Monitor for unauthorized access attempts

## Monitoring & Logging

### PM2 Monitoring

```bash
# View logs
pm2 logs streamhub-media

# Monitor resources
pm2 monit

# Setup log rotation
pm2 install pm2-logrotate
```

### Error Tracking

Integrate Sentry or similar:

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: 'your-sentry-dsn',
  environment: 'production',
});
```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer**: Use Nginx or HAProxy to distribute RTMP connections
2. **Multiple Origin Servers**: Deploy multiple streaming servers
3. **Shared Storage**: Use S3 or NFS for HLS segments

### Vertical Scaling

- Minimum: 2GB RAM, 2 CPU cores
- Recommended: 4GB RAM, 4 CPU cores per 100 concurrent viewers
- Add 1GB RAM per additional 50 concurrent streams

### Database Scaling

Supabase handles scaling automatically, but consider:
- Enable read replicas for analytics queries
- Archive old stream data regularly
- Optimize indexes for frequently queried fields

## Backup Strategy

### Database Backups

Supabase provides automatic backups. For additional safety:

```bash
# Manual backup script
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Media File Backups

If storing recordings:

```bash
# Sync to S3
aws s3 sync /var/www/recordings s3://your-bucket/recordings/
```

## Performance Optimization

### Transcoding for Adaptive Bitrate

Configure FFmpeg in server.js:

```javascript
tasks: [
  {
    app: 'live',
    hls: true,
    hlsFlags: '[hls_time=2:hls_list_size=3:hls_flags=delete_segments]',

    // Multiple quality levels
    mp4: true,
    mp4Flags: '[movflags=frag_keyframe+empty_moov]',

    // Transcode to multiple bitrates
    exec_push: 'ffmpeg -i rtmp://localhost/live/$name -c:v libx264 -preset veryfast -tune zerolatency -c:a aac -ar 44100 -b:a 128k -f flv rtmp://localhost/hls/$name_720p'
  }
]
```

### Browser Caching

```nginx
location ~* \.(m3u8)$ {
    expires 2s;
    add_header Cache-Control "public, max-age=2";
}

location ~* \.(ts)$ {
    expires 10s;
    add_header Cache-Control "public, max-age=10";
}
```

## Troubleshooting

### Common Issues

**FFmpeg not found**
```bash
which ffmpeg
# Update FFMPEG_PATH in .env
```

**RTMP connection refused**
```bash
# Check if port is open
sudo netstat -tulpn | grep 1935

# Check firewall
sudo ufw status
```

**HLS playback issues**
```bash
# Verify HLS files are being created
ls -la /var/www/hls/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Maintenance

### Regular Tasks

- **Daily**: Monitor server resources and logs
- **Weekly**: Review stream analytics and error rates
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and optimize database performance

### Updates

```bash
# Update application
git pull origin main
npm install --production
npm run build

# Restart services
pm2 restart streamhub-media
sudo systemctl restart nginx
```

## Support & Resources

- [Node Media Server Documentation](https://github.com/illuspas/Node-Media-Server)
- [Supabase Documentation](https://supabase.com/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Nginx RTMP Module](https://github.com/arut/nginx-rtmp-module)

## Conclusion

This setup provides a production-ready streaming platform. Monitor performance metrics and scale resources as needed based on your traffic patterns.
