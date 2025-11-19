# StreamHub Deployment na Plesk (Ubuntu 22.04)

Ovaj vodič pokazuje kako instalirati StreamHub na Ubuntu 22.04 server sa Pleskom i domenom **digitalandromeda.com**.

## Preduvjeti

- ✅ Ubuntu 22.04 sa Pleskom
- ✅ Domain: digitalandromeda.com
- ✅ SSH pristup
- ✅ Supabase account

## Korak 1: SSH Pristup

```bash
ssh root@digitalandromeda.com
# ili
ssh your-username@your-server-ip
```

## Korak 2: Instalacija Node.js i FFmpeg

```bash
# Update sistema
sudo apt update && sudo apt upgrade -y

# Instalacija Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalacija FFmpeg
sudo apt install -y ffmpeg

# Provjera instalacije
node --version    # Should show v18.x or higher
npm --version
ffmpeg -version
```

## Korak 3: Kreiranje Direktorija

```bash
# Idi u Plesk web root ili kreiraj novi folder
cd /var/www/vhosts/digitalandromeda.com

# Kreiraj aplikaciju folder
sudo mkdir -p streamhub
cd streamhub

# Postavi ownership
sudo chown -R $USER:$USER /var/www/vhosts/digitalandromeda.com/streamhub
```

## Korak 4: Upload Projekta

**Opcija A: Git Clone (preporučeno)**
```bash
# Ako imaš Git repo
git clone your-repo-url .
```

**Opcija B: SCP Upload sa lokalnog računara**
```bash
# Sa lokalnog računara (ne na serveru!)
cd /path/to/your/streamhub-project
scp -r * root@digitalandromeda.com:/var/www/vhosts/digitalandromeda.com/streamhub/
```

**Opcija C: Plesk File Manager**
- Log in Plesk panel
- Idi na Files
- Upload sve fajlove u `/var/www/vhosts/digitalandromeda.com/streamhub/`

## Korak 5: Setup Environment Variables

```bash
cd /var/www/vhosts/digitalandromeda.com/streamhub

# Kreiraj .env file
nano .env
```

Dodaj ove varijable:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Streaming Configuration
VITE_RTMP_PORT=1935
VITE_HTTP_PORT=8000
VITE_HTTP_HOST=digitalandromeda.com
VITE_HTTP_SECURE=true
VITE_PUBLIC_RTMP_URL=rtmp://digitalandromeda.com:1935/live

# Application
NODE_ENV=production
SERVER_NAME=digitalandromeda-stream
FFMPEG_PATH=/usr/bin/ffmpeg
```

Spremi fajl: `Ctrl+X`, pa `Y`, pa `Enter`

## Korak 6: Instalacija Dependencies

```bash
cd /var/www/vhosts/digitalandromeda.com/streamhub

# Instalacija paketa
npm install

# Build frontend
npm run build
```

## Korak 7: Otvori Portove u Firewallu

```bash
# Provjeri firewall status
sudo ufw status

# Ako je aktivan, dozvoli portove
sudo ufw allow 1935/tcp    # RTMP
sudo ufw allow 8000/tcp    # HLS HTTP
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# Provjeri Plesk Firewall u panelu
# Plesk → Tools & Settings → Firewall → Add Rule
```

**Ili kroz Plesk panel:**
1. Idi na **Tools & Settings**
2. **Security** → **Firewall**
3. Dodaj pravila za portove 1935 i 8000

## Korak 8: Instalacija PM2 za Process Management

```bash
# Instaliraj PM2 globalno
sudo npm install -g pm2

# Pokreni Media Server
cd /var/www/vhosts/digitalandromeda.com/streamhub
pm2 start server.js --name streamhub-media

# Pokreni na boot
pm2 startup systemd
pm2 save

# Provjeri status
pm2 status
pm2 logs streamhub-media
```

## Korak 9: Setup Nginx za Frontend

**Opcija A: Koristi Plesk Apache/Nginx (Najlakše)**

1. Log in Plesk panel
2. Idi na **Websites & Domains** → digitalandromeda.com
3. Klikni **Hosting & DNS** → **Apache & nginx Settings**
4. Dodaj u **Additional nginx directives**:

```nginx
location / {
    root /var/www/vhosts/digitalandromeda.com/streamhub/dist;
    try_files $uri $uri/ /index.html;
}

location /live {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;

    add_header Cache-Control no-cache;
    add_header Access-Control-Allow-Origin *;

    types {
        application/vnd.apple.mpegurl m3u8;
        video/mp2t ts;
    }
}

