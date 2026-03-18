# PM2 Scheduler Setup

This keeps `src/server.js` alive for automatic reel scheduling even if the process crashes.

## 1) Install PM2 once

```bash
npm i -g pm2
```

## 2) Start app with PM2

```bash
cd /Users/lenovo/Downloads/satyamnyk-site/ai-reel-agent
npm run pm2:start
```

## 3) Save process list for reboot restore

```bash
npm run pm2:save
```

## 4) Enable startup on macOS

Run the command PM2 prints after this command (it includes sudo):

```bash
pm2 startup
```

Then run again:

```bash
npm run pm2:save
```

## Day-to-day commands

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
```

## Verify scheduler is healthy

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s http://127.0.0.1:3000/api/webhook/status
```

## Notes

- Scheduler times come from `DAILY_POST_TIMES_UTC` in `.env`.
- Current project setting uses UTC slots `0,6,12,18`.
- App environment variables are loaded from `.env` by `dotenv/config` in `src/server.js`.
