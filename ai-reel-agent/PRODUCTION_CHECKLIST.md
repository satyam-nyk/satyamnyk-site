## 🚀 PRE-FLIGHT PRODUCTION CHECKLIST

### ✅ CRITICAL - MUST FIX BEFORE DEPLOYMENT

#### 1. Instagram Business Account ID ⚠️ 
**Current Status:** ❌ Using username `globaldailydose` instead of numeric ID

**What to do:**
- Go to [Meta Business Suite](https://business.facebook.com)
- Navigate to Instagram Settings
- Find your Instagram Business Account ID (numeric, e.g., `17841400963...`)
- Replace `INSTAGRAM_BUSINESS_ACCOUNT_ID=globaldailydose` with the numeric ID

**Why:** Instagram Graph API requires numeric account ID, not username

---

#### 2. Gemini API Quota Issue ⚠️
**Current Status:** Free tier quota exhausted

**What to do:** Choose ONE:
- **Option A (Recommended):** Add billing to Google Cloud project
  1. Go to [Google Cloud Console](https://console.cloud.google.com)
  2. Add payment method
  3. Free tier will get $300 credit
  
- **Option B:** Get new API key with separate project
  1. Create new Google Cloud project
  2. Generate new Gemini API key
  3. Update `GOOGLE_GEMINI_API_KEY` in production

**Why:** Script generation requires Gemini API access

---

#### 3. Instagram Access Token Expiry
**Current Status:** May expire 60 days after generation

**What to do:**
1. Check token expiry date in Meta App Dashboard
2. Set calendar reminder to refresh token before expiry
3. Or implement token refresh logic (currently manual)

**Why:** Expired token = no Instagram posts

---

### 🔒 SECURITY CHECKS

- [ ] `.env` file is in `.gitignore` ✅ (verified)
- [ ] API keys are NOT in GitHub ✅ (verified)
- [ ] Database file is in `.gitignore` ✅ (verified)
- [ ] WEBHOOK_SECRET is strong and unique ✅ (verified)

---

### 📦 DEPLOYMENT REQUIREMENTS

Before deploying, ensure:
- [ ] Node.js version ≥ 18.0.0 (currently: v25.8.1) ✅
- [ ] npm version ≥ 9.0.0 (currently: v11.11.0) ✅
- [ ] All dependencies installed (`npm install`) ✅
- [ ] `.env` file configured with all 6 variables ❓
- [ ] Database initialized locally (creates database.sqlite) ✅
- [ ] Server runs locally without errors: `node src/server.js` ✅

---

### 🌐 PRODUCTION ENVIRONMENT VARIABLES

Required for Railway/Heroku/Vercel:

```bash
GOOGLE_GEMINI_API_KEY=your_gemini_key
HEYGEN_API_KEY=your_heygen_key
INSTAGRAM_ACCESS_TOKEN=your_instagram_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=numeric_id_only ⚠️
PORT=3000
NODE_ENV=production
DATABASE_PATH=./database.sqlite
WEBHOOK_SECRET=your_webhook_secret
```

---

### 📅 RECURRING TASKS

After deployment, add to calendar:

- **Daily (8 AM UTC):** GitHub Actions automatically runs webhook
- **Weekly:** Monitor Instagram Posts API in Meta Dashboard
- **Monthly:** Check Gemini & HeyGen API usage and costs
- **Every 60 days:** Refresh Instagram Access Token before expiry
- **Quarterly:** Update dependencies: `npm update`

---

### ⚡ WHAT CAN GO WRONG IN PRODUCTION

1. **Instagram posting fails silently:** Check token expiry first
2. **No videos generated:** Gemini quota exhausted (uses cache fallback)
3. **Webhook not triggering:** Check GitHub Actions secrets
4. **Database locked:** SQLite not suitable for concurrent requests
5. **Out of memory:** Video generation on free tier hosting

---

### 📊 MONITORING LINKS

After deployment, set up alerts for:

1. **Meta Developers Dashboard:** [graph.instagram.com/debug_token](https://developers.facebook.com/tools/debug/accesstoken)
2. **Google Cloud Console:** Check Gemini API quota usage
3. **Railway/Hosting Dashboard:** Monitor app health and logs

---

### 🎯 VERIFICATION STEPS

After deploying to production:

```bash
# 1. Check production server is responding
curl https://your-domain.com/api/health

# 2. Verify all services are healthy (should all show "healthy")

# 3. Test webhook manually
curl -X POST https://your-domain.com/api/webhook/generate-daily-reel \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# 4. Check GitHub Actions dashboard for scheduled runs
```

---

### 🎬 CURRENT STATUS

✅ **Local:** Server running, first reel generated successfully
⏳ **Production:** Ready to deploy once Instagram Account ID is fixed

