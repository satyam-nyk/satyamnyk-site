import express from 'express';

/**
 * Dashboard Routes
 * Provides API endpoints for real-time dashboard data and static HTML
 */
export function createDashboardRouter(database, apiLimiter, researchAgent, scriptAgent, videoAgent, instagramService) {
  const router = express.Router();
  const requireAuth = (req, res, next) => next();

  router.get('/login', (req, res) => {
    res.redirect('/dashboard.html');
  });

  router.post('/api/auth/login', (req, res) => {
    return res.json({ success: true });
  });

  router.post('/api/auth/logout', (req, res) => {
    return res.json({ success: true });
  });

  router.get('/api/auth/session', (req, res) => {
    return res.json({ success: true, user: { username: 'local-operator' } });
  });

  /**
   * GET /dashboard
   * Serve the dashboard HTML file
   */
  router.get('/', (req, res) => {
    return res.redirect('/dashboard.html');
  });

  /**
   * GET /api/dashboard-data
   * Return all dashboard data in JSON format
   */
  router.get('/api/dashboard-data', requireAuth, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [
        todayPost,
        latestStaticPost,
        apiStatus,
        postStats,
        scriptQueueStats,
        videoCacheStats,
        trendingTopics,
        analytics,
        insights,
        recommendations,
      ] = await Promise.all([
        database.getTodayPost(),
        database.getLatestStaticPost().catch(() => null),
        apiLimiter.getStatus(),
        database.getAllPostStats(),
        scriptAgent.getQueueStats(),
        videoAgent.getCacheStats(),
        researchAgent.getTrendingTopics(30, 10),
        database.getAnalytics(30),
        database.getInsightsSummary(30),
        database.getRecommendations(90),
      ]);

      const llmStatus = apiStatus.mistral || apiStatus.gemini || {};

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
            used: llmStatus.used || 0,
            remaining: llmStatus.remaining || 0,
            limit: llmStatus.limit || 50,
            status: llmStatus.status || 'unknown',
          },
          mistral: {
            used: apiStatus.mistral?.used || 0,
            remaining: apiStatus.mistral?.remaining || 0,
            limit: apiStatus.mistral?.limit || 200,
            status: apiStatus.mistral?.status || 'unknown',
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
        staticPost: latestStaticPost,
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
      const llmStatus = status.mistral || status.gemini || {};

      return res.json({
        success: true,
        data: {
          gemini: {
            used: llmStatus.used || 0,
            remaining: llmStatus.remaining || 0,
            limit: llmStatus.limit || 50,
            percentUsed: llmStatus.limit
              ? Math.round(((llmStatus.used || 0) / llmStatus.limit) * 100)
              : 0,
            status: llmStatus.status || 'unknown',
          },
          mistral: {
            used: status.mistral?.used || 0,
            remaining: status.mistral?.remaining || 0,
            limit: status.mistral?.limit || 200,
            percentUsed: status.mistral?.limit
              ? Math.round(((status.mistral?.used || 0) / status.mistral?.limit) * 100)
              : 0,
            status: status.mistral?.status || 'unknown',
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
