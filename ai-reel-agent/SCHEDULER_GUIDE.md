# 📅 Scheduler & Instagram Posting Guide

## 🚀 Deployment Status

Your AI Reel Agent is fully configured and ready for production!

- ✅ **Smart Hybrid Video Generation**: HeyGen → Free Stock Videos → Cache
- ✅ **Instagram Integration**: Always posts with caption + trending hashtags
- ✅ **Daily Scheduler**: Configured to run twice daily at 8 AM and 8 PM UTC
- ✅ **Railway Deployment**: Auto-deploys on GitHub push

---

## 📍 Scheduler Configuration

### Built-in Server Scheduler (Automatic)

**Schedule:** Every day at **8:00 AM UTC** and **8:00 PM UTC**
- **EST:** 3:00 AM and 3:00 PM
- **PST:** 12:00 AM and 12:00 PM
- **IST:** 1:30 PM and 1:30 AM

**Source:** `src/server.js` + `src/config/constants.js`

**How it works:**
1. Internal server scheduler triggers webhook at the next configured UTC slot
2. Sends POST request to your app: `/api/webhook/generate-daily-reel`
3. Server generates topic → script → video → Instagram post
4. All in ~5 seconds!

### Manual Trigger

Test the complete pipeline anytime:

```bash
# Option 1: Using curl
curl -X POST https://your-railway-url/api/webhook/generate-daily-reel \
  -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'

# Option 2: Local testing
curl -X POST http://localhost:3000/api/webhook/generate-daily-reel \
  -H "Authorization: Bearer b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## 🎥 Instagram Posting Details

### ✅ Caption Format (Always Included)

Every post automatically includes:

```
[Generated Script Content]
[2 Line Break]
#Reels #Trending #Viral #ForYou #FYP #Fyp #Explore #ExploreMore
```

**Example:**
```
Let me tell you about DIY Life Improvements 🎯
Here's why everyone is talking about this...
The amazing thing is...
Drop a like if you agree! ❤️

#Reels #Trending #Viral #ForYou #FYP #Fyp #Explore #ExploreMore
```

### 📊 Caption Metrics

- **Min Length:** 5 characters
- **Max Length:** 2,200 characters
- **Hashtags:** Top 8-15 trending hashtags included
- **Format:** Script + 2 newlines + hashtags

### 🧪 Test Instagram Posting

Test the posting without full generation:

```bash
# Test endpoint (includes caption + hashtags)
curl -X POST http://localhost:3000/api/webhook/test-instagram-post \
  -H "Authorization: Bearer b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response Example:**
```json
{
  "success": true,
  "message": "Test post successful! Video posted with caption and hashtags.",
  "data": {
    "postId": "17910...",
    "captionLength": 301,
    "status": "posted",
    "timestamp": "2026-03-13T10:45:22.123Z"
  }
}
```

---

## 🎬 Video Generation Tiers

### Tier 1: Premium (HeyGen) - Max 10/month
- **Cost:** $0 (free tier)
- **Quality:** AI Avatar video
- **Duration:** ~45 seconds
- **Triggered:** When HeyGen quota available

### Tier 2: Free (Stock Videos) - Unlimited
- **Cost:** $0 (free)
- **Quality:** Stock video + text overlay + audio
- **Duration:** ~30 seconds
- **Triggered:** When HeyGen exhausted

### Tier 3: Cache - Infinite Reuse
- **Cost:** $0 (already generated)
- **Quality:** Previously generated videos
- **Duration:** Varies
- **Triggered:** When both above fail

---

## 📊 Monitoring & Verification

### Check Today's Post

```bash
curl http://localhost:3000/api/health | jq '.todayPost'
```

### View Posted Videos

```bash
# SQLite query
sqlite3 database.sqlite "SELECT date, topic, generation_method, status FROM daily_posts ORDER BY date DESC LIMIT 5;"
```

### Expected Output

```
2026-03-13|DIY Life Improvements|stock-video-free|pending
2026-03-12|Money-Saving Tips|heygen-premium|posted
2026-03-11|Productivity Hacks|stock-video-free|posted
```

---

## ⚙️ Configuration Files

### Environment Variables (.env)

```bash
# Required for posting
INSTAGRAM_ACCESS_TOKEN=EAAYO...
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841444626132603
WEBHOOK_SECRET=b1e716fac616b3b37317995dee80b91995d25305ebbe30a21a0db54ddd217d84
```

### Instagram Hashtags (src/config/constants.js)

```javascript
HASHTAGS: [
  '#Reels',
  '#Trending',
  '#Viral',
  '#ForYou',
  '#FYP',
  '#Fyp',
  '#Explore',
  '#ExploreMore',
]
```

Customize these with your own trending hashtags!

---

## 🔄 Scheduler Changes

### To Change Schedule Time

Set UTC hours in `.env` using a comma-separated list:

```bash
DAILY_POST_TIMES_UTC=8,20
```

**Examples:**
- `DAILY_POST_TIMES_UTC=8,20` → 8:00 AM + 8:00 PM UTC (current)
- `DAILY_POST_TIMES_UTC=9,21` → 9:00 AM + 9:00 PM UTC
- `DAILY_POST_TIMES_UTC=6,12,18` → three runs/day
- `DAILY_POST_TIMES_UTC=0` → once daily at midnight UTC

---

## 🚨 Troubleshooting

### Post not being created?

1. Check Railway logs: `railway logs`
2. Verify scheduler secrets are set in GitHub
3. Manually trigger webhook to test

### Instagram posting failing?

1. Verify `INSTAGRAM_ACCESS_TOKEN` is valid
2. Check `INSTAGRAM_BUSINESS_ACCOUNT_ID` is numeric (not username)
3. Test with `/test-instagram-post` endpoint first
4. Check token hasn't expired (refresh if needed)

### Videos not generating?

1. Check HeyGen quota: `curl http://localhost:3000/api/health`
2. Gemini API might be rate limited (50/day free)
3. Check database logs for errors

---

## 📝 Endpoints Reference

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/webhook/generate-daily-reel` | POST | Full pipeline | Required |
| `/api/webhook/test-instagram-post` | POST | Test posting | Required |
| `/api/health` | GET | System status | Optional |
| `/dashboard` | GET | Web dashboard | Optional |

---

## 🎯 Next Steps

1. **Verify Scheduler**: Watch GitHub Actions run at 8 AM UTC today
2. **Monitor First Post**: Check your Instagram for the automated reel
3. **Adjust Hashtags**: Customize hashtags in `constants.js` for your niche
4. **Scale Content**: Increase posting frequency if desired

---

## 💰 Cost Summary

| Service | Cost | Quota | Status |
|---------|------|-------|--------|
| Gemini API | $0 | 50/day | ✅ Free tier |
| HeyGen | $0-50/mo | 10/month free | ✅ Tier 1 |
| Stock Videos (Pexels) | $0 | Unlimited | ✅ Free tier |
| Google TTS | $0 | Free tier | ✅ Free tier |
| Instagram Graph API | $0 | 200/day | ✅ Free tier |
| **Railway Hosting** | **$0-5/mo** | **Free tier** | **✅ Covered** |

**Monthly Cost: $0-5/month** (or $0 if under free tiers)

---

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Instagram Graph API Docs](https://developers.instagram.com/docs/instagram-api/)
- [Cron Expression Generator](https://crontab.guru/)
- [Railway Deployment Guide](../RAILWAY_DEPLOYMENT.md)

---

**Your system is production-ready! 🚀**
