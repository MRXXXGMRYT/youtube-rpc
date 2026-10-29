# YouTube Rich Presence — Discord Self-Bot (Extension-Controlled)

A lightweight Discord **self-bot** (discord.js v14) that sets YouTube / YouTube Music Rich Presence on your personal account. Settings live in the **browser extension**, not in `.env`. Deployed on **Render** with `/healthz` keep-alive.

⚠️ **WARNING: Self-bot.** Using a user token with automation violates Discord's Terms of Service. Your account **can be banned**. Use a throwaway account, not your main.

## How it works

1. **Browser extension** reads YouTube/YouTube Music DOM (title, channel, thumbnail, current time, duration, play state).
2. Extension **POSTs** track data to your Render bot webhook (`/webhook`).
3. **Render bot** receives it and sets your Discord presence, including **timestamps** (elapsed/total progress bar like Spotify).
4. Settings (toggles, exclusions, inclusions, buttons, timestamps) are configured in the extension's options page.

## Files

```
index.js                  # self-bot + express webhook + healthz server
package.json              # dependencies
.env.example              # DISCORD_TOKEN + RENDER_URL
render.yaml               # Render service definition
browser-extension/
  manifest.json
  content.js              # reads YouTube DOM
  background.js           # POSTs to webhook, holds settings
  options.html            # settings UI
README.md                 # this file
```

## Features

- Extension-controlled settings (no env var changes needed)
- **Timestamps** — Discord music progress bar (elapsed / total time)
- YouTube / YouTube Music service toggle
- Activity type: PLAYING / LISTENING / STREAMING / WATCHING
- Exclusions / inclusions (keyword matching)
- Video button, Channel button, "by" prefix, thumbnail
- `/healthz` for Render keep-alive

## Setup

### 1. Get your Discord user token

⚠️ Never share this token.

1. Open Discord in browser → DevTools (`Ctrl+Shift+I`) → **Network** tab
2. Refresh page, click any request → **Headers** → **Authorization**
3. Copy the token

### 2. Configure `.env`

```bash
cp .env.example .env
# Set DISCORD_TOKEN to your user token
# Set RENDER_URL to your Render app URL (after deploy)
```

### 3. Run locally

```bash
npm install
npm start
```

### 4. Install the extension

1. `chrome://extensions` → Developer mode → **Load unpacked** → select `browser-extension/`
2. Open the extension's **Options** page
3. Enter your Render webhook URL: `https://your-app.onrender.com`
4. Configure toggles, keywords, buttons → **Save**

### 5. Deploy to Render

1. Push to GitHub
2. Render → **Web Service** → connect repo
3. Add `DISCORD_TOKEN` env var (don't commit `.env`)
4. Deploy

## Timestamps

When a video/song is playing and `currentTime` + `duration` are available, Discord shows a progress bar:

```
▬▬▬▬▬▬▬▬▬▬●▬▬▬▬▬▬
0:45        3:20
```

This requires the YouTube page's `<video>` element to report duration/currentTime (works on standard watch pages and YouTube Music).

## Environment variables

| Variable | Example |
|----------|---------|
| `DISCORD_TOKEN` | `MTA...your user token...` |
| `RENDER_URL` | `https://your-app.onrender.com` |
| `PORT` | `10000` (Render sets automatically) |

## Notes

- Presence updates every ~3 seconds from the extension.
- Render free tier spins down after inactivity; use an external keep-alive (cron-job.org, UptimeRobot) to ping `/healthz`.
- Self-bots violate Discord ToS — use a throwaway account.

## License

MIT
