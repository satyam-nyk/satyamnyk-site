import axios from 'axios';
import { API_LIMITS } from '../config/constants.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * StockVideoService - Fetches free stock videos from Pexels
 * Used as fallback when HeyGen quota is exhausted
 */
class StockVideoService {
  constructor() {
    this.apiKey = process.env.PEXELS_API_KEY || '';
    this.pixabayApiKey = process.env.PIXABAY_API_KEY || '';
    this.baseURL = 'https://api.pexels.com/videos/search';
    this.pixabayBaseURL = 'https://pixabay.com/api/videos/';
    this.timeout = API_LIMITS.STOCK_VIDEO?.TIMEOUT || 10000;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.videosDir = path.resolve(__dirname, '../../videos');
    this.stockDir = path.resolve(__dirname, '../../videos/assets');
    fs.mkdirSync(this.stockDir, { recursive: true });
    
    // Default stock videos if API fails
    this.fallbackVideos = [
      {
        title: 'Life Hacks reel (local fallback)',
        url: path.join(this.videosDir, 'reel_voice_subtitles_1080x1920.mp4'),
        id: 'fallback_local_lifehacks_1'
      },
      {
        title: 'AI Jobs reel (local fallback)',
        url: path.join(this.videosDir, 'reel_ai_jobs_2026.mp4'),
        id: 'fallback_local_ai_jobs_1'
      },
      {
        title: 'Life Hacks reel copy (local fallback)',
        url: path.join(this.videosDir, 'reel_voice_subtitles_1080x1920.mp4'),
        id: 'fallback_local_lifehacks_2'
      }
    ];

    console.log('[StockVideoService] Initialized (Pexels + fallback enabled)');
  }

  /**
   * Search for video related to topic
   * Returns: {videoUrl, videoId, title, duration}
   */
  async searchVideoForTopic(topic) {
    try {
      console.log('[StockVideoService] Searching video for topic:', topic);

      const keywords = this.extractKeywords(topic);
      console.log('[StockVideoService] Keywords:', keywords);
      const directQuery = String(topic || '').replace(/\s+/g, ' ').trim();
      const queryText = directQuery || keywords.join(' ');

      if (this.apiKey) {
        const query = encodeURIComponent(queryText);
        const response = await axios.get(`${this.baseURL}?query=${query}&per_page=10&orientation=portrait`, {
          headers: { Authorization: this.apiKey },
          timeout: this.timeout,
        });

        const videos = response.data?.videos || [];
        const candidate = this.pickBestPexelsVideo(videos);
        if (candidate) {
          console.log('[StockVideoService] Selected Pexels video:', candidate.title);
          return candidate;
        }
      }

      if (this.pixabayApiKey) {
        const pixabayResult = await this.searchPixabayVideo(queryText);
        if (pixabayResult) {
          console.log('[StockVideoService] Selected Pixabay video:', pixabayResult.title);
          return pixabayResult;
        }
      }

      const fallback = this.getDeterministicFallbackVideo(topic);
      console.log('[StockVideoService] Using fallback video:', fallback.title);
      return {
        videoUrl: fallback.url,
        videoId: fallback.id,
        title: fallback.title,
        duration: 20,
        source: 'fallback',
      };
    } catch (error) {
      console.error('[StockVideoService] Error searching video:', error.message);
      const fallback = this.getDeterministicFallbackVideo(topic || 'motivation');
      return {
        videoUrl: fallback.url,
        videoId: fallback.id,
        title: fallback.title,
        duration: 20,
        source: 'fallback',
      };
    }
  }

