# Hostinger Shared Hosting Deployment

This PHP fallback lets the dashboard work on Hostinger shared hosting without a live Node process.

## Upload

1. Upload the full `ai-reel-agent` folder to your Hostinger file manager.
2. Keep `database.sqlite` and `.env` inside `ai-reel-agent/`.
3. Serve files from `ai-reel-agent/public/`.

## Required files

- `ai-reel-agent/.env`
- `ai-reel-agent/database.sqlite`
- `ai-reel-agent/dashboard-config.php`
- `ai-reel-agent/public/dashboard.php`
- `ai-reel-agent/public/dashboard-login.php`
- `ai-reel-agent/public/dashboard-api.php`

## URLs

- Public microsite: `https://your-domain.com/ai-reel-agent/public/microsite.html`
- Dashboard login: `https://your-domain.com/ai-reel-agent/public/dashboard-login.php`
- Dashboard: `https://your-domain.com/ai-reel-agent/public/dashboard.php`

## Notes

- This PHP version reads analytics from `database.sqlite`.
- Manual posting from shared hosting is disabled.
- If your host does not support `pdo_sqlite`, this fallback will not work and you will need MySQL/PHP migration or a VPS.
