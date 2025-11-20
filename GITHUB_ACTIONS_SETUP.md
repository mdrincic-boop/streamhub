# GitHub Actions Auto-Deploy Setup

Ovaj projekat koristi **GitHub Actions** za automatski deployment na Plesk server svaki put kada push-uješ na `main` branch.

---

## Kako postaviti GitHub Secrets

1. **Idi na GitHub repo**: `https://github.com/TVOJ-USERNAME/TVOJ-REPO`
2. **Klikni**: Settings → Secrets and variables → Actions
3. **Dodaj sledeće secrets** (klikni "New repository secret"):

### FTP Pristup (Plesk)

| Secret Name | Vrednost | Gde naći |
|------------|----------|----------|
| `FTP_SERVER` | `mrakovica.ddns.net` ili IP adresa servera | Plesk → Websites & Domains → FTP Access |
| `FTP_USERNAME` | Tvoj FTP username | Plesk → Websites & Domains → FTP Access |
| `FTP_PASSWORD` | Tvoja FTP šifra | Plesk → Websites & Domains → FTP Access |

### Environment Variables (Supabase)

| Secret Name | Vrednost | Gde naći |
|------------|----------|----------|
| `VITE_SUPABASE_URL` | `https://ksukzztughnjhrbshuul.supabase.co` | Tvoj `.env` fajl |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Tvoj `.env` fajl |
| `VITE_RTMP_HOST` | `mrakovica.ddns.net` | Tvoj server hostname |
| `VITE_RTMP_PORT` | `1935` | RTMP port |
| `VITE_RTMP_SECURE` | `false` | Da li koristiš RTMPS |
| `VITE_HTTP_HOST` | `mrakovica.ddns.net` | Tvoj server hostname |
| `VITE_HTTP_PORT` | `8000` | HTTP port za media server |
| `VITE_HTTP_SECURE` | `false` | Da li koristiš HTTPS |
| `VITE_APP_NAME` | `StreamHub` | Ime tvoje aplikacije |

---

## Kako radi automatski deployment

1. **Push na GitHub**:
   ```bash
   git add .
   git commit -m "Update code"
   git push origin main
   ```

2. **GitHub Actions automatski**:
   - Preuzima kod
   - Instalira dependencies (`npm ci`)
   - Build-uje projekat (`npm run build`)
   - Upload-uje `dist/` folder na Plesk FTP

3. **Gotovo!** Sajt je ažuriran na `https://mrakovica.ddns.net`

---

## Praćenje deploya

- **Idi na**: `https://github.com/TVOJ-USERNAME/TVOJ-REPO/actions`
- Videćeš sve deploy-ove i njihov status (uspešan/neuspešan)

---

## Troubleshooting

### FTP Connection Failed
- Proveri da li su FTP kredencijali tačni u GitHub Secrets
- Proveri da li je FTP pristup omogućen u Plesk-u

### Build Failed
- Proveri da li su sve environment variables postavljene u GitHub Secrets
- Proveri Console u GitHub Actions za specifičnu grešku

### Fajlovi se ne ažuriraju na serveru
- Proveri da li je `server-dir` putanja tačna (treba da bude `/httpdocs/`)
- Proveri FTP permissions u Plesk-u