  async searchVideosForScenes(scenes = [], globalPrompt = '') {
    const outputs = [];
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const query = `${scene.visualPrompt || scene.text || ''} ${globalPrompt}`.trim();
      const selected = await this.searchVideoForTopic(query || 'cinematic vertical background');
      outputs.push({
        ...selected,
        sceneIndex: i,
      });
    }
    return outputs;
  }

  pickBestPexelsVideo(videos) {
    if (!Array.isArray(videos) || videos.length === 0) return null;

    const scored = videos
      .map((video) => {
        const files = (video.video_files || []).filter((file) => file.link && file.width && file.height);
        const portrait = files.filter((f) => f.height >= f.width);
        const selected = portrait.sort((a, b) => (b.height * b.width) - (a.height * a.width))[0]
          || files.sort((a, b) => (b.height * b.width) - (a.height * a.width))[0];
        if (!selected) return null;

        const score = (video.duration >= 8 && video.duration <= 20 ? 40 : (video.duration >= 6 && video.duration <= 30 ? 25 : 0))
          + (selected.height >= selected.width ? 30 : 0)
          + Math.min(50, Math.floor((selected.height * selected.width) / 90000));

        return {
          score,
          videoUrl: selected.link,
          videoId: `pexels_${video.id}`,
          title: video.url || `Pexels ${video.id}`,
          duration: Math.min(45, Math.max(8, video.duration || 12)),
          source: 'pexels-api',
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return scored[0] || null;
  }

  async searchPixabayVideo(query) {
    if (!this.pixabayApiKey) return null;
    try {
      const response = await axios.get(this.pixabayBaseURL, {
        timeout: this.timeout,
        params: {
          key: this.pixabayApiKey,
          q: query,
          per_page: 10,
          safesearch: true,
        },
      });

      const hits = response.data?.hits || [];
      if (!hits.length) return null;

      const picked = hits
        .map((hit) => {
          const vertical = hit.videos?.large || hit.videos?.medium || hit.videos?.small;
          if (!vertical?.url) return null;
          const width = vertical.width || 0;
          const height = vertical.height || 0;
          const score = (height >= width ? 30 : 0) + Math.min(50, Math.floor((width * height) / 100000));
          return {
            score,
            videoUrl: vertical.url,
            videoId: `pixabay_${hit.id}`,
            title: hit.tags || `Pixabay ${hit.id}`,
            duration: 8,
            source: 'pixabay-api',
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)[0];

      return picked || null;
    } catch (error) {
      console.warn('[StockVideoService] Pixabay search failed:', error.message);
      return null;
    }
  }

  /**
   * Extract keywords from topic for better video matching
   */
  extractKeywords(topic) {
    const keywords = (topic || '')
      .toLowerCase()
      .split(' ')
      .filter((word) => word.length > 3 && !['that', 'this', 'with', 'from', 'just', 'more', 'about'].includes(word))
      .slice(0, 3);

    return keywords.length > 0 ? keywords : ['motivation'];
  }

  /**
   * Get random fallback video (always works, no API key needed)
   */
  getDeterministicFallbackVideo(topic) {
    const base = String(topic || 'fallback');
    const hash = [...base].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return this.fallbackVideos[hash % this.fallbackVideos.length];
  }

  /**
   * Download and cache video file
   * For production: would download to ./videos/ directory
   */
  async downloadVideo(videoUrl, videoId) {
    try {
      console.log('[StockVideoService] Downloading video:', videoId);
      if (videoUrl && !/^https?:\/\//i.test(videoUrl)) {
        return {
          fileName: path.basename(videoUrl),
          videoPath: videoUrl,
          videoUrl,
        };
      }

      const safeId = String(videoId || 'stock_video').replace(/[^a-z0-9_-]/gi, '_');
      const outputPath = path.join(this.stockDir, `${safeId}.mp4`);

      if (!fs.existsSync(outputPath)) {
        const response = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: this.timeout * 3,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://www.pexels.com/',
          },
          maxRedirects: 5,
        });
        fs.writeFileSync(outputPath, Buffer.from(response.data));
      }
      
      return {
        fileName: `${safeId}.mp4`,
        videoPath: outputPath,
        videoUrl: videoUrl,
      };
    } catch (error) {
      console.error('[StockVideoService] Error downloading video:', error.message);
      throw error;
    }
  }
}

export default StockVideoService;
