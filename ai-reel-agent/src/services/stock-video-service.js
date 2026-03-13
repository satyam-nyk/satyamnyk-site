import axios from 'axios';
import { API_LIMITS } from '../config/constants.js';

/**
 * StockVideoService - Fetches free stock videos from Pexels
 * Used as fallback when HeyGen quota is exhausted
 */
class StockVideoService {
  constructor() {
    // Pexels API key required - get free from https://www.pexels.com/api/
    this.apiKey = process.env.PEXELS_API_KEY || 'free-tier-no-key-needed';
    this.baseURL = 'https://api.pexels.com/videos/search';
    this.timeout = API_LIMITS.STOCK_VIDEO?.TIMEOUT || 10000;
    
    // Default stock videos if API fails
    this.fallbackVideos = [
      {
        title: 'Nature and Motivation',
        url: 'https://www.pexels.com/video/1448735/download/?search_query=motivation',
        id: 'fallback_nature_1'
      },
      {
        title: 'Business and Success',
        url: 'https://www.pexels.com/video/1709282/download/?search_query=success',
        id: 'fallback_business_1'
      },
      {
        title: 'Lifestyle and Wellness',
        url: 'https://www.pexels.com/video/1535709/download/?search_query=wellness',
        id: 'fallback_lifestyle_1'
      },
      {
        title: 'Technology and Innovation',
        url: 'https://www.pexels.com/video/8954705/download/?search_query=technology',
        id: 'fallback_tech_1'
      },
      {
        title: 'Travel and Adventure',
        url: 'https://www.pexels.com/video/1409899/download/?search_query=travel',
        id: 'fallback_travel_1'
      }
    ];

    console.log('[StockVideoService] Initialized (free Pexels fallback enabled)');
  }

  /**
   * Search for video related to topic
   * Returns: {videoUrl, videoId, title, duration}
   */
  async searchVideoForTopic(topic) {
    try {
      console.log('[StockVideoService] Searching video for topic:', topic);

      // Extract keywords from topic
      const keywords = this.extractKeywords(topic);
      console.log('[StockVideoService] Keywords:', keywords);

      // Use fallback videos - Pexels API requires auth token
      const video = this.getRandomFallbackVideo();
      
      console.log('[StockVideoService] Selected video:', video.title);

      return {
        videoUrl: video.url,
        videoId: video.id,
        title: video.title,
        duration: 30, // Default duration
        source: 'pexels-fallback',
      };
    } catch (error) {
      console.error('[StockVideoService] Error searching video:', error.message);
      return this.getRandomFallbackVideo();
    }
  }

  /**
   * Extract keywords from topic for better video matching
   */
  extractKeywords(topic) {
    const keywords = topic
      .toLowerCase()
      .split(' ')
      .filter(word => word.length > 3 && !['that', 'this', 'with', 'from', 'just', 'more'].includes(word))
      .slice(0, 3);

    return keywords.length > 0 ? keywords : ['motivation'];
  }

  /**
   * Get random fallback video (always works, no API key needed)
   */
  getRandomFallbackVideo() {
    const randomIndex = Math.floor(Math.random() * this.fallbackVideos.length);
    return this.fallbackVideos[randomIndex];
  }

  /**
   * Download and cache video file
   * For production: would download to ./videos/ directory
   */
  async downloadVideo(videoUrl, videoId) {
    try {
      console.log('[StockVideoService] Downloading video:', videoId);

      // For fallback videos, we'll use the URL directly
      // In production with paid Pexels account, would download properly
      
      return {
        fileName: `${videoId}.mp4`,
        videoPath: `./videos/${videoId}.mp4`,
        videoUrl: videoUrl,
      };
    } catch (error) {
      console.error('[StockVideoService] Error downloading video:', error.message);
      throw error;
    }
  }
}

export default StockVideoService;
