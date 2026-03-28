## 🚀 RAILWAY DEPLOYMENT GUIDE

GOOGLE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY
HEYGEN_API_KEY=YOUR_HEYGEN_API_KEY
INSTAGRAM_ACCESS_TOKEN=YOUR_INSTAGRAM_ACCESS_TOKEN
INSTAGRAM_BUSINESS_ACCOUNT_ID=YOUR_NUMERIC_ID_HERE
AIVIDEOAPI_ENABLED=true
AIVIDEOAPI_KEY=YOUR_AIVIDEOAPI_KEY

# Initialize git
git init
WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET
# Add all files (except those in .gitignore)
git add .

# Commit
git commit -m "AI Reel Agent - Production Ready"

# Create repo on GitHub (github.com/new)
# Then:
git remote add origin https://github.com/YOUR_USERNAME/ai-reel-agent.git
git branch -M main
git push -u origin main
```

---

### Step 2: Sign Up for Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Authorize Railway to access your repositories

---

### Step 3: Create New Project on Railway

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select the `ai-reel-agent` repository
4. Railway auto-detects Node.js and creates deployment

---

### Step 4: Configure Environment Variables

In Railway Dashboard:

1. Click the deployed app
2. Go to **Variables** tab
3. Add all 8 environment variables:

```
GOOGLE_GEMINI_API_KEY=AIzaSyD086W0_FBsAk0I_PqSzlBFCKoUnf5cfBE
HEYGEN_API_KEY=sk_V2_hgu_kvmYdGzEL90_XaZERwFfgkF0qZWrGdCKGtrkVQNvklOY
INSTAGRAM_ACCESS_TOKEN=EAAYO22hIEK0BQys8oEZCdA9JdaCCbGwChoyu67G8qrJs1PhVfMkASZCNze5EE8LuMDV0wdfZCZAIN3LiadwpHiUzu6iOsbKTs6qQ75lAkxVod1JEeX5RcpYXO9bAZC4OrpkaSnhsLAsIxoZAXrdhtyKrZBANU8SCaN8dGCaITqDMMw6flJYLZAcaGVNTbTEcmYZC7NJAnH6WYZBLZCRHNJ7mKWZCzOIyKzIKse4ZA7Da6KLWscwPZCbaWCJ7h6igbAiuqXOIDWG8wRi36Ry9acXa7LeueU
INSTAGRAM_BUSINESS_ACCOUNT_ID=YOUR_NUMERIC_ID_HERE ⚠️ CHANGE THIS
PORT=3000
NODE_ENV=production
DATABASE_PATH=./database.sqlite
WEBHOOK_SECRET=b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84
LOG_LEVEL=info
```

4. Click **Save**

---

### Step 5: Set Up GitHub Actions Secrets

For GitHub Actions to trigger the webhook:

1. Go to GitHub repo **Settings → Secrets and variables → Actions**

2. Add these secrets:

```
WEBHOOK_URL=https://YOUR-APP.railway.app/api/webhook/generate-daily-reel
WEBHOOK_SECRET=YOUR_RANDOM_WEBHOOK_SECRET
```

3. Replace `YOUR-APP` with your Railway app name

---

### Step 6: Get Your Railway App URL

In Railway Dashboard:

1. Click your app
2. Click **Deployments** tab
3. Look for **Public URL** (e.g., `https://ai-reel-agent-production.railway.app`)
4. Copy this URL

---

### Step 7: Verify Deployment

Test your live production server:

```bash
# Replace with your actual Railway URL
curl https://your-app.railway.app/api/health | jq '.'
```

Expected response:
```json
{
  "success": true,
  "status": "operational",
  "services": {
    "gemini": { "status": "healthy" },
    "heygen": { "status": "healthy" },
    "instagram": { "status": "warning" }
  }
}
```

---

### Step 8: Enable Daily Automatic Generation

The GitHub Actions workflow runs automatically at **8 AM UTC daily**.

To verify it's enabled:

1. Go to GitHub repo
2. Click **Actions** tab
3. Click **Daily Reel Generation**
4. Verify it's enabled
5. Check recent runs

---

### Step 9: Monitor Production

After deployment goes live:

1. **Railway Dashboard:** Watch app logs and restart count
2. **GitHub Actions:** Check scheduled workflow status
3. **Instagram:** Verify posts appear daily
4. **Meta Developers:** Monitor API quota usage

---

### 🔧 Troubleshooting

**Problem:** Deployment fails during build
```
→ Check Console tab in Railway for error messages
→ Usually: missing dependencies or Node version mismatch
→ Solution: Update package.json or engine version
```

**Problem:** App crashes after deployment
```
→ Check Railway Logs tab
→ Look for "Cannot find module" or environment variable errors
→ Solution: Add missing environment variable or dependency
```

**Problem:** GitHub Actions webhook not triggering
```
→ Verify WEBHOOK_URL is correct
→ Verify WEBHOOK_SECRET matches
→ Check GitHub Actions logs for HTTP response
```

**Problem:** New posts not appearing
```
→ Check Instagram Access Token expiry
→ Verify Business Account ID is numeric
→ Check Instagram API quota
```

---

### 📊 Cost Estimation

**Monthly costs on Railway:**

- **Free tier:** Up to $5 credit (usually covers small app)
- **Standard:** $5 base + usage (~$0-20/month for this app)
- **Database:** SQLite is file-based, no cost

**API costs:**

- **Gemini:** $0.075 per 1M input tokens (free tier: $300 credit)
- **HeyGen:** $0-20/month (10 videos/month with free tier)
- **Instagram:** Free (Graph API)

**Total estimate:** $15-50/month

---

### ✅ DEPLOYMENT COMPLETE

Once deployed:

1. ✅ Server runs 24/7
2. ✅ GitHub Actions triggers daily at 8 AM UTC
3. ✅ Reels auto-generate and post daily
4. ✅ Dashboard accessible at `/dashboard`

