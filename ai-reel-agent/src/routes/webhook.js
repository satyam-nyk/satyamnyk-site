import express from 'express';
import { STATUS, ERROR_MESSAGES, INSTAGRAM_CONFIG } from '../config/constants.js';
import fs from 'fs';

/**
 * Webhook Routes
 * Handles GitHub Actions and external trigger calls for daily reel generation
 */
export function createWebhookRouter(
  database,
  apiLimiter,
  researchAgent,
  scriptAgent,
  videoAgent,
  instagramService
) {
  const router = express.Router();
  let dailyGenerationInProgress = false;
  let manualPostInProgress = false;

  function getInstagramVideoInput(videoData) {
    if (videoData?.videoPath && fs.existsSync(videoData.videoPath)) {
      return videoData.videoPath;
    }

    return videoData?.videoUrl || videoData?.videoPath;
  }

  function buildInstagramCaption(scriptText) {
    const hashtags = INSTAGRAM_CONFIG.HASHTAGS.slice(0, 10).join(' ');
    const maxLen = INSTAGRAM_CONFIG.CAPTION_MAX_LENGTH || 2200;
    const baseScript = String(scriptText || '').replace(/\s+/g, ' ').trim();
    const reserved = hashtags.length + 2;
    const scriptMax = Math.max(100, maxLen - reserved);
    const safeScript = baseScript.length > scriptMax
      ? `${baseScript.slice(0, scriptMax - 1).trim()}…`
      : baseScript;
    return `${safeScript}\n\n${hashtags}`;
  }

  /**
   * Middleware to verify webhook signature
   */
  function verifyWebhookSignature(req, res, next) {
    const authHeader = req.headers.authorization;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[Webhook] WEBHOOK_SECRET not configured');
      return next(); // Skip verification if not configured
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const token = authHeader.substring(7);
    if (token !== webhookSecret) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden - Invalid webhook secret',
      });
    }

    next();
  }

  /**
   * POST /api/webhook/generate-daily-reel
   * Main webhook endpoint for daily reel generation
   * Triggers the full pipeline: research -> script -> video -> post
   */
  router.post('/generate-daily-reel', verifyWebhookSignature, async (req, res) => {
    if (dailyGenerationInProgress) {
      return res.status(429).json({ success: false, error: 'Daily generation already in progress' });
    }

    dailyGenerationInProgress = true;
    const startTime = Date.now();
    let postData = null;

    try {
      console.log('[Webhook] Received daily reel generation request');

      // Check today's post (don't regenerate if already exists)
      const today = new Date().toISOString().split('T')[0];
      const existingPost = await database.getTodayPost();

      if (existingPost && existingPost.status !== 'failed') {
        console.log('[Webhook] Today post already exists, skipping generation');
        return res.status(200).json({
          success: true,
          message: 'Post already exists for today',
          data: existingPost,
        });
      }

      // Step 1: Research Topic
      console.log('[Webhook] Step 1: Researching topic...');
      const topic = await researchAgent.researchTodaysTopic();
      if (!topic) {
        throw new Error('Failed to research topic');
      }

      // Step 1b: Generate static current-affairs post from yesterday's trend
      let staticPost = null;
      let staticPostPublishResult = null;
      try {
        const yesterdayTopic = await researchAgent.researchYesterdaysTrendingTopic();
        staticPost = await scriptAgent.generateStaticCurrentAffairsPost(yesterdayTopic);
        if (staticPost) {
          await database.upsertStaticPost(today, {
            ...staticPost,
            status: 'ready',
          });

          try {
            staticPostPublishResult = await instagramService.postStaticCurrentAffairs(
              staticPost.summary,
              staticPost.topic
            );
          } catch (staticPostError) {
            console.warn('[Webhook] Static Instagram post failed:', staticPostError.message);
          }
        }
      } catch (error) {
        console.warn('[Webhook] Static post generation skipped:', error.message);
      }

      // Step 2: Generate Script
      console.log('[Webhook] Step 2: Generating script...');
      const scriptData = await scriptAgent.generateScript(topic);
      if (!scriptData) {
        throw new Error('Failed to generate script');
      }

      // Step 3: Generate Video
      console.log('[Webhook] Step 3: Generating video...');
      const videoData = await videoAgent.generateVideoForDay({
        script: scriptData.script,
        videoPrompt: scriptData.videoPrompt,
        scenes: scriptData.scenes,
      });
      if (!videoData) {
        throw new Error('Failed to generate video or use cached video');
      }

      // Step 4: Post to Instagram
      console.log('[Webhook] Step 4: Posting to Instagram...');
      const caption = buildInstagramCaption(scriptData.script);
      const instagramVideoInput = getInstagramVideoInput(videoData);

      let instagramResult = null;
      try {
        instagramResult = await instagramService.postReel(instagramVideoInput, caption);
      } catch (error) {
        console.warn('[Webhook] Instagram posting failed:', error.message);
        // Continue even if Instagram fails, we'll store the draft
        instagramResult = null;
      }

      // Step 5: Store in database
      console.log('[Webhook] Step 5: Storing in database...');
      postData = {
        date: today,
        topic: topic.topic,
        script: scriptData.script,
        videoId: videoData.videoId,
        status: instagramResult ? STATUS.POSTED : STATUS.PENDING,
        method: videoData.generator,
      };

      await database.upsertDailyPost(today, postData);

      if (instagramResult) {
        await database.updatePostWithInstagram(today, instagramResult.postId, STATUS.POSTED);
      }

      const duration = Date.now() - startTime;

      console.log('[Webhook] Daily reel generation complete in', duration, 'ms');

      return res.status(200).json({
        success: true,
        message: 'Daily reel generated and posted successfully',
        data: {
          date: today,
          topic: topic.topic,
          staticPost,
          staticPostInstagram: staticPostPublishResult,
          videoId: videoData.videoId,
          postId: instagramResult?.postId || null,
          generator: videoData.generator,
          duration,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Webhook] Error in daily reel generation:', error.message);

      const duration = Date.now() - startTime;

      // Try to store failure status
      if (postData) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await database.upsertDailyPost(today, {
            ...postData,
            status: STATUS.FAILED,
          });
        } catch (dbError) {
          console.error('[Webhook] Error saving failure status:', dbError.message);
        }
      }

      return res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate daily reel',
        duration,
        timestamp: new Date().toISOString(),
      });
    } finally {
      dailyGenerationInProgress = false;
    }
  });

  /**
   * GET /api/webhook/status
   * Check system health and readiness
   */
  router.get('/status', async (req, res) => {
    try {
      const apiStatus = await apiLimiter.getStatus();
      const today = new Date().toISOString().split('T')[0];
      const todayPost = await database.getTodayPost();

      return res.status(200).json({
        success: true,
        system: {
          status: 'operational',
          timestamp: new Date().toISOString(),
        },
        apis: apiStatus,
        todayPost: {
          exists: !!todayPost,
          status: todayPost?.status || 'not_started',
        },
      });
    } catch (error) {
      console.error('[Webhook] Error checking status:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/webhook/batch-process
   * Trigger batch processing for the week (Sunday only)
   */
  router.post('/batch-process', verifyWebhookSignature, async (req, res) => {
    try {
      console.log('[Webhook] Received batch processing request');

      const today = new Date();
      if (today.getDay() !== 0) {
        // 0 = Sunday
        return res.status(400).json({
          success: false,
          error: 'Batch processing only runs on Sunday',
        });
      }

      // Run batch research
      const topics = await researchAgent.batchResearchWeekly();

      if (topics.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Failed to generate topics for batch processing',
        });
      }

      // Queue scripts for topics
      const queueResult = await scriptAgent.batchQueueScripts(topics);

      console.log('[Webhook] Batch processing complete');

      return res.status(200).json({
        success: true,
        message: 'Batch processing completed',
        data: {
          topicsGenerated: topics.length,
          scriptsQueued: queueResult.inserted,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Webhook] Error in batch processing:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/webhook/manual-post
   * Manually trigger posting of queued script
   */
  router.post('/manual-post', verifyWebhookSignature, async (req, res) => {
    if (manualPostInProgress) {
      return res.status(429).json({ success: false, error: 'Manual post already in progress' });
    }

    manualPostInProgress = true;
    try {
      console.log('[Webhook] Received manual post request');
      const forcePost = req.query.force === '1' || req.query.force === 'true';

      const today = new Date().toISOString().split('T')[0];
      const todayPost = await database.getTodayPost();
      if (!forcePost && todayPost?.status === STATUS.POSTED && todayPost?.instagram_post_id) {
        return res.status(409).json({
          success: false,
          error: 'A post already exists for today. Use ?force=1 to override.',
          data: {
            date: today,
            postId: todayPost.instagram_post_id,
          },
        });
      }

      // Get next queued script
      const script = await scriptAgent.getNextScript();
      if (!script) {
        return res.status(400).json({
          success: false,
          error: 'No queued scripts available',
        });
      }

      // Generate video
      const video = await videoAgent.generateVideoForDay({
        script: script.script,
        videoPrompt: script.hooks?.videoPrompt,
        scenes: script.hooks?.scenes,
      });
      if (!video) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate or retrieve video',
        });
      }

      // Post to Instagram
      const caption = buildInstagramCaption(script.script);
      const instagramVideoInput = getInstagramVideoInput(video);
      const instagramResult = await instagramService.postReel(instagramVideoInput, caption);

      if (!instagramResult) {
        return res.status(500).json({
          success: false,
          error: 'Failed to post to Instagram',
        });
      }

      // Update script status
      await database.updateScriptStatus(script.id, STATUS.POSTED, video.videoId, instagramResult.postId);

      // Mirror manual posting into daily_posts table for dedupe and dashboard accuracy
      await database.upsertDailyPost(today, {
        topic: script.topic,
        script: script.script,
        videoId: video.videoId,
        status: STATUS.POSTED,
        method: video.generator,
      });
      await database.updatePostWithInstagram(today, instagramResult.postId, STATUS.POSTED);

      console.log('[Webhook] Manual post successful');

      return res.status(200).json({
        success: true,
        message: 'Post created successfully',
        data: {
          scriptId: script.id,
          postId: instagramResult.postId,
          url: instagramResult.url,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Webhook] Error in manual post:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    } finally {
      manualPostInProgress = false;
    }
  });

  /**
   * POST /api/webhook/generate-static-current-affairs
   * Generates one <50-word static post from yesterday's trending current-affairs topic
   */
  router.post('/generate-static-current-affairs', verifyWebhookSignature, async (req, res) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const topic = await researchAgent.researchYesterdaysTrendingTopic();
      const staticPost = await scriptAgent.generateStaticCurrentAffairsPost(topic);

      if (!staticPost?.summary) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate static current-affairs post',
        });
      }

      await database.upsertStaticPost(today, {
        ...staticPost,
        status: 'ready',
      });

      let staticPostInstagram = null;
      try {
        staticPostInstagram = await instagramService.postStaticCurrentAffairs(
          staticPost.summary,
          staticPost.topic
        );
      } catch (error) {
        console.warn('[Webhook] Could not publish static post to Instagram:', error.message);
      }

      return res.status(200).json({
        success: true,
        message: 'Static current-affairs post generated',
        data: {
          ...staticPost,
          instagram: staticPostInstagram,
        },
      });
    } catch (error) {
      console.error('[Webhook] Error generating static current-affairs post:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/webhook/test-instagram-post
   * Test endpoint to post a sample video with caption and hashtags
   * For testing/debugging purposes only
   */
  router.post('/test-instagram-post', verifyWebhookSignature, async (req, res) => {
    try {
      console.log('[Webhook] Received test Instagram post request');

      // Build caption with script and hashtags
      const testScript = `🎯 AI-Generated Daily Content

Today's trending topic brings practical insights:
✨ Carefully researched information
💡 Actionable tips for your growth  
🚀 Join our community of smart followers

What do you think? Drop your thoughts! 👇`;

      const hashtags = INSTAGRAM_CONFIG.HASHTAGS.slice(0, 15).join(' ');
      const caption = `${testScript}\n\n${hashtags}`;

      console.log('[Webhook] Caption with hashtags:');
      console.log('─'.repeat(60));
      console.log(caption);
      console.log('─'.repeat(60));
      console.log(`Caption Length: ${caption.length}/${INSTAGRAM_CONFIG.CAPTION_MAX_LENGTH}`);

      // Get any cached video for testing
      let testVideoPath = null;
      try {
        const cachedVideo = await new Promise((resolve, reject) => {
          const query = `
            SELECT * FROM video_cache
            ORDER BY generation_date DESC
            LIMIT 1
          `;
          database.db.get(query, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });

        if (cachedVideo) {
          testVideoPath = cachedVideo.video_url || `./videos/${cachedVideo.video_file}`;
          console.log('[Webhook] Using cached video:', cachedVideo.video_file, 'URL:', cachedVideo.video_url);
        }
      } catch (err) {
        console.warn('[Webhook] Could not find cached video:', err.message);
      }

      // Fallback to test video
      if (!testVideoPath) {
        testVideoPath = './videos/test_reel.mp4';
        console.log('[Webhook] Using test video:', testVideoPath);
      }

      // Attempt to post
      let instagramResult = null;
      try {
        instagramResult = await instagramService.postReel(testVideoPath, caption);
      } catch (error) {
        console.error('[Webhook] Instagram posting error:', error.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to post to Instagram',
          details: error.message,
        });
      }

      if (!instagramResult) {
        return res.status(500).json({
          success: false,
          message: 'Instagram post returned null. Check credentials and API status.',
        });
      }

      console.log('[Webhook] Test post successful');

      return res.status(200).json({
        success: true,
        message: 'Test post successful! Video posted with caption and hashtags.',
        data: {
          postId: instagramResult.postId,
          mediaId: instagramResult.mediaId,
          url: instagramResult.url,
          captionLength: caption.length,
          status: instagramResult.status,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Webhook] Error in test Instagram post:', error.message);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/webhook/sync-analytics
   * Fetch latest insights from Instagram for all posted reels and update DB.
   * Designed to run 3x per day via GitHub Actions.
   */
  router.post('/sync-analytics', verifyWebhookSignature, async (req, res) => {
    const startTime = Date.now();
    try {
      console.log('[Webhook] Starting analytics sync...');

      // Get all posted reels with an Instagram post ID (last 90 days)
      const posts = await new Promise((resolve, reject) => {
        database.db.all(
          `SELECT id, date, instagram_post_id FROM daily_posts
           WHERE status = 'posted' AND instagram_post_id IS NOT NULL AND instagram_post_id != ''
           AND date >= date('now', '-90 days')
           ORDER BY date DESC`,
          (err, rows) => { if (err) reject(err); else resolve(rows || []); }
        );
      });

      if (!posts.length) {
        return res.json({ success: true, message: 'No posts to sync', updated: 0 });
      }

      console.log(`[Webhook] Syncing analytics for ${posts.length} posts...`);

      let updated = 0;
      let failed = 0;
      const results = [];

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
          updated++;
          results.push({ postId: post.instagram_post_id, date: post.date, status: 'synced', data: analytics });
          console.log(`[Webhook] Synced ${post.date} (${post.instagram_post_id}): reach=${analytics.views} likes=${analytics.likes}`);
        } catch (err) {
          failed++;
          results.push({ postId: post.instagram_post_id, date: post.date, status: 'failed', error: err.message });
          console.warn(`[Webhook] Failed to sync ${post.instagram_post_id}:`, err.message);
        }
      }

      const duration = Date.now() - startTime;
      console.log(`[Webhook] Analytics sync complete: ${updated} updated, ${failed} failed in ${duration}ms`);

      return res.json({
        success: true,
        message: `Analytics sync complete`,
        updated,
        failed,
        total: posts.length,
        duration,
        results,
      });
    } catch (error) {
      console.error('[Webhook] Analytics sync error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
