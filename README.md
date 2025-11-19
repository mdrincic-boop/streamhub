# StreamHub - Professional Live Streaming Platform

A production-ready live streaming platform similar to Wowza and Flussonic, built with React, Node Media Server, and Supabase.

## Features

### Core Streaming
- **RTMP Live Streaming**: Accept RTMP streams from OBS Studio, vMix, or any RTMP encoder
- **HLS Playback**: Low-latency adaptive bitrate streaming with HLS.js
- **Stream Key Authentication**: Secure publishing with unique stream keys
- **Real-time Status Updates**: Live stream status monitoring via Supabase Realtime

### User Management
- **Email/Password Authentication**: Secure user registration and login
- **Stream Ownership**: Users can only manage their own streams
- **Row Level Security**: Database-level access control

### Dashboard & Analytics
- **Real-time Dashboard**: Monitor all streams with live statistics
- **Stream Management**: Create, configure, and manage multiple streams
- **Viewer Analytics**: Track concurrent viewers and stream metrics
- **Stream History**: View past streams and recordings

### Production Ready
- **Environment Configuration**: Separate dev/production configs
- **Error Handling**: Comprehensive error handling and validation
- **Input Sanitization**: XSS protection and input validation
- **Code Splitting**: Optimized bundle sizes for better performance
- **Responsive Design**: Beautiful, modern UI that works on all devices

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node Media Server (RTMP/HLS)
- **Database**: Supabase (PostgreSQL)
- **Video Player**: HLS.js
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- FFmpeg installed on your system
- Supabase account and project

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Start the media server:
```bash
npm run media-server
```

4. In a new terminal, start the web app:
```bash
npm run dev
```

The web interface will be available at `http://localhost:5173`

## How to Stream

### Using OBS Studio

1. Create a new stream in the dashboard
2. Click on the stream to view configuration details
3. Copy the RTMP URL and Stream Key
4. In OBS Studio:
   - Go to Settings → Stream
   - Service: Custom
   - Server: Paste the RTMP URL
   - Stream Key: Paste the Stream Key
5. Click "Start Streaming" in OBS

### Stream URLs

- **RTMP Ingest**: `rtmp://localhost:1935/live/{stream_name}`
- **HLS Playback**: `http://localhost:8000/live/{stream_name}/index.m3u8`

## Database Schema

The platform uses the following tables:

- **streams**: Main stream configuration and metadata
- **stream_analytics**: Real-time metrics and viewer data
- **stream_recordings**: Recorded stream sessions
- **viewers**: Individual viewer session tracking

All tables have Row Level Security (RLS) enabled for data protection.

## Server Ports

- **1935**: RTMP ingest port
- **8000**: HTTP/HLS delivery port
- **5173**: Web interface (Vite dev server)

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for comprehensive production deployment guide including:

- Environment configuration
- SSL/TLS setup (HTTPS, RTMPS)
- CDN integration (Cloudflare, AWS)
- Security hardening
- Monitoring and logging
- Scaling strategies
- Backup procedures

### Quick Production Checklist

1. ✅ Set up production Supabase project
2. ✅ Configure environment variables in `.env`
3. ✅ Install FFmpeg on server
4. ✅ Set up SSL certificates
5. ✅ Configure firewall (ports 22, 80, 443, 1935)
6. ✅ Deploy with PM2 or similar process manager
7. ✅ Set up CDN for HLS delivery
8. ✅ Configure monitoring and alerts
9. ✅ Enable automated backups
10. ✅ Test RTMPS and HTTPS connections

## Architecture

```
┌─────────────────┐
│   OBS Studio    │  RTMP Publish
│   (Encoder)     │────────────────┐
└─────────────────┘                │
                                   ▼
                         ┌──────────────────┐
                         │  Node Media      │
                         │  Server          │
                         │  (RTMP→HLS)      │
                         └──────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
           ┌─────────────┐  ┌──────────┐  ┌──────────┐
           │   HLS CDN   │  │ Supabase │  │  Media   │
           │   Delivery  │  │ Database │  │ Storage  │
           └─────────────┘  └──────────┘  └──────────┘
                    │              │
                    └──────┬───────┘
                           ▼
                  ┌─────────────────┐
                  │  React Frontend │
                  │   (Dashboard)   │
                  └─────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Viewers   │
                    └─────────────┘
```

## Security Features

- **Stream Key Authentication**: Each stream has a unique, secure key
- **Row Level Security**: Database-level access control
- **Input Validation**: All user inputs are validated and sanitized
- **CORS Configuration**: Configurable cross-origin policies
- **Rate Limiting**: Prevent abuse (configure in production)
- **SSL/TLS**: HTTPS and RTMPS support for encrypted connections

## Performance Optimization

- **Code Splitting**: Separate vendor chunks (React, Supabase, HLS.js)
- **Lazy Loading**: Components loaded on-demand
- **HLS Segments**: 2-second segments for low latency
- **Database Indexes**: Optimized queries for fast lookups
- **CDN Caching**: Static assets and HLS segments cached

## Monitoring

Monitor these metrics in production:

- **Server Resources**: CPU, RAM, disk usage
- **Concurrent Streams**: Active RTMP connections
- **Viewer Count**: Total concurrent viewers
- **Bitrate**: Average stream bitrate
- **Error Rate**: Failed connections, encoding errors
- **Database Performance**: Query times, connection pool

## Troubleshooting

### Stream won't start
- Check stream key is correct
- Verify RTMP port (1935) is accessible
- Check FFmpeg is installed and in PATH
- Review server logs: `pm2 logs streamhub-media`

### Playback issues
- Verify HLS URL is accessible
- Check browser console for errors
- Test with VLC or other HLS player
- Ensure CORS headers are set correctly

### Database errors
- Verify Supabase credentials in `.env`
- Check RLS policies are configured
- Review Supabase logs in dashboard

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
