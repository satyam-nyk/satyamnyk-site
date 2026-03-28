# Blog Auto-Scheduler Setup

This document explains how to set up automatic blog publishing using the Blog Auto-Scheduler.

## Overview

The Blog Auto-Scheduler automatically generates and publishes blog articles on a schedule without requiring manual admin intervention. It:

- Generates theme-aligned topic ideas weekly
- Runs SERP research on selected topics
- Generates SEO-optimized long-form articles
- Auto-publishes to the blog and optionally to Dev.to
- Sends email notifications on success/failure (same SMTP config as your reel agent)

## Setup

### Step 1: Configure Environment Variables

Add these variables to your Vercel project or `.env.local`:

```env
# Scheduler enablement
CRON_SECRET=your_secret_here  # Use for external cron calls (generate a strong random string)

# Email notifications (uses same SMTP as reel agent)
EMAIL_NOTIFICATIONS_ENABLED=true
SMTP_HOST=smtp.gmail.com           # or your email provider
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password        # Use app-specific password, not regular password
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=recipient@example.com     # Comma-separated for multiple recipients

# Optional scheduler settings
BLOG_ARTICLES_PER_RUN=3            # Articles to generate per run (default: 3)
BLOG_PUBLISH_DEVTO=true            # Publish to Dev.to as well (default: true)
BLOG_SCHEDULE_TIMES_UTC=1:09       # Day:Hour in UTC (1=Monday, 0=Sunday; 1:09 = Monday 9 AM)
                                    # Use comma-separated for multiple times: "1:09,3:09,5:09"
```

### Step 2: Choose a Cron Service

Since the blog runs on Vercel (serverless), we use an external cron service to trigger the scheduler.

#### Option A: EasyCron (Free, Recommended)

1. Go to [https://www.easycron.com](https://www.easycron.com)
2. Sign up for free
3. Create new cron job:
   - **URL**: `https://blog.satyamnyk.com/api/scheduler/cron`
   - **Method**: `POST`
   - **Request Headers**: Add header `X-Cron-Secret: your_secret_here` (from CRON_SECRET env)
   - **Cron Expression**: `0 9 * * 1` (Every Monday at 9 AM UTC)
4. Save and test

#### Option B: cron-job.org (Free)

1. Go to [https://cron-job.org](https://cron-job.org)
2. Sign up for free
3. Create new cronjob:
   - **URL**: `https://blog.satyamnyk.com/api/scheduler/cron`
   - **Request method**: `POST`
   - **Custom headers**: Add `X-Cron-Secret: your_secret_here`
   - **Execution time**: `0 9 * * 1` (Every Monday 9 AM UTC)
4. Save and enable

#### Option C: GitHub Actions (Free, Self-Hosted)

Create `.github/workflows/blog-scheduler.yml`:

```yaml
name: Blog Auto-Scheduler

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday 9 AM UTC

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger blog auto-batch
        run: |
          curl -X POST https://blog.satyamnyk.com/api/scheduler/cron \
            -H "X-Cron-Secret: ${{ secrets.BLOG_CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### Step 3: Verify Email Configuration

Test email setup before deploying:

```bash
# From content-engine directory
npm run dev

# Visit https://localhost:3000/admin and run "Run Auto Batch" manually
# Check your email for success/failure notification
```

## Usage

### Manual Trigger (Dashboard)

1. Go to https://blog.satyamnyk.com/admin
2. Click "Run Auto Batch"
3. Check email for completion notification

### Automatic Trigger (Scheduled)

Once cron service is configured, articles will publish automatically on schedule.

**Example timeline** (with Monday 9 AM UTC schedule):
- Monday 9:00 AM UTC: Cron job fires → Articles generated and published
- Email notification sent with success/failure details
- Next run: Following Monday 9 AM UTC

## Testing

### Test the cron endpoint directly:

```bash
curl -X POST https://blog.satyamnyk.com/api/scheduler/cron \
  -H "X-Cron-Secret: your_secret_here" \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "articlesGenerated": 3,
  "articlesPublished": 3,
  "duration": 45000,
  "message": "Auto-batch completed successfully"
}
```

### Check cron endpoint status:

```bash
curl -X GET https://blog.satyamnyk.com/api/scheduler/cron \
  -H "X-Cron-Secret: your_secret_here"
```

## Troubleshooting

### Email not sending?

- Verify SMTP credentials are correct
- Use app-specific passwords (not regular passwords) for Gmail
- Check EMAIL_NOTIFICATIONS_ENABLED=true
- Ensure EMAIL_TO is set with at least one recipient

### Articles not generating?

- Verify MongoDB connection (check MongoDB Atlas IP whitelist)
- Check OPENAI_API_KEY is valid and has credits
- Review server logs: Check `/admin` dashboard for errors
- Run test manually through admin panel first

### Cron job not firing?

- Verify CRON_SECRET matches what's sent in request header
- Check that URL is correct and publicly accessible
- Test cron endpoint manually via curl
- Check cron service dashboard for failed executions

## Configuration Examples

### Daily publishing (every day at 9 AM UTC)

```env
BLOG_SCHEDULE_TIMES_UTC=0:09,1:09,2:09,3:09,4:09,5:09
BLOG_ARTICLES_PER_RUN=1
```

Cron expression: `0 9 * * *`

### Twice a week (Monday & Thursday at 9 AM UTC)

```env
BLOG_SCHEDULE_TIMES_UTC=1:09,4:09
BLOG_ARTICLES_PER_RUN=3
```

Cron expression: `0 9 * * 1,4`

### Weekly (Friday at noon UTC)

```env
BLOG_SCHEDULE_TIMES_UTC=5:12
BLOG_ARTICLES_PER_RUN=4
```

Cron expression: `0 12 * * 5`

## Monitoring

Check email notifications for:
- ✅ **Success**: Articles generated, published count, duration
- ❌ **Failure**: Error message for debugging

For more detailed logs, check your Vercel deployment logs at https://vercel.com/dashboard

## Disabling the Scheduler

To temporarily disable the scheduler without removing cron job:

```env
EMAIL_NOTIFICATIONS_ENABLED=false
```

Or delete the cron job from your cron service dashboard.

## Questions?

Refer to:
- `/api/scheduler/cron` endpoint for more details
- Admin dashboard at `/admin` for manual testing
- Blog article list at `/blog` to verify publications
