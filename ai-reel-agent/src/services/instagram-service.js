import axios from 'axios';
import { API_LIMITS, INSTAGRAM_CONFIG } from '../config/constants.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * InstagramService - Handles Instagram Graph API interactions
 * Posts reels and manages engagement analytics
 */
class InstagramService {
  constructor(accessToken, businessAccountId, apiLimiter) {
    if (!accessToken || !businessAccountId) {
      throw new Error('Instagram access token and business account ID are required');
    }
    this.accessToken = accessToken;
    this.businessAccountId = businessAccountId;
    this.apiLimiter = apiLimiter;
    this.baseURL = 'https://graph.facebook.com/v18.0';
    this.timeout = API_LIMITS.INSTAGRAM.TIMEOUT;
  }

  /**
   * Create a reel and post it
   * Returns: {postId, url, status}
   */
  async postReel(videoPath, caption) {
    try {
      // Validate inputs
      if (!videoPath || !caption) {
        throw new Error('Video path and caption are required');
      }

      const isRemoteUrl = typeof videoPath === 'string' && /^https?:\/\//i.test(videoPath);

      if (!isRemoteUrl) {
        const resolvedVideoPath = this.resolveVideoPath(videoPath);
        if (!resolvedVideoPath || !fs.existsSync(resolvedVideoPath)) {
          console.warn(`[InstagramService] Video file not found: ${videoPath}`);
          return null;
        }

        console.warn(
          '[InstagramService] Local file upload is not supported by this Reels flow. Provide a public video URL.'
        );
        return null;
      }

      // Check API limit
      if (!(await this.apiLimiter.canMakeRequest('INSTAGRAM'))) {
        console.warn('[InstagramService] Instagram rate limit reached');
        return null;
      }

      // Validate caption
      if (caption.length > INSTAGRAM_CONFIG.CAPTION_MAX_LENGTH) {
        caption = caption.substring(0, INSTAGRAM_CONFIG.CAPTION_MAX_LENGTH);
      }

      // Step 1: Create media container
      const containerResponse = await axios.post(
        `${this.baseURL}/${this.businessAccountId}/media`,
        {
          media_type: 'REELS',
          video_url: videoPath,
          caption,
          access_token: this.accessToken,
        },
        {
          timeout: this.timeout,
        }
      );

      const mediaId = containerResponse.data?.id;
      if (!mediaId) {
        throw new Error('No media ID returned from Instagram API');
      }

      // Record API usage
      await this.apiLimiter.consumeLimit('INSTAGRAM', 1);

      // Step 2: Check media status before publishing
      await this.waitForMediaProcessing(mediaId);

      // Step 3: Publish media
      const publishResponse = await axios.post(
        `${this.baseURL}/${this.businessAccountId}/media_publish`,
        {
          creation_id: mediaId,
          access_token: this.accessToken,
        },
        { timeout: this.timeout }
      );

      const postId = publishResponse.data?.id;

      console.log('[InstagramService] Reel posted successfully:', postId);

      return {
        postId,
        mediaId,
        url: `https://instagram.com/reel/${postId}`,
        status: 'posted',
        postedAt: new Date().toISOString(),
      };
    } catch (error) {
      if (error.response?.data) {
        console.error('[InstagramService] API error details:', JSON.stringify(error.response.data));
      }
      console.error('[InstagramService] Error posting reel:', error.message);
      throw error;
    }
  }

