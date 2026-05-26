# MediaFlow Bot — Oracle Cloud Deployment Guide

A complete, copy-paste walkthrough for deploying MediaFlow Bot on Oracle Cloud Always Free. No prior Oracle / Linux experience required. Everything you'll see below is **safe and reversible** until step 9 (DNS).

> Total time: ~30–45 minutes the first time.

---

## What you'll end up with

- An Ubuntu 22.04 server running 24/7 on Oracle's free tier
- The Telegram bot reachable via webhook (faster than polling)
- The admin dashboard at `https://yourdomain.com/admin`
- HTTPS via Let's Encrypt (free, auto-renewing)
- PM2 keeping the bot alive after crashes/reboots
- Daily yt-dlp auto-updates

---

## Step 1 — Create an Oracle Cloud account

1. Go to https://cloud.oracle.com → **Sign up**
2. Choose **Always Free** tier (no charges)
3. Pick a **Home Region** close to your users — for Cambodia: **Singapore** or **Tokyo** are best (lowest latency).
4. Verify with credit card (Oracle requires it but won't charge unless you upgrade).

✅ When done, you can log in at `https://cloud.oracle.com`.

---

## Step 2 — Create a VM instance

In the Oracle Cloud Console:

1. Top-left ☰ menu → **Compute** → **Instances** → **Create instance**
2. **Name**: `mediaflow-bot`
3. **Image**: Click **Change image** → choose **Canonical Ubuntu** → version **22.04**
4. **Shape**: Click **Change shape** → choose:
   - **Ampere ARM (`VM.Standard.A1.Flex`)** with `2 OCPU` and `12 GB memory` — this is the most generous Always Free shape
   - If ARM is unavailable, use `VM.Standard.E2.1.Micro` (AMD x64, 1 OCPU, 1 GB RAM) — still works, just smaller
5. **Networking**: leave defaults. Make sure **Assign a public IPv4 address** is checked.
6. **Add SSH keys**:
   - On Windows, open PowerShell:
     ```powershell
     ssh-keygen -t ed25519 -f $HOME\.ssh\oracle_mediaflow
     ```
     Press Enter for empty passphrase if you want.
   - Paste the contents of `$HOME\.ssh\oracle_mediaflow.pub` into Oracle's **Paste public keys** box.
7. Click **Create**. Wait until **Lifecycle State: RUNNING** (~30 seconds).

8. Copy the **Public IP Address** from the instance details page.

---

## Step 3 — Open the firewall in Oracle's network

By default, Oracle's "VCN" (virtual network) blocks ports 80 and 443. Fix it:

1. From the instance page, click the **Subnet** link (under "Primary VNIC")
2. Click your **Security List**
3. **Add Ingress Rules**:

| Source CIDR | Protocol | Destination Port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(Port 22 for SSH is already open by default.)

---

## Step 4 — Connect to the VM

From PowerShell on your Windows machine:

```powershell
ssh -i $HOME\.ssh\oracle_mediaflow ubuntu@YOUR_PUBLIC_IP
```

If you get "Permissions are too open" on Windows, run once:
```powershell
icacls "$HOME\.ssh\oracle_mediaflow" /inheritance:r /grant:r "$env:USERNAME:F"
```

You'll land at `ubuntu@mediaflow-bot:~$`. You're in.

---

## Step 5 — Push your project to GitHub (if not already)

From your Windows PowerShell, in the project folder:

```powershell
git init
git add .
git commit -m "MediaFlow Bot v1.0"
# Create a new EMPTY repo on github.com (don't add README/license)
git remote add origin https://github.com/YOUR_USER/mediaflow-bot.git
git branch -M main
git push -u origin main
```

If `.env` is in the repo by mistake, remove it:
```powershell
git rm --cached .env
git commit -m "chore: untrack .env"
git push
```

---

## Step 6 — Run the one-shot setup script

Back on the Oracle VM:

```bash
# Clone your repo
cd ~
git clone https://github.com/YOUR_USER/mediaflow-bot.git mediaflow
cd mediaflow

# Install everything (Node 20, PM2, yt-dlp, nginx, firewall)
bash deploy/setup.sh
```

This installs Node.js 20, PM2, yt-dlp + daily auto-update, nginx, opens firewall ports.

---

## Step 7 — Create your .env on the server

```bash
cd ~/mediaflow
cp .env.example .env
nano .env
```

Fill in **all** of these with real values:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `PUBLIC_URL` | `https://yourdomain.com` |
| `TELEGRAM_TOKEN` | from @BotFather |
| `TELEGRAM_WEBHOOK_DOMAIN` | `https://yourdomain.com` |
| `MONGO_URI` | your Atlas SRV string (with database name `/mediaflow`) |
| `JWT_SECRET` | a long random string (run `openssl rand -hex 32`) |
| `COOKIE_SECRET` | another long random string |
| `ADMIN_EMAIL` | your real email |
| `ADMIN_PASSWORD` | your strong real password |

Save with **Ctrl+O**, **Enter**, **Ctrl+X**.

> Tip: in nano, paste with right-click. To validate it saved properly:
> ```bash
> cat .env | grep -E 'TELEGRAM_TOKEN|MONGO_URI|ADMIN_EMAIL'
> ```

---

## Step 8 — Whitelist your Oracle IP in MongoDB Atlas

Atlas blocks unknown IPs by default. So:

1. https://cloud.mongodb.com → your project → **Network Access**
2. **Add IP Address** → enter your Oracle VM's public IP → save
3. Or for first-time simplicity: **Allow Access from Anywhere** (`0.0.0.0/0`). You can lock down later.

Verify from the VM:
```bash
node src/scripts/testMongo.js
```
Expected: `✅ Connected. Connected to database: mediaflow`.

---

## Step 9 — Deploy with PM2

```bash
cd ~/mediaflow
bash deploy/deploy.sh
```

This installs deps, builds Tailwind CSS, seeds the admin, and starts PM2.

```bash
pm2 status                  # both processes running?
pm2 logs mediaflow-app      # live log
curl localhost:3000/healthz # → {"ok":true,"ts":...}
```

Make PM2 auto-start on reboot:
```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# copy-paste the printed `sudo env PATH=...` command and run it
pm2 save
```

---

## Step 10 — Point your domain at the VM

You need a domain (Namecheap/Cloudflare/etc, ~$5/year, or use any free DNS provider).

1. In your DNS provider, create an **A record**:
   - Name: `bot` (or `@` for the root)
   - Value: your Oracle VM **public IP**
   - TTL: 300
2. Wait 1–5 minutes for propagation. Test:
   ```bash
   nslookup bot.yourdomain.com
   ```
   It should return your Oracle IP.

> Don't have a domain yet? You can still test by hitting `http://YOUR_PUBLIC_IP:3000/healthz` directly. But you can't get HTTPS without a domain.

---

## Step 11 — Configure Nginx

```bash
# Replace the placeholder with your real domain
sudo cp ~/mediaflow/deploy/nginx.conf /etc/nginx/sites-available/mediaflow
sudo sed -i "s/bot.example.com/bot.yourdomain.com/g" /etc/nginx/sites-available/mediaflow

# Enable the site, disable the default welcome page
sudo ln -sf /etc/nginx/sites-available/mediaflow /etc/nginx/sites-enabled/mediaflow
sudo rm -f /etc/nginx/sites-enabled/default

# Test config + reload
sudo nginx -t && sudo systemctl reload nginx
```

> If nginx -t complains about SSL cert files not existing, that's expected — certbot will create them in step 12. Comment the two `ssl_certificate*` lines temporarily, run certbot, then they'll be filled in automatically.

Quick test (without HTTPS yet):
```bash
curl -H "Host: bot.yourdomain.com" http://localhost/healthz
```

---

## Step 12 — Free SSL with Let's Encrypt

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bot.yourdomain.com
```

Follow the prompts. When asked, choose **redirect HTTP → HTTPS** (option 2). Certbot rewrites your nginx config and installs the cert.

Auto-renewal is already set up by the certbot package. Verify:
```bash
sudo systemctl list-timers | grep certbot
```

---

## Step 13 — Switch the bot to webhook mode

You set `TELEGRAM_WEBHOOK_DOMAIN` in `.env` already. Now restart so it registers the webhook:

```bash
pm2 restart mediaflow-app --update-env
pm2 logs mediaflow-app --lines 20
```

You should see: `🌍 Telegram bot starting in WEBHOOK mode`. Telegram will start delivering updates over HTTPS — much faster than polling.

To verify Telegram sees your webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_TELEGRAM_TOKEN>/getWebhookInfo"
```
Expected: `"url":"https://bot.yourdomain.com/api/bot/<token>"` and `"pending_update_count":0`.

---

## Step 14 — Smoke test

| What | Command / URL | Expect |
|---|---|---|
| Health | `https://bot.yourdomain.com/healthz` | `{"ok":true}` |
| Admin login | `https://bot.yourdomain.com/admin/login` | login form |
| Bot | Telegram, send `/start` | welcome message |
| TikTok | send a TikTok URL | video |
| Facebook reel | send a FB reel URL | video |
| Instagram reel | send an IG reel URL | video |
| YouTube audio | toggle in `/settings`, then send YT link | audio file |

---

## Updates and ongoing operations

### Deploy a new version
```bash
cd ~/mediaflow
git pull
bash deploy/deploy.sh
```

### View logs
```bash
pm2 logs                        # all live logs
pm2 logs mediaflow-app          # bot/app only
pm2 logs --err                  # only errors
tail -f logs/error-*.log        # winston file logs
```

### Restart / stop
```bash
pm2 restart mediaflow-app
pm2 stop all
pm2 start all
```

### Check resource usage
```bash
pm2 monit
htop                            # system-wide (sudo apt install htop)
```

---

## Production checklist

- [ ] `JWT_SECRET` and `COOKIE_SECRET` are 32+ random characters (run `openssl rand -hex 32`)
- [ ] `ADMIN_PASSWORD` is strong and unique
- [ ] Atlas Network Access allowlist includes your Oracle VM IP (don't leave `0.0.0.0/0` long-term)
- [ ] `.env` has mode `600`: `chmod 600 .env`
- [ ] `pm2 startup` was run + `pm2 save` after every config change
- [ ] `https://bot.yourdomain.com/healthz` returns OK
- [ ] Telegram `getWebhookInfo` shows your domain, no `last_error_message`
- [ ] `deploy.sh` runs cleanly end-to-end (`git pull && bash deploy/deploy.sh`)
- [ ] Disk usage check: `df -h` (logs/uploads should fit comfortably)
- [ ] Log rotation working: `ls -lh logs/` shows daily files, gzipped after 1 day
- [ ] Cron entry exists: `crontab -l | grep yt-dlp`

---

## Troubleshooting

### `pm2 logs` shows `MongoDB connection failed`
- Check IP allowlist on Atlas
- Check `.env` `MONGO_URI` typos
- Run `node src/scripts/testMongo.js` for a precise error

### `getWebhookInfo` shows `last_error_message: SSL error`
- Cert hasn't fully provisioned yet, run: `sudo certbot renew --dry-run`
- Make sure DNS A-record points to the VM's public IP

### `502 Bad Gateway` on the dashboard
- The app isn't running. `pm2 status` to confirm. `pm2 logs mediaflow-app`.

### YouTube audio fails: "yt-dlp not found"
- `which yt-dlp` should print `/usr/local/bin/yt-dlp` or similar
- If not: `pip3 install -U --break-system-packages yt-dlp`

### Bot returns nothing in Telegram
- `pm2 logs mediaflow-app` and look for `polling_error` or `webhook_error`
- Make sure `TELEGRAM_TOKEN` in `.env` matches BotFather exactly
- For webhook mode: confirm `https://bot.yourdomain.com/healthz` returns 200 from outside

### "Address already in use :::3000"
- Another process is using port 3000: `sudo lsof -i :3000` then `kill -9 <PID>`
- Or change `PORT` in `.env` and update `nginx.conf` upstream
