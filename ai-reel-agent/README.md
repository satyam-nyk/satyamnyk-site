## 🎬 AI Reel Agent - Production Ready

Automated Instagram Reel Generator using Google Gemini, HeyGen, and Instagram Graph API

### ⚡ Quick Status

**Local Development:** ✅ Operational  
**Production Ready:** ⚠️ 2 Tasks Required (see ACTION_PLAN.md)

---

## 🚀 Getting Started

### For First-Time Setup:
1. Read [ACTION_PLAN.md](./ACTION_PLAN.md) - Your step-by-step guide
2. Complete all 7 steps (takes ~30 minutes)
3. System will auto-generate reels daily at 8 AM UTC

### For Checking Production Status:
```bash
# Run verification
node verify-production.js

# Start server locally
node src/server.js

# Test webhook
curl -X POST http://localhost:3000/api/webhook/generate-daily-reel \
  -H "Authorization: Bearer b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 📋 What You Need to Do NOW

### ⚠️ BEFORE PRODUCTION DEPLOYMENT:

1. **Get Instagram Business Account ID**
   - ❌ Currently: `globaldailydose` (username - WRONG)
   - ✅ Should be: `17841XXXXXXXXX` (numeric - CORRECT)
   - See [GET_INSTAGRAM_ACCOUNT_ID.md](./GET_INSTAGRAM_ACCOUNT_ID.md)

2. **Fix .env file**
   - Change `NODE_ENV=development` → `NODE_ENV=production`
   - Update Instagram Business Account ID to numeric

3. **Create GitHub repo** and push code

4. **Deploy to Railway** (or Heroku/Vercel)

5. **Add GitHub Actions secrets**

See [ACTION_PLAN.md](./ACTION_PLAN.md) for detailed instructions.

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [ACTION_PLAN.md](./ACTION_PLAN.md) | **START HERE** - Your deployment roadmap |
| [GET_INSTAGRAM_ACCOUNT_ID.md](./GET_INSTAGRAM_ACCOUNT_ID.md) | How to get numeric Instagram ID |
| [RAILWAY_DEPLOYMENT.md](./RAILWAY_DEPLOYMENT.md) | Railway-specific deployment guide |
| [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) | Pre-flight verification list |

---

## 🎯 How It Works

```
GitHub Actions (Daily 8 AM UTC)
    ↓
Triggers Webhook → ResearchAgent
    ↓ (Generate topic or use cache)
ScriptAgent (Generate script or use template)
    ↓
VideoAgent (Generate video or use cached)
    ↓
Instagram Service (Post to account)
    ↓
Dashboard Updates (Real-time metrics)
```

---

## 🔄 Automatic Daily Workflow

Once deployed:

- **Every day at 8 AM UTC** → GitHub Actions triggers webhook
- **Topic Generation** → Uses Gemini API (with cache fallback)
- **Script Generation** → Uses Gemini API (with template fallback)
- **Video Generation** → Uses cached video (HeyGen is for expansion)
- **Instagram Posting** → Posts to your business account
- **Analytics Tracked** → Dashboard shows daily metrics

---

## 💾 Local Development

### Install Dependencies
```bash
npm install
```

### Run Server
```bash
node src/server.js
```

Server runs on `http://localhost:3000`

### Access Dashboard
```bash
open http://localhost:3000/dashboard
```

### Test Full Pipeline
```bash
node verify-production.js  # Check for issues
```

---

## 📁 Project Structure

```
ai-reel-agent/
├── src/
│   ├── server.js           # Main Express server
│   ├── database/
│   │   ├── db.js          # Database class
│   │   └── schema.sql     # Database schema
│   ├── services/          # API integrations
│   │   ├── gemini-service.js
│   │   ├── heygen-service.js
│   │   └── instagram-service.js
│   ├── agents/            # AI agents
│   │   ├── research-agent.js
│   │   ├── script-agent.js
│   │   └── video-agent.js
│   └── routes/
│       ├── webhook.js     # Webhook endpoints
│       └── dashboard.js   # Dashboard API
├── public/                # Frontend dashboard
├── .github/workflows/     # GitHub Actions
├── .env                   # Environment config (local)
├── package.json
└── README.md
```

---

## 🔐 Environment Variables

Required for production:

```bash
# API Keys
GOOGLE_GEMINI_API_KEY=your_gemini_key
HEYGEN_API_KEY=your_heygen_key
INSTAGRAM_ACCESS_TOKEN=your_instagram_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=numeric_id_only

# Configuration
PORT=3000
NODE_ENV=production
DATABASE_PATH=./database.sqlite

# Security
WEBHOOK_SECRET=your_secret_key
```

---

## 🚨 Important Notes

### Security
- ✅ `.env` file is in `.gitignore` - never committed
- ✅ API keys stored only in environment variables
- ✅ Database file is in `.gitignore` - never committed
- ✅ Webhook requires Authorization header

### Quotas & Limits
- **Gemini:** 50 requests/day (free tier) - Uses cache fallback
- **HeyGen:** 10 videos/month (paid) - Uses cached videos for efficiency
- **Instagram:** 200 requests/hour - No issues expected

### Instagram Constraints
- Tokens expire every 60 days - Set reminder to refresh
- Numeric Business Account ID required (not username)
- Videos must be 23-90 seconds (HeyGen handles this)

---

## 📊 Monitoring

After deployment:

1. **GitHub Actions** - Check workflow runs in Actions tab
2. **Railway Dashboard** - Monitor app health and logs
3. **Instagram Analytics** - Check post performance
4. **Database** - Tracked metrics available at `/dashboard`

---

## 🆘 Troubleshooting

**Issue:** `INSTAGRAM_BUSINESS_ACCOUNT_ID must be numeric`
```
Solution: Replace username with numeric ID from Meta Business Suite
```

**Issue:** GitHub Actions webhook fails
```
Solution: Check secrets are correct and Railway app is running
```

**Issue:** No reels posted to Instagram
```
Solution: Verify access token hasn't expired (60-day limit)
```

**Issue:** Server crashes on Railway
```
Solution: Check Railway logs for missing environment variables
```

---

## 📈 Cost Estimate

| Service | Cost/Month |
|---------|-----------|
| Railway Hosting | $0-10 (free tier usually) |
| Google Gemini | $0-5 (free tier: $300 credit) |
| HeyGen | $20-50 (10 videos/month included) |
| Instagram API | Free |
| **Total** | **$20-65/month** |

---

## 🎯 Next Steps

1. ✅ Run `node verify-production.js`
2. ✅ Fix any critical issues identified
3. ✅ Follow [ACTION_PLAN.md](./ACTION_PLAN.md)
4. ✅ Deploy to production
5. ✅ Monitor first automated run (8 AM UTC tomorrow)

---

## 🤝 Support

If you encounter issues:

1. Check [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
2. Review error in [TROUBLESHOOTING.md](#troubleshooting)
3. Check GitHub Actions and Railway logs
4. Verify all environment variables are set

---

**Last Updated:** March 13, 2026  
**Status:** Production Ready with 2 Tasks Required  

