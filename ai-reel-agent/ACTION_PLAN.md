## 🎯 YOUR ACTION PLAN - PRODUCTION DEPLOYMENT

### ⏰ TIME REQUIRED: ~30 minutes

---

## STEP 1: Fix Instagram Business Account ID ⚠️ (5 mins)

**Status:** ❌ Currently broken - using username instead of numeric ID

**Action:**
1. Open [GET_INSTAGRAM_ACCOUNT_ID.md](./GET_INSTAGRAM_ACCOUNT_ID.md) for detailed instructions
2. Get your numeric Instagram Business Account ID (17841XXXXXXXXX)
3. Edit `.env` file and replace:
   ```
   INSTAGRAM_BUSINESS_ACCOUNT_ID=globaldailydose
   ```
   With:
   ```
   INSTAGRAM_BUSINESS_ACCOUNT_ID=17841XXXXXXXXX
   ```
4. Run verification:
   ```bash
   node verify-production.js
   ```
   Should show all ✅ now

---

## STEP 2: Update NODE_ENV to Production (1 min)

**Action:**
1. Edit `.env` file
2. Change:
   ```
   NODE_ENV=development
   ```
   To:
   ```
   NODE_ENV=production
   ```

---

## STEP 3: Create GitHub Repository (5 mins)

**Action:**
```bash
# From your ai-reel-agent directory:
git init
git add .
git commit -m "🎬 AI Reel Agent - Production Ready"

# Go to github.com/new and create 'ai-reel-agent' repo
# Then run:
git remote add origin https://github.com/YOUR_USERNAME/ai-reel-agent.git
git branch -M main
git push -u origin main
```

---

## STEP 4: Deploy to Railway (10 mins)

**Action:**
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select `ai-reel-agent`
5. Railway auto-deploys (watch the build progress)

---

## STEP 5: Add Environment Variables to Railway (5 mins)

**Action:**
1. In Railway Dashboard, click your app
2. Go to **Variables** tab
3. Click **Raw Editor**
4. Copy & paste your entire `.env` file content
5. Click **Save**

---

## STEP 6: Set Up GitHub Actions Secrets (3 mins)

**Action:**
1. In GitHub repo, go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add THREE secrets:

   **Secret 1:**
   - Name: `WEBHOOK_SECRET`
   - Value: `b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84`

   **Secret 2:**
   - Name: `WEBHOOK_URL`
   - Value: `https://YOUR-RAILWAY-APP.railway.app/api/webhook/generate-daily-reel`
   - Find the Railway app URL in Railway Dashboard under your app

   **Secret 3:**
   - Name: `WEBHOOK_URL_BATCH`
   - Value: `https://YOUR-RAILWAY-APP.railway.app/api/webhook/batch-process`
   - (Same Railway URL but different endpoint)

3. Click **Save** for each secret

---

## STEP 7: Verify Deployment Works (3 mins)

**Action:**
1. Get your Railway app URL:
   - In Railway Dashboard, click your app
   - Look for **Public URL** in Deployments
   
2. Test health endpoint:
   ```bash
   curl https://YOUR-RAILWAY-APP.railway.app/api/health | jq '.'
   ```
   
   Expected: All services show `"healthy": true` (except Instagram may show warning)

3. Test webhook manually:
   ```bash
   curl -X POST https://YOUR-RAILWAY-APP.railway.app/api/webhook/generate-daily-reel \
     -H "Authorization: Bearer b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84" \
     -H "Content-Type: application/json" \
     -d '{}'
   ```
   
   Expected: `"success": true` response

---

## 🔄 AUTOMATED WORKFLOW (After Setup)

Once deployed, this runs automatically:

```
Every day at 8 AM UTC:
  ↓
GitHub Actions triggers webhook
  ↓
Server generates topic (or uses cache)
  ↓
Server generates script (or uses template)
  ↓
Server generates/reuses video
  ↓
Server posts to Instagram
  ↓
Dashboard updates with metrics
```

---

## ⏱️ PRODUCTION CHECKLIST

Before deploying, verify:

- [ ] Instagram Business Account ID is numeric (no errors from verify-production.js)
- [ ] NODE_ENV set to `production`
- [ ] All 8 environment variables configured
- [ ] GitHub repository created and code pushed
- [ ] Railway app deployed successfully
- [ ] GitHub Actions secrets added
- [ ] Health endpoint returns `healthy` status

---

## 📊 MONITORING AFTER DEPLOYMENT

Daily tasks (minimal):
- ✅ Reels post automatically (GitHub Actions handles it)
- ✅ Dashboard updates automatically
- ⚠️ Check Instagram occasionally for posts

Monthly tasks:
- Check API usage costs
- Refresh Instagram token before 60-day expiry
- Update dependencies: `npm update`

---

## 🆘 HELP & SUPPORT

### Common Issues:

**Q: Instagram posting returns error**
- A: Check if token is expired (60 days old limit)
- A: Verify Business Account ID is numeric

**Q: No reels generated**
- A: Check GitHub Actions logs
- A: Verify webhook URL is correct

**Q: Server crashes on Railway**
- A: Check Railway logs for error
- A: Verify all environment variables are set

---

## 🎉 SUCCESS CRITERIA

When you're done:

✅ `https://YOUR-APP.railway.app/api/health` returns green  
✅ Daily reel generated at 8 AM UTC without manual intervention  
✅ Reel appears on Instagram account  
✅ Dashboard shows daily metrics  

---

## 🚀 NEXT STEPS

1. **Right now:** Get your Instagram Business Account ID (see GET_INSTAGRAM_ACCOUNT_ID.md)
2. **Today:** Complete steps 1-6 above
3. **Tomorrow:** Verify the 8 AM UTC automatic generation works
4. **This week:** Check Instagram posts appear daily

