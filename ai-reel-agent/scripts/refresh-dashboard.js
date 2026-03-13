import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import Database from '../src/database/db.js';
import APILimiter from '../src/services/api-limiter.js';
import InstagramService from '../src/services/instagram-service.js';
import ScriptAgent from '../src/agents/script-agent.js';
import VideoAgent from '../src/agents/video-agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = process.env.DATABASE_PATH || path.join(projectRoot, 'database.sqlite');
const outputPath = path.join(projectRoot, 'public', 'dashboard-data.json');

function mapStatus(status, fallbackTotal, keyForLimit = 'limit') {
  if (!status) {
    return { used: 0, remaining: fallbackTotal, [keyForLimit]: fallbackTotal, status: 'unknown' };
  }
  const used = status.used || 0;
  const remaining = status.remaining ?? fallbackTotal;
  const total = status.limit || status.total || fallbackTotal;
  return {
    used,
    remaining,
    [keyForLimit]: total,
    status: status.status || 'unknown',
    ...(keyForLimit === 'total' ? {} : {}),
  };
}

function serializeAnalytics(rows) {
  return rows.map((a) => ({
    date: a.date,
    totalPosts: a.total_posts || 0,
    totalViews: a.total_views || 0,
    totalLikes: a.total_likes || 0,
    totalComments: a.total_comments || 0,
    totalShares: a.total_shares || 0,
    avgViewsPerPost: a.average_views_per_post || 0,
    avgEngagementRate: a.average_engagement_rate || 0,
  }));
}

async function syncInstagramAnalytics(database, instagramService) {
  if (!instagramService) {
    return { attempted: false, updated: 0, failed: 0, total: 0, reason: 'Instagram credentials not configured' };
  }

  const posts = await new Promise((resolve, reject) => {
    database.db.all(
      `SELECT id, date, instagram_post_id FROM daily_posts
       WHERE status = 'posted' AND instagram_post_id IS NOT NULL AND instagram_post_id != ''
       AND date >= date('now', '-90 days')
       ORDER BY date DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });

  let updated = 0;
  let failed = 0;

  for (const post of posts) {
    try {
      const analytics = await instagramService.getPostAnalytics(post.instagram_post_id);
      await database.updatePostAnalytics(
        post.instagram_post_id,
        analytics.views,
        analytics.likes,
        analytics.comments,
        analytics.shares
      );
      updated += 1;
    } catch (error) {
      failed += 1;
      console.warn(`[Dashboard Refresh] Failed to sync ${post.instagram_post_id}: ${error.message}`);
    }
  }

  return { attempted: true, updated, failed, total: posts.length };
}

async function buildSnapshot() {
  const database = new Database(dbPath);
  await database.initDB();

  try {
    const apiLimiter = new APILimiter(database);
    const scriptAgent = new ScriptAgent(null, database, apiLimiter);
    const videoAgent = new VideoAgent(null, database, apiLimiter);

    const instagramService = process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID
      ? new InstagramService(process.env.INSTAGRAM_ACCESS_TOKEN, process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID, apiLimiter)
      : null;

    const sync = await syncInstagramAnalytics(database, instagramService);

    const [todayPost, apiStatus, postStats, queueStats, cacheStats, insights, recommendations, analytics, history] = await Promise.all([
      database.getTodayPost(),
      apiLimiter.getStatus(),
      database.getAllPostStats(),
      scriptAgent.getQueueStats().catch(() => ({ total: 0, pending: 0, posted: 0 })),
      videoAgent.getCacheStats().catch(() => ({ total_cached: 0, total_reuses: 0, avg_reuses: 0, methods_used: 0 })),
      database.getInsightsSummary(30),
      database.getRecommendations(90),
      database.getAnalytics(30),
      database.getPostHistory(250, 0, 'all'),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const snapshot = {
      success: true,
      generatedAt: new Date().toISOString(),
      today: {
        date: today,
        post: todayPost || null,
        status: todayPost?.status || 'not_started',
      },
      stats: {
        totalPosts: postStats.total_posts || 0,
        totalViews: postStats.total_views || 0,
        totalLikes: postStats.total_likes || 0,
        totalComments: postStats.total_comments || 0,
        totalShares: postStats.total_shares || 0,
        avgViews: postStats.avg_views || 0,
        avgEngagementRate: postStats.avg_engagement_rate || 0,
      },
      apiUsage: {
        gemini: mapStatus(apiStatus.gemini, 50, 'limit'),
        heygen: mapStatus(apiStatus.heygen, 10, 'total'),
        instagram: mapStatus(apiStatus.instagram, 200, 'limit'),
      },
      queue: {
        total: queueStats.total || 0,
        pending: queueStats.pending || 0,
        posted: queueStats.posted || 0,
      },
      cache: {
        totalCached: cacheStats.total_cached || 0,
        totalReuses: cacheStats.total_reuses || 0,
        avgReuses: cacheStats.avg_reuses || 0,
        methodsUsed: cacheStats.methods_used || 0,
      },
      trendingTopics: insights.topTopics || [],
      analytics: serializeAnalytics(analytics),
      insights,
      recommendations,
      history,
      sync,
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(`[Dashboard Refresh] Wrote snapshot to ${outputPath}`);
    console.log(`[Dashboard Refresh] Sync status: attempted=${sync.attempted} updated=${sync.updated} failed=${sync.failed}`);
  } finally {
    await database.closeDB();
  }
}

buildSnapshot().catch((error) => {
  console.error('[Dashboard Refresh] Failed:', error);
  process.exit(1);
});