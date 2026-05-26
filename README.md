# MediaFlow Bot

> Production-grade Telegram media assistant + glassmorphism admin dashboard.
> Multilingual (English · Khmer · Polish · Korean), optimized for **Oracle Cloud Free Tier** and Cambodian mobile networks.

![status](https://img.shields.io/badge/status-production--ready-emerald)
![node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ What it does

MediaFlow Bot helps users handle media links on Telegram:

- 🎵 **TikTok** — HD videos with smart size fallback
- 📸 **Instagram** — Reels metadata (pluggable provider)
- 📘 **Facebook** — public videos & Reels metadata (pluggable)
- ▶️ **YouTube** — title, thumbnail, author metadata (audio extraction is an opt-in plugin)
- 🔗 URL conversion + link validation
- 🖼 Thumbnail preview
- 🧵 Batch processing via queue
- 🔌 Plugin architecture for new platforms

The bot runs alongside a beautiful admin dashboard at `/admin` for ops, analytics, broadcasts, and support.

## 🧱 Architecture

```
┌─────────────────────────┐         ┌──────────────────────┐
│  Telegram users         │ ◀─────▶ │  bot/index.js        │
└─────────────────────────┘         │   ↳ handlers, i18n   │
                                    └──────────┬───────────┘
                                               │ enqueue
                                               ▼
┌─────────────────────────┐         ┌──────────────────────┐
│  Admin (web)  /admin    │ ◀─────▶ │  Express app + EJS   │
└─────────────────────────┘         │   auth, csrf, rate   │
                                    └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Queue (inline or    │
                                    │  BullMQ + Redis)     │
                                    └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  Downloaders         │
                                    │  TikTok / IG / FB /  │
                                    │  YouTube (pluggable) │
                                    └──────────┬───────────┘
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  MongoDB Atlas       │
                                    │  Users, Media,       │
                                    │  Analytics, Tickets… │
                                    └──────────────────────┘
```

## 📁 Folder structure

```
mediaflow/
├─ ecosystem.config.js          # PM2 process file
├─ deploy/
│  ├─ nginx.conf                # Nginx reverse proxy
│  └─ ORACLE_DEPLOY.md          # Step-by-step Oracle Cloud guide
├─ public/                      # Static assets served by Express
│  ├─ css/admin.css
│  └─ js/admin.js
├─ logs/                        # Rotating logs (gitignored)
├─ uploads/                     # Temp media (gitignored)
├─ src/
│  ├─ server.js                 # Bootstrap entrypoint
│  ├─ app.js                    # Express app factory
│  ├─ config/
│  │  ├─ env.js                 # Validated env loader (Joi)
│  │  ├─ db.js                  # Mongoose connector
│  │  └─ redis.js               # Optional Redis (BullMQ)
│  ├─ bot/
│  │  ├─ index.js               # Telegram bot factory
│  │  ├─ handlers.js            # Command + message handlers
│  │  └─ keyboards.js           # Inline keyboards
│  ├─ controllers/              # Express controllers
│  ├─ routes/                   # admin.js, api.js
│  ├─ middleware/               # auth, errorHandler
│  ├─ models/                   # Mongoose schemas
│  ├─ services/                 # i18n, userService, mediaProcessor, downloaders/
│  ├─ queues/                   # Queue abstraction + worker
│  ├─ locales/                  # en, km, pl, ko JSON dictionaries
│  ├─ scripts/seedAdmin.js      # First-admin bootstrap
│  └─ views/admin/              # EJS dashboard pages
├─ .env.example
├─ package.json
└─ README.md
```

## 🚀 Quick start (local)

Prereqs: Node.js 18+, MongoDB Atlas connection string, a Telegram bot token from [@BotFather](https://t.me/BotFather).

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Fill in TELEGRAM_TOKEN, MONGO_URI, JWT_SECRET, COOKIE_SECRET

# 3. Bootstrap admin
npm run seed:admin

# 4. Start dev server
npm run dev
```

- Bot: send `/start` to your bot in Telegram
- Dashboard: http://localhost:3000/admin/login

## 🌐 Internationalization

Translation files live in `src/locales/{en,km,pl,ko}.json`. The bot picks the user's saved `languageCode` (default = Telegram's `language_code`, fallback `en`). Users can change it in `/language` or via the inline menu.

## ⚙️ Configuration reference

See `.env.example` for the full, validated list. Key flags:

| Variable | Default | What it does |
|---|---|---|
| `REDIS_ENABLED` | `false` | When true, BullMQ-backed queue is used |
| `TELEGRAM_WEBHOOK_DOMAIN` | empty | Empty = polling (dev). Set to HTTPS domain for webhook (prod). |
| `RATE_LIMIT_MAX` | `120` | API rate limit per window |

## 📊 Admin dashboard

Pages: Overview · Users · Analytics · Media · Logs · Languages · Settings · Broadcast · Support · API · Themes · Performance.
- JWT in **HttpOnly** cookie
- CSRF for all admin POSTs (csurf)
- Helmet, compression, rate-limited
- CSV export, search, pagination
- Charts via Chart.js

## 🛰 Production deploy (Oracle Cloud)

See [`deploy/ORACLE_DEPLOY.md`](deploy/ORACLE_DEPLOY.md) for the complete walkthrough (Ubuntu setup → Node → PM2 → Nginx → Certbot → webhook).

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔒 Security

- Helmet + CSP (script/style allowlist for Tailwind CDN + Chart.js)
- HttpOnly + Secure cookies (Secure auto-on in production)
- bcrypt password hashing
- CSRF on admin forms
- Per-user in-memory rate limiter for bot
- Express-level rate limit on `/api/*`
- Joi env validation; fail-fast on misconfig
- All secrets via `.env` (never committed)

## 🧪 Health & ops

- `GET /healthz` → `{ ok: true, ts }`
- Logs in `logs/` (rotated daily, 14d app / 30d errors)
- `pm2 monit`, `pm2 logs`

## 🛠 Extending downloaders

Each downloader is a tiny module under `src/services/downloaders/<platform>.js` exporting `{ fetch(url, opts), platform }`. Register it in `src/services/downloaders/index.js`. Plug your own provider into Instagram/Facebook/YouTube modules to enable real downloads.

## 📜 License

MIT. Respect each platform's terms of service. Do not enable downloads where prohibited by law or policy.