  resolveVideoPath(videoPath) {
    if (!videoPath) {
      return null;
    }

    if (fs.existsSync(videoPath)) {
      return videoPath;
    }

    if (path.isAbsolute(videoPath)) {
      return videoPath;
    }

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const projectRoot = path.resolve(__dirname, '../..');
    const normalizedRelativePath = videoPath.replace(/^\.\//, '');
    return path.join(projectRoot, normalizedRelativePath);
  }

  /**
   * Wait for media processing after upload
   */
  async waitForMediaProcessing(mediaId, maxWaitTime = 300000) {
    // 5 minutes default
    try {
      const startTime = Date.now();
      const pollInterval = 5000; // Poll every 5 seconds

      while (Date.now() - startTime < maxWaitTime) {
        const status = await this.getMediaStatus(mediaId);

        if (status.status_code === 'FINISHED' || status.status_code === 'PUBLISHED') {
          console.log('[InstagramService] Media processing complete:', mediaId);
          return true;
        }

        if (status.status_code === 'ERROR') {
          throw new Error(`Media processing failed: ${status.status}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error(`Media processing timeout: ${mediaId}`);
    } catch (error) {
      console.error('[InstagramService] Error waiting for media processing:', error.message);
      throw error;
    }
  }

  /**
   * Get media status
   */
  async getMediaStatus(mediaId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/${mediaId}`,
        {
          params: {
            fields: 'status_code,status',
            access_token: this.accessToken,
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      console.error('[InstagramService] Error getting media status:', error.message);
      throw error;
    }
  }

  /**
   * Get Instagram post insights (views, likes, comments)
   * Returns: {views, likes, comments, shares}
   *
   * Strategy:
   *  1. Try /{postId}/insights (requires instagram_manage_insights scope).
   *     If successful, returns full impressions/plays/etc.
   *  2. If that fails with a permission error (#10), fall back to media fields
   *     (like_count, comments_count) which work with instagram_basic scope.
   *     Views stay 0 until the token is re-authorised with manage_insights.
   */
  async getPostAnalytics(postId) {
    if (!postId) {
      return { postId, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, plays: 0, error: 'postId is required' };
    }

    // --- Attempt 1: full /insights endpoint ---
    try {
      // Reels metrics: reach (unique accounts), likes, comments, shares, saved, total_interactions
      // Note: impressions and plays are deprecated/unsupported for REELS media product type in v22+
      const response = await axios.get(
        `${this.baseURL}/${postId}/insights`,
        {
          params: {
            metric: 'reach,likes,comments,shares,saved,total_interactions',
            access_token: this.accessToken,
          },
          timeout: this.timeout,
        }
      );

      await this.apiLimiter.consumeLimit('INSTAGRAM', 1);

      const insights = {};
      response.data.data?.forEach((item) => {
        insights[item.name] = item.values?.[0]?.value || 0;
      });

      console.log('[InstagramService] Retrieved insights for post:', postId);

      return {
        postId,
        views: insights.reach || 0,
        likes: insights.likes || 0,
        comments: insights.comments || 0,
        shares: insights.shares || 0,
        saves: insights.saved || 0,
        plays: insights.total_interactions || 0,
        retrievedAt: new Date().toISOString(),
      };
    } catch (insightsError) {
      const errCode = insightsError.response?.data?.error?.code;
      const isPermissionError = errCode === 10 || errCode === 200;
      if (!isPermissionError) {
        console.error('[InstagramService] Unexpected insights error:', insightsError.message);
      } else {
        console.warn('[InstagramService] instagram_manage_insights not granted — falling back to media fields for post:', postId);
      }
    }

    // --- Attempt 2: media fields fallback (instagram_basic is enough) ---
    try {
      const response = await axios.get(
        `${this.baseURL}/${postId}`,
        {
          params: {
            fields: 'id,like_count,comments_count',
            access_token: this.accessToken,
          },
          timeout: this.timeout,
        }
      );

      await this.apiLimiter.consumeLimit('INSTAGRAM', 1);

      const d = response.data;
      console.log('[InstagramService] Retrieved media fields (fallback) for post:', postId);

      return {
        postId,
        views: 0,          // impressions not available without manage_insights
        likes: d.like_count || 0,
        comments: d.comments_count || 0,
        shares: 0,
        saves: 0,
        plays: 0,
        fallback: true,
        retrievedAt: new Date().toISOString(),
      };
    } catch (fallbackError) {
      console.error('[InstagramService] Error getting post analytics (fallback):', fallbackError.message);
      return {
        postId,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0,
        plays: 0,
        error: fallbackError.message,
      };
    }
  }

  /**
   * Schedule a post for later
   */
  async schedulePost(videoPath, caption, scheduleTime) {
    try {
      if (!scheduleTime || scheduleTime <= Date.now()) {
        throw new Error('Schedule time must be in the future');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', fs.createReadStream(videoPath));
      formData.append('media_type', 'REELS');
      formData.append('caption', caption);
      formData.append('scheduled_publish_time', Math.floor(scheduleTime / 1000));
      formData.append('access_token', this.accessToken);

      const response = await axios.post(
        `${this.baseURL}/${this.businessAccountId}/media`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: this.timeout,
        }
      );

      const mediaId = response.data?.id;

      console.log('[InstagramService] Reel scheduled:', mediaId);

      return {
        mediaId,
        scheduledTime: new Date(scheduleTime).toISOString(),
        status: 'scheduled',
      };
    } catch (error) {
      console.error('[InstagramService] Error scheduling post:', error.message);
      throw error;
    }
  }

  /**
   * Retry a failed post
   */
  async retryFailedPost(postId, videoPath, caption, retryCount = 0) {
    try {
      const maxRetries = 3;

      if (retryCount > maxRetries) {
        throw new Error(`Max retries (${maxRetries}) exceeded for post`);
      }

      try {
        return await this.postReel(videoPath, caption);
      } catch (error) {
        const backoffTime = Math.pow(2, retryCount) * 2000;
        console.warn(
          `[InstagramService] Post failed, retrying in ${backoffTime}ms...`,
          error.message
        );

        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this.retryFailedPost(postId, videoPath, caption, retryCount + 1);
      }
    } catch (error) {
      console.error('[InstagramService] Error in retry logic:', error.message);
      throw error;
    }
  }

  /**
   * Update post status/caption
   */
  async updatePostStatus(postId, status) {
    try {
      if (!postId || !status) {
        throw new Error('postId and status are required');
      }

      const statusMap = {
        archived: { archived: true },
        unarchived: { archived: false },
      };

      const updateData = statusMap[status];
      if (!updateData) {
        throw new Error(`Invalid status: ${status}`);
      }

      const response = await axios.post(
        `${this.baseURL}/${postId}`,
        {
          ...updateData,
          access_token: this.accessToken,
        },
        { timeout: this.timeout }
      );

      console.log('[InstagramService] Post status updated:', postId, status);

      return { postId, status, success: response.data.success };
    } catch (error) {
      console.error('[InstagramService] Error updating post status:', error.message);
      throw error;
    }
  }

  /**
   * Get business account info
   */
  async getAccountInfo() {
    try {
      const response = await axios.get(
        `${this.baseURL}/${this.businessAccountId}`,
        {
          params: {
            fields: 'id,name,username,biography,followers_count,follows_count',
            access_token: this.accessToken,
          },
          timeout: this.timeout,
        }
      );

      return response.data;
    } catch (error) {
      console.error('[InstagramService] Error getting account info:', error.message);
      throw error;
    }
  }

  /**
   * Batch update analytics for multiple posts
   */
  async batchUpdateAnalytics(postIds = []) {
    try {
      const results = [];

      for (const postId of postIds) {
        try {
          const analytics = await this.getPostAnalytics(postId);
          results.push(analytics);
        } catch (error) {
          console.warn(`[InstagramService] Failed to get analytics for ${postId}:`, error.message);
        }
      }

      console.log('[InstagramService] Updated analytics for', results.length, 'posts');
      return results;
    } catch (error) {
      console.error('[InstagramService] Error in batch analytics update:', error.message);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const accountInfo = await this.getAccountInfo();
      return {
        service: 'Instagram',
        available: !!accountInfo.id,
        accountId: accountInfo.id,
        username: accountInfo.username,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[InstagramService] Health check failed:', error.message);
      return {
        service: 'Instagram',
        available: false,
        error: error.message,
      };
    }
  }
}

export default InstagramService;
