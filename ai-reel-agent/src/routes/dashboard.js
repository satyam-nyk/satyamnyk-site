import express from 'express';
import crypto from 'crypto';

/**
 * Dashboard Routes
 * Provides API endpoints for real-time dashboard data and static HTML
 */
export function createDashboardRouter(database, apiLimiter, researchAgent, scriptAgent, videoAgent, instagramService) {
  const router = express.Router();
  const authSecret = process.env.DASHBOARD_AUTH_SECRET || process.env.WEBHOOK_SECRET || 'change-this-secret';
  const authUser = process.env.DASHBOARD_USERNAME || 'admin';
  const authPassword = process.env.DASHBOARD_PASSWORD || 'change-me';

  const signSession = (payload) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', authSecret).update(encoded).digest('base64url');
    return `${encoded}.${sig}`;
  };

  const verifySession = (token) => {
    if (!token || !token.includes('.')) return null;
    const [encoded, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', authSecret).update(encoded).digest('base64url');
    if (sig !== expected) return null;
    try {
      const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (!payload?.exp || Date.now() > payload.exp) return null;
      return payload;
    } catch {
      return null;
    }
  };

  const getCookie = (req, name) => {
    const raw = req.headers.cookie || '';
    const parts = raw.split(';').map((p) => p.trim());
    for (const part of parts) {
      if (part.startsWith(`${name}=`)) {
        return decodeURIComponent(part.substring(name.length + 1));
      }
    }
    return null;
  };

  const requireAuth = (req, res, next) => {
    const token = getCookie(req, 'reel_auth');
    const payload = verifySession(token);
    if (!payload) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      return res.redirect('/dashboard/login');
    }
    req.auth = payload;
    return next();
  };

  router.get('/login', (req, res) => {
    res.sendFile(new URL('../../public/dashboard-login.html', import.meta.url).pathname);
  });

  router.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username !== authUser || password !== authPassword) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const exp = Date.now() + (7 * 24 * 60 * 60 * 1000);
    const token = signSession({ username, exp });
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `reel_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=604800`);
    return res.json({ success: true });
  });

  router.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'reel_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return res.json({ success: true });
  });

  router.get('/api/auth/session', (req, res) => {
    const token = getCookie(req, 'reel_auth');
    const payload = verifySession(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'No active session' });
    }
    return res.json({ success: true, user: { username: payload.username } });
  });

  /**
   * GET /dashboard
   * Serve the dashboard HTML file
   */
  router.get('/', (req, res) => {
    const token = getCookie(req, 'reel_auth');
    const payload = verifySession(token);
    if (!payload) return res.redirect('/dashboard/login');
    return res.sendFile(new URL('../../public/dashboard.html', import.meta.url).pathname);
  });

  /**
   * GET /api/dashboard-data
   * Return all dashboard data in JSON format
   */
  router.get('/api/dashboard-data', requireAuth, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's post
      const todayPost = await database.getTodayPost();

      // Get API status
      const apiStatus = await apiLimiter.getStatus();

      // Get post statistics
      const postStats = await database.getAllPostStats();

      // Get queue stats
      const scriptQueueStats = await scriptAgent.getQueueStats();

      // Get video cache stats
      const videoCacheStats = await videoAgent.getCacheStats();

      // Get trending topics
      const trendingTopics = await researchAgent.getTrendingTopics(30, 10);

      // Get analytics for last 7 days
      const analytics = await database.getAnalytics(30);
      const insights = await database.getInsightsSummary(30);
      const recommendations = await database.getRecommendations(90);

      return res.json({
        success: true,
        timestamp: new Date().toISOString(),
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
          gemini: {
            used: apiStatus.gemini?.used || 0,
            remaining: apiStatus.gemini?.remaining || 0,
            limit: apiStatus.gemini?.limit || 50,
            status: apiStatus.gemini?.status || 'unknown',
          },
          heygen: {
            used: apiStatus.heygen?.used || 0,
            remaining: apiStatus.heygen?.remaining || 0,
            total: apiStatus.heygen?.total || 10,
            status: apiStatus.heygen?.status || 'unknown',
          },
          instagram: {
            used: apiStatus.instagram?.used || 0,
            remaining: apiStatus.instagram?.remaining || 0,
            limit: apiStatus.instagram?.limit || 200,
            status: apiStatus.instagram?.status || 'unknown',
          },
        },
        queue: {
          total: scriptQueueStats.total || 0,
          pending: scriptQueueStats.pending || 0,
          posted: scriptQueueStats.posted || 0,
        },
        cache: {
          totalCached: videoCacheStats.total_cached || 0,
          totalReuses: videoCacheStats.total_reuses || 0,
          avgReuses: videoCacheStats.avg_reuses || 0,
          methodsUsed: videoCacheStats.methods_used || 0,
        },
        trendingTopics: trendingTopics,
        analytics: analytics.map((a) => ({
          date: a.date,
          totalPosts: a.total_posts || 0,
          totalViews: a.total_views || 0,
          totalLikes: a.total_likes || 0,
          totalComments: a.total_comments || 0,
          totalShares: a.total_shares || 0,
          avgViewsPerPost: a.average_views_per_post || 0,
          avgEngagementRate: a.average_engagement_rate || 0,
        })),
        insights,
        recommendations,
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving dashboard data:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/dashboard-data/today-detail
   * Get detailed information about today's post
   */
  router.get('/api/dashboard-data/today-detail', requireAuth, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayPost = await database.getTodayPost();

      if (!todayPost) {
        return res.json({
          success: true,
          data: null,
          message: 'No post for today yet',
        });
      }

      let instagramAnalytics = null;
      if (todayPost.instagram_post_id) {
        instagramAnalytics = await instagramService.getPostAnalytics(todayPost.instagram_post_id);
      }

      return res.json({
        success: true,
        data: {
          ...todayPost,
          analytics: instagramAnalytics,
        },
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving today detail:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/dashboard-data/analytics/:days
   * Get analytics for specified number of days
   */
  router.get('/api/dashboard-data/analytics/:days', requireAuth, async (req, res) => {
    try {
      const days = Math.min(parseInt(req.params.days) || 30, 365);
      const analytics = await database.getAnalytics(days);

      return res.json({
        success: true,
        days,
        data: analytics.map((a) => ({
          date: a.date,
          totalPosts: a.total_posts || 0,
          totalViews: a.total_views || 0,
          totalLikes: a.total_likes || 0,
          totalComments: a.total_comments || 0,
          totalShares: a.total_shares || 0,
          avgViewsPerPost: a.average_views_per_post || 0,
          avgEngagementRate: a.average_engagement_rate || 0,
        })),
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving analytics:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/dashboard-data/queue-status
   * Get current script queue status
   */
  router.get('/api/dashboard-data/queue-status', requireAuth, async (req, res) => {
    try {
      const stats = await scriptAgent.getQueueStats();

      return res.json({
        success: true,
        data: {
          total: stats.total || 0,
          pending: stats.pending || 0,
          posted: stats.posted || 0,
          percentComplete: stats.total > 0 ? Math.round(((stats.posted || 0) / stats.total) * 100) : 0,
        },
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving queue status:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/dashboard-data/api-limits
   * Get current API limit status
   */
  router.get('/api/dashboard-data/api-limits', requireAuth, async (req, res) => {
    try {
      const status = await apiLimiter.getStatus();

      return res.json({
        success: true,
        data: {
          gemini: {
            used: status.gemini?.used || 0,
            remaining: status.gemini?.remaining || 0,
            limit: status.gemini?.limit || 50,
            percentUsed: status.gemini?.limit
              ? Math.round(((status.gemini?.used || 0) / status.gemini?.limit) * 100)
              : 0,
            status: status.gemini?.status || 'unknown',
          },
          heygen: {
            used: status.heygen?.used || 0,
            remaining: status.heygen?.remaining || 0,
            total: status.heygen?.total || 10,
            percentUsed: status.heygen?.total
              ? Math.round(((status.heygen?.used || 0) / status.heygen?.total) * 100)
              : 0,
            status: status.heygen?.status || 'unknown',
          },
          instagram: {
            used: status.instagram?.used || 0,
            remaining: status.instagram?.remaining || 0,
            limit: status.instagram?.limit || 200,
            percentUsed: status.instagram?.limit
              ? Math.round(((status.instagram?.used || 0) / status.instagram?.limit) * 100)
              : 0,
            status: status.instagram?.status || 'unknown',
          },
        },
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving API limits:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/dashboard-data/trending-topics
   * Get trending topics
   */
  router.get('/api/dashboard-data/trending-topics', requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit) || 10, 50);
      const topics = await researchAgent.getTrendingTopics(30, limit);

      return res.json({
        success: true,
        data: topics,
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving trending topics:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  router.get('/api/dashboard-data/posts', requireAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 25, 100);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const status = req.query.status || 'all';

      const [posts, total] = await Promise.all([
        database.getPostHistory(limit, offset, status),
        database.countPosts(status),
      ]);

      return res.json({
        success: true,
        data: posts,
        pagination: {
          limit,
          offset,
          total,
          hasMore: offset + posts.length < total,
        },
      });
    } catch (error) {
      console.error('[Dashboard] Error retrieving posts:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/api/dashboard-data/posts/:id', requireAuth, async (req, res) => {
    try {
      const postId = parseInt(req.params.id, 10);
      if (!postId) {
        return res.status(400).json({ success: false, error: 'Invalid post id' });
      }

      const post = await database.getPostById(postId);
      if (!post) {
        return res.status(404).json({ success: false, error: 'Post not found' });
      }

      let instagramAnalytics = null;
      if (post.instagram_post_id) {
        instagramAnalytics = await instagramService.getPostAnalytics(post.instagram_post_id);
      }

      return res.json({ success: true, data: { ...post, instagramAnalytics } });
    } catch (error) {
      console.error('[Dashboard] Error retrieving post detail:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/api/dashboard-data/insights/:days', requireAuth, async (req, res) => {
    try {
      const days = Math.min(parseInt(req.params.days, 10) || 30, 365);
      const insights = await database.getInsightsSummary(days);
      return res.json({ success: true, days, data: insights });
    } catch (error) {
      console.error('[Dashboard] Error retrieving insights:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/api/dashboard-data/recommendations/:days', requireAuth, async (req, res) => {
    try {
      const days = Math.min(parseInt(req.params.days, 10) || 90, 365);
      const data = await database.getRecommendations(days);
      return res.json({ success: true, days, data });
    } catch (error) {
      console.error('[Dashboard] Error retrieving recommendations:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
