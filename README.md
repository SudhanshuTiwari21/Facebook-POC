# Meta Login POC (Facebook · Instagram · Threads)

Three separate Vite web apps + one Express API.

| App | Folder | Dev port | API prefix |
|-----|--------|----------|------------|
| Facebook Pages + Messenger | `web-app/` | 5173 | `/api` |
| Instagram DMs | `instagram-app/` | 5174 | `/api/instagram` |
| Threads posts + replies | `threads-app/` | 5175 | `/api/threads` |

## Quick start

```bash
cd server && npm install
cd ../web-app && npm install
cd ../instagram-app && npm install
cd ../threads-app && npm install
cd ..
npm run dev
```

Or run one platform:

```bash
npm run dev:facebook
npm run dev:instagram
npm run dev:threads
```

## Environment (per app)

Each app has its own `.env` (copy from `.env.example`):

```env
VITE_FB_APP_ID=          # Meta app ID for that product
VITE_FB_CONFIG_ID=       # Facebook Login for Business configuration ID
VITE_FB_GRAPH_VERSION=v20.0
```

Use **separate Meta apps** (or separate Business Login configurations) for Facebook vs Instagram vs Threads, each with the right permissions in the configuration.

### Facebook (`web-app`)
- Permissions in config: `pages_show_list`, `pages_read_engagement`, `pages_messaging`, `pages_manage_metadata`, `business_management`, …

### Instagram (`instagram-app`)
- IG Professional linked to a Facebook Page
- Config permissions: `instagram_basic`, `instagram_manage_messages`, `pages_show_list`, `business_management`, …

### Threads (`threads-app`)
- Config permissions: `threads_basic`, `threads_manage_replies`, …
- UI lists your **threads** and **replies** (Threads is not Messenger-style DMs)

## ngrok (HTTPS)

Each app needs its own tunnel port (or one tunnel + path — simplest is separate tunnels):

```bash
ngrok http 5173   # Facebook
ngrok http 5174   # Instagram
ngrok http 5175   # Threads
```

Add each ngrok URL to that Meta app’s **App Domains**, **OAuth Redirect URIs**, and **JavaScript SDK allowed domains**.

## API

- Health: `GET http://localhost:8787/api/health`
- Facebook: existing `/api/*` routes
- Instagram: `/api/instagram/*`
- Threads: `/api/threads/*`

Sessions use separate cookies: `sid`, `ig_sid`, `th_sid`.
