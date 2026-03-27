import axios from 'axios';
import { API_LIMITS } from '../config/constants.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

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
    this.stockDir = path.resolve(__dirname, '../../videos/assets');
    fs.mkdirSync(this.stockDir, { recursive: true });

    console.log('[StockVideoService] Initialized (Pexels + fallback enabled)');
  }

  /**
   * Search for video related to topic
   * Returns: {videoUrl, videoId, title, duration}
   */
  async searchVideoForTopic(topic) {
    try {
      const queryText = this.buildPexelsQuery(topic);
      console.log('[StockVideoService] Searching video — query:', queryText);

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

      const fallback = this.createProceduralFallbackVideo(topic);
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
      const fallback = this.createProceduralFallbackVideo(topic || 'motivation');
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
      // Build a focused query from the scene's own visual prompt, not the full concatenated block
      const sceneQuery = this.buildPexelsQuery(scene.visualPrompt || scene.text || globalPrompt);
      const selected = await this.searchVideoForTopic(sceneQuery || 'technology lifestyle');
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
   * Build a concise, focused Pexels search query from a long visual prompt.
   * Strips boilerplate style guide text, takes the first meaningful sentence,
   * and returns up to maxWords content keywords.
   */
  buildPexelsQuery(prompt, maxWords = 5) {
    if (!prompt) return 'lifestyle technology';

    let cleaned = String(prompt)
      // Strip the boilerplate style guide appended to all LLM scene prompts
      .replace(/[.!]?\s*A sleek[,\s].*$/is, '')
      .replace(/[.!]?\s*Style:\s.*$/is, '')
      .replace(/[.!]?\s*Mood:\s.*$/is, '')
      .replace(/\(\s*9[:/]16[^)]*\)/gi, '')
      .replace(/ultra-high definition.*$/is, '')
      .replace(/inspired by Apple.*$/is, '')
      .trim();

    // Take only the first sentence or clause
    const firstSentence = (cleaned.split(/\.\s+|\.$/)[0] || cleaned).trim();

    const stopWords = new Set([
      'that', 'this', 'with', 'from', 'just', 'more', 'about', 'into', 'onto',
      'over', 'under', 'then', 'when', 'where', 'which', 'while', 'their',
      'there', 'these', 'those', 'they', 'them', 'have', 'will', 'been',
      'each', 'much', 'such', 'some', 'your', 'very', 'also', 'back',
      'after', 'being', 'both', 'through', 'showing', 'quick', 'previous',
      // Video/camera direction words that don't help Pexels search
      'shot', 'scene', 'camera', 'video', 'effect', 'transition', 'montage',
      'tilts', 'zooms', 'pans', 'follows', 'close', 'wide', 'fisheye', 'lens',
      'cinematic', 'vertical', 'sleek', 'screen', 'background', 'looking',
    ]);

    const words = firstSentence
      .toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w))
      .slice(0, maxWords);

    return words.length >= 2 ? words.join(' ') : 'technology lifestyle';
  }

  /**
   * Extract keywords from topic for better video matching
   * @deprecated Use buildPexelsQuery() for better results
   */
  extractKeywords(topic) {
    return this.buildPexelsQuery(topic, 3).split(' ');
  }

  createProceduralFallbackVideo(topic) {
    const base = String(topic || 'fallback').trim() || 'fallback';
    const hash = [...base].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const hue = hash % 360;
    const filename = `procedural_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp4`;
    const outputPath = path.join(this.stockDir, filename);
    // Convert HSV(hue, 0.45, 0.22) to hex — FFmpeg 8.x dropped the hsv() color function
    const h = hue, s = 0.45, v = 0.22;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r, g, b;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    const toHex = n => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    const color = `0x${toHex(r)}${toHex(g)}${toHex(b)}`;

    const result = spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', `color=c=${color}:s=1080x1920:d=12:r=30`,
      '-vf', 'fps=30,format=yuv420p',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '22',
      outputPath,
    ], { encoding: 'utf8' });

    if (result.status !== 0) {
      throw new Error(result.stderr || 'Failed to generate procedural fallback video');
    }

    return {
      title: `Procedural background for ${base}`,
      url: outputPath,
      id: path.basename(filename, '.mp4'),
    };
  }

  /**
   * Download and cache video file
   * Retries up to 3 times with a 120-second timeout per attempt to handle large Pexels files.
   */
  async downloadVideo(videoUrl, videoId) {
    const DOWNLOAD_TIMEOUT = 120000; // 120s — Pexels files can be 50-200MB
    const MAX_RETRIES = 3;

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

    if (fs.existsSync(outputPath)) {
      return { fileName: `${safeId}.mp4`, videoPath: outputPath, videoUrl };
    }

    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: DOWNLOAD_TIMEOUT,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            Referer: 'https://www.pexels.com/',
          },
          maxRedirects: 5,
        });
        fs.writeFileSync(outputPath, Buffer.from(response.data));
        return { fileName: `${safeId}.mp4`, videoPath: outputPath, videoUrl };
      } catch (error) {
        lastError = error;
        console.warn(`[StockVideoService] Download attempt ${attempt}/${MAX_RETRIES} failed: ${error.message}`);
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempt * 3000));
        }
      }
    }

    console.error('[StockVideoService] Error downloading video:', lastError.message);
    throw lastError;
  }
}

export default StockVideoService;
