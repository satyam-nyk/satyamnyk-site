import axios from 'axios';
import { API_LIMITS, VIDEO_CONFIG } from '../config/constants.js';

/**
 * HeyGenService - Handles HeyGen API interactions for video generation
 * Generates AI avatar videos from scripts
 */
class HeyGenService {
  constructor(apiKey, apiLimiter) {
    if (!apiKey) {
      throw new Error('HEYGEN_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.apiLimiter = apiLimiter;
    this.baseURL = 'https://api.heygen.com/v1';
    this.timeout = API_LIMITS.HEYGEN.TIMEOUT;
    this.videoQuality = API_LIMITS.HEYGEN.VIDEO_QUALITY;
  }

  /**
   * Generate a video from a script
   * Returns: {videoId, status, estimatedCredits}
   */
  async generateVideo(script, avatar = 'default') {
    try {
      // Check monthly limit before making request
      const monthlyData = await this.apiLimiter.getRemainingForMonth('HEYGEN');
      if (monthlyData.remaining <= 0) {
        console.warn('[HeyGenService] Monthly quota exceeded');
        return null;
      }

      // NOTE: monthlyData.remaining is video count (e.g. 10/month plan), not credits.
      // estimateCreditsNeeded returns a credit value — comparing these is a unit mismatch.
      // The quota guard above (remaining <= 0) is sufficient; skip the credit comparison.
      const estimatedCredits = this.estimateCreditsNeeded(script);
      console.log(`[HeyGenService] Estimated credits: ${estimatedCredits}, videos remaining this month: ${monthlyData.remaining}`);

      const payload = {
        video_inputs: [
          {
            character: {
              type: 'avatar',
              avatar_id: avatar,
              preset_id: 'default_preset',
            },
            voice: {
              type: 'text',
              input_text: script,
              voice_id: 'default_voice',
            },
            background: {
              type: 'color',
              color: '#FFFFFF',
            },
          },
        ],
        test: false,
        output_format: 'mp4',
      };

      const response = await axios.post(
        `${this.baseURL}/video_generate`,
        payload,
        {
          headers: {
            'X-Api-Key': this.apiKey,
            'Content-Type': 'application/json',
          },
          timeout: this.timeout,
        }
      );

      const videoId = response.data.data?.video_id;
      if (!videoId) {
        throw new Error('No video ID returned from HeyGen API');
      }

      // Record API usage (monthly)
      await this.apiLimiter.consumeLimit('HEYGEN', 1);

      console.log('[HeyGenService] Video generation started:', videoId);

      return {
        videoId,
        status: 'processing',
        estimatedCredits,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[HeyGenService] Error generating video:', error.message);
      throw error;
    }
  }

  /**
   * Check video generation status
   * Returns: {videoId, status, videoUrl, progress}
   */
  async checkVideoStatus(videoId) {
    try {
      if (!videoId) {
        throw new Error('videoId is required');
      }

      const response = await axios.get(
        `${this.baseURL}/video_status?video_id=${videoId}`,
        {
          headers: {
            'X-Api-Key': this.apiKey,
          },
          timeout: this.timeout,
        }
      );

      const data = response.data.data;
      const status = data?.status;
      const videoUrl = data?.video_url;

      console.log(`[HeyGenService] Video ${videoId} status: ${status}`);

      return {
        videoId,
        status,
        videoUrl,
        progress: data?.progress || 0,
        duration: data?.video_duration,
        createdAt: data?.created_at,
        completedAt: data?.completed_at,
      };
    } catch (error) {
      console.error(`[HeyGenService] Error checking video status:`, error.message);
      throw error;
    }
  }

  /**
   * Poll for video completion with timeout
   * Returns: {videoId, videoUrl, status}
   */
  async waitForVideoCompletion(videoId, maxWaitTime = 600000) {
    // 10 minutes default
    try {
      const startTime = Date.now();
      const pollInterval = 10000; // Poll every 10 seconds

      while (Date.now() - startTime < maxWaitTime) {
        const status = await this.checkVideoStatus(videoId);

        if (status.status === 'completed') {
          console.log('[HeyGenService] Video completed:', videoId);
          return {
            videoId,
            videoUrl: status.videoUrl,
            status: 'completed',
          };
        }

        if (status.status === 'failed') {
          throw new Error(`Video generation failed: ${videoId}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

      throw new Error(`Video generation timeout: ${videoId}`);
    } catch (error) {
      console.error('[HeyGenService] Error waiting for video completion:', error.message);
      throw error;
    }
  }

  /**
   * Download or store video reference
   * Returns: {videoPath, fileName}
   */
  async downloadVideo(videoUrl, videoId) {
    try {
      if (!videoUrl) {
        throw new Error('videoUrl is required');
      }

      // For production, implement actual file download
      // For now, we'll store the reference
      const fileName = `video_${videoId}_${Date.now()}.mp4`;

      console.log('[HeyGenService] Video reference stored:', fileName);

      return {
        videoPath: `./videos/${fileName}`,
        fileName,
        videoUrl,
        size: 'pending', // Would be populated after download
        downloadedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[HeyGenService] Error downloading video:', error.message);
      throw error;
    }
  }

  /**
   * Estimate credits needed for a video
   * Based on script length and video duration
   */
  estimateCreditsNeeded(script = '') {
    try {
      // Typical estimation: ~50 credits per minute of video
      // Average script: 45 seconds = 0.75 minutes
      // Rough calculation: word count / 140 words per minute

      const wordCount = script.split(/\s+/).length;
      const estimatedMinutes = wordCount / 140;
      const estimatedCredits = Math.ceil(estimatedMinutes * 50);

      return Math.max(estimatedCredits, 100); // Minimum 100 credits per video
    } catch (error) {
      console.warn('[HeyGenService] Error estimating credits, using default:', error.message);
      return 150; // Default estimation
    }
  }

  /**
   * Track monthly usage
   */
  async trackUsage() {
    try {
      const monthlyData = await this.apiLimiter.getRemainingForMonth('HEYGEN');
      console.log('[HeyGenService] Monthly usage:', monthlyData);
      return monthlyData;
    } catch (error) {
      console.error('[HeyGenService] Error tracking usage:', error.message);
      throw error;
    }
  }

  /**
   * Get available avatars
   */
  async getAvatars() {
    try {
      const response = await axios.get(
        `${this.baseURL}/avatars`,
        {
          headers: {
            'X-Api-Key': this.apiKey,
          },
          timeout: this.timeout,
        }
      );

      const avatars = response.data.data?.avatars || [];
      console.log('[HeyGenService] Found', avatars.length, 'avatars');

      return avatars;
    } catch (error) {
      console.error('[HeyGenService] Error fetching avatars:', error.message);
      throw error;
    }
  }

  /**
   * Retry failed video generation with exponential backoff
   */
  async retryVideoGeneration(script, avatar = 'default', retryCount = 0) {
    try {
      const maxRetries = 3;

      if (retryCount > maxRetries) {
        throw new Error(`Max retries (${maxRetries}) exceeded for video generation`);
      }

      try {
        return await this.generateVideo(script, avatar);
      } catch (error) {
        const backoffTime = Math.pow(2, retryCount) * 1000;
        console.warn(
          `[HeyGenService] Video generation failed, retrying in ${backoffTime}ms...`,
          error.message
        );

        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        return this.retryVideoGeneration(script, avatar, retryCount + 1);
      }
    } catch (error) {
      console.error('[HeyGenService] Error in retry logic:', error.message);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const monthlyData = await this.apiLimiter.getRemainingForMonth('HEYGEN');
      return {
        service: 'HeyGen',
        available: monthlyData.remaining > 0,
        remaining: monthlyData.remaining,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[HeyGenService] Health check failed:', error.message);
      return {
        service: 'HeyGen',
        available: false,
        error: error.message,
      };
    }
  }
}

export default HeyGenService;