location /api {
    proxy_pass http://localhost:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

5. **OK** i **Apply**

**Opcija B: Custom Nginx Config**

```bash
sudo nano /etc/nginx/sites-available/streamhub
```

```nginx
server {
    listen 80;
    server_name digitalandromeda.com www.digitalandromeda.com;

    # Frontend
    root /var/www/vhosts/digitalandromeda.com/streamhub/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # HLS Streams
    location /live {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;

        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;

        types {
            application/vnd.apple.mpegurl m3u8;
            video/mp2t ts;
        }
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/streamhub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Korak 10: SSL Certificate (HTTPS)

**Kroz Plesk (Najlakše):**

1. Plesk Panel → **Websites & Domains** → digitalandromeda.com
2. **SSL/TLS Certificates**
3. Klikni **Get it free** (Let's Encrypt)
4. Odaberi domain i subdomains
5. Klikni **Get it free** i čekaj

**Ili manual:**

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d digitalandromeda.com -d www.digitalandromeda.com
```

## Korak 11: Kreiraj Subdomain za Streaming (Opcionalno)

Možeš kreirati subdomain `stream.digitalandromeda.com`:

1. Plesk → **Websites & Domains** → **Subdomains**
2. Klikni **Add Subdomain**
3. Subdomain name: `stream`
4. Document root: `/var/www/vhosts/digitalandromeda.com/streamhub/dist`

Zatim konfiguriši nginx za `stream.digitalandromeda.com` kao gore.

## Korak 12: Testiranje

### Test Media Server:
```bash
pm2 logs streamhub-media
```

Trebao bi vidjeti:
```
🎥 Node Media Server started!
📡 RTMP Server running on port 1935
🌐 HTTP Server running on port 8000
```

### Test Frontend:
```
https://digitalandromeda.com
```

### Test RTMP Streaming:

**U OBS Studio:**
```
Server: rtmp://digitalandromeda.com:1935/live
Stream Key: (tvoj stream key iz aplikacije)
```

### Test HLS Playback:
```
https://digitalandromeda.com/live/{stream_name}/index.m3u8
```

## Korak 13: Monitoring

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs streamhub-media

# Monitor resources
pm2 monit

# Restart if needed
pm2 restart streamhub-media
```

## Brzi Troubleshooting

### Media server ne startuje
```bash
# Provjeri logs
pm2 logs streamhub-media

# Provjeri je li port 1935 slobodan
sudo netstat -tulpn | grep 1935

# Restartuj
pm2 restart streamhub-media
```

### FFmpeg error
```bash
# Provjeri instalaciju
which ffmpeg

# Reinstaliraj ako treba
sudo apt install --reinstall ffmpeg
```

### Port 1935 blokiran
```bash
# Provjeri firewall
sudo ufw status

# Otvori port
sudo ufw allow 1935/tcp
```

### Ne vidiš frontend
```bash
# Provjeri nginx
sudo nginx -t
sudo systemctl status nginx

# Restartuj nginx
sudo systemctl restart nginx
```

## RTMP URL Format

Za streamanje sa OBS/Wirecast:

```
Server: rtmp://digitalandromeda.com:1935/live
Stream Key: {tvoj_stream_key}

Ili kombinovano:
rtmp://digitalandromeda.com:1935/live/{stream_name}?key={stream_key}
```

## Watch URLs

- **Main App:** https://digitalandromeda.com
- **Watch Page:** https://digitalandromeda.com/watch/{stream_id}
- **Embed:** https://digitalandromeda.com/embed/{stream_id}
- **Snapshot:** https://digitalandromeda.com/snapshot/{stream_id}
- **HLS Direct:** https://digitalandromeda.com/live/{stream_name}/index.m3u8

## Automatski Restart

PM2 već radi automatski restart. Za dodatnu sigurnost:

```bash
# Kreiraj cron job za health check
crontab -e
```

Dodaj:
```
*/5 * * * * pm2 restart streamhub-media --update-env
```

## Backup Script

```bash
# Kreiraj backup folder
sudo mkdir -p /backups/streamhub

# Backup script
cat > /var/www/vhosts/digitalandromeda.com/streamhub/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/backups/streamhub"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup .env file
cp /var/www/vhosts/digitalandromeda.com/streamhub/.env $BACKUP_DIR/env_$DATE

# Backup PM2 config
pm2 save
cp ~/.pm2/dump.pm2 $BACKUP_DIR/pm2_$DATE

echo "Backup completed: $DATE"
EOF

chmod +x backup.sh

# Dodaj u crontab za dnevni backup
crontab -e
# Dodaj: 0 2 * * * /var/www/vhosts/digitalandromeda.com/streamhub/backup.sh
```

## Sažetak Instalacije (Brzi Start)

```bash
# 1. Instalacija dependencies
sudo apt update && sudo apt install -y nodejs npm ffmpeg

# 2. Upload projekta
cd /var/www/vhosts/digitalandromeda.com
mkdir streamhub && cd streamhub
# (upload files here)

# 3. Setup
npm install
nano .env  # konfiguriši varijable
npm run build

# 4. Run
sudo npm install -g pm2
pm2 start server.js --name streamhub-media
pm2 startup systemd
pm2 save

# 5. Configure Nginx kroz Plesk panel

# 6. Enable SSL kroz Plesk (Let's Encrypt)

# 7. Test
pm2 logs streamhub-media
# Open: https://digitalandromeda.com
```

## Kontaktiraj Support

Ako imaš problema:

1. Check logs: `pm2 logs streamhub-media`
2. Check nginx: `sudo nginx -t`
3. Check firewall: `sudo ufw status`
4. Check ports: `sudo netstat -tulpn | grep -E '1935|8000'`

Sve bi trebalo raditi! 🚀
