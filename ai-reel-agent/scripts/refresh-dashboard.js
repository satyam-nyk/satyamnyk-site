import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import Database from '../src/database/db.js';
import APILimiter from '../src/services/api-limiter.js';
import InstagramService from '../src/services/instagram-service.js';
import YouTubeService from '../src/services/youtube-service.js';
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

async function syncYouTubeAnalytics(database, youtubeService) {
  if (!youtubeService) {
    return { attempted: false, updated: 0, failed: 0, total: 0, reason: 'YouTube not configured' };
  }

  const posts = await new Promise((resolve, reject) => {
    database.db.all(
      `SELECT id, date, youtube_video_id FROM daily_posts
       WHERE youtube_video_id IS NOT NULL AND youtube_video_id != ''
       ORDER BY date DESC`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });

  if (!posts.length) {
    return { attempted: true, updated: 0, failed: 0, total: 0 };
  }

  let updated = 0;
  let failed = 0;

  try {
    const items = await youtubeService.getVideoStats(posts.map((post) => post.youtube_video_id));
    const byId = new Map(items.map((item) => [item.id, item]));

    for (const post of posts) {
      const item = byId.get(post.youtube_video_id);
      if (!item) {
        failed += 1;
        continue;
      }

      const stats = item.statistics || {};
      await database.updatePostYouTubeAnalytics(
        post.youtube_video_id,
        Number(stats.viewCount || 0),
        Number(stats.likeCount || 0),
        Number(stats.commentCount || 0)
      );
      updated += 1;
    }
  } catch (error) {
    return { attempted: true, updated, failed: posts.length, total: posts.length, reason: error.message };
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
    const youtubeService = String(process.env.YOUTUBE_ENABLED || 'false').toLowerCase() === 'true'
      ? new YouTubeService({ apiLimiter })
      : null;

    const sync = await syncInstagramAnalytics(database, instagramService);
    const youtubeSync = await syncYouTubeAnalytics(database, youtubeService);

    let instagramAccount = null;
    let instagramMedia = [];
    if (instagramService) {
      [instagramAccount, instagramMedia] = await Promise.all([
        instagramService.getAccountInfo().catch(() => null),
        instagramService.getRecentMedia(25).catch(() => []),
      ]);
    }

    const [todayPost, latestStaticPost, apiStatus, postStats, queueStats, cacheStats, insights, recommendations, analytics, history] = await Promise.all([
      database.getTodayPost(),
      database.getLatestStaticPost().catch(() => null),
      apiLimiter.getStatus(),
      database.getAllPostStats(),
      scriptAgent.getQueueStats().catch(() => ({ total: 0, pending: 0, posted: 0 })),
      videoAgent.getCacheStats().catch(() => ({ total_cached: 0, total_reuses: 0, avg_reuses: 0, methods_used: 0 })),
      database.getInsightsSummary(30),
      database.getRecommendations(90),
      database.getAnalytics(30),
      database.getPostHistory(250, 0, 'all'),
    ]);

    let youtubeChannel = null;
    let youtubeVideos = [];
    let youtubeAnalytics = null;
    if (youtubeService) {
      youtubeChannel = await youtubeService.getOwnChannel().catch(() => null);
      youtubeVideos = await youtubeService.getRecentUploads(25).catch(() => []);
      if (!youtubeVideos.length) {
        const ids = history.map((row) => row.youtube_video_id).filter(Boolean);
        youtubeVideos = ids.length ? await youtubeService.getVideoStats(ids).catch(() => []) : [];
      }
      youtubeAnalytics = await youtubeService.getChannelAnalytics(28).catch(() => null);
    }

    const today = new Date().toISOString().split('T')[0];
    const kpi = insights?.kpi || {};
    const dbTotalPosts = kpi.total_posts ?? postStats.total_posts ?? 0;
    const instagramTotalPosts = Number(instagramAccount?.media_count || 0);
    const snapshot = {
      success: true,
      generatedAt: new Date().toISOString(),
      today: {
        date: today,
        post: todayPost || null,
        status: todayPost?.status || 'not_started',
      },
      stats: {
        totalPosts: Math.max(dbTotalPosts, instagramTotalPosts),
        totalViews: kpi.total_views ?? postStats.total_views ?? 0,
        totalLikes: kpi.total_likes ?? postStats.total_likes ?? 0,
        totalComments: kpi.total_comments ?? postStats.total_comments ?? 0,
        totalShares: kpi.total_shares ?? postStats.total_shares ?? 0,
        avgViews: (kpi.total_posts && kpi.total_posts > 0)
          ? Number(((kpi.total_views || 0) / kpi.total_posts).toFixed(2))
          : (postStats.avg_views || 0),
        avgEngagementRate: kpi.avg_engagement_rate ?? postStats.avg_engagement_rate ?? 0,
      },
      apiUsage: {
        gemini: mapStatus(apiStatus.gemini, 50, 'limit'),
        heygen: mapStatus(apiStatus.heygen, 10, 'total'),
        instagram: mapStatus(apiStatus.instagram, 200, 'limit'),
        youtube: mapStatus(apiStatus.youtube, 10000, 'limit'),
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
      staticPost: latestStaticPost,
      history,
      instagram: {
        account: instagramAccount,
        recentMedia: instagramMedia,
      },
      youtube: {
        channel: youtubeChannel,
        recentVideos: youtubeVideos,
        analyticsEnabled: youtubeAnalytics?.analyticsEnabled ?? null,
        channelAnalytics: youtubeAnalytics ?? null,
        sync: youtubeSync,
      },
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