/**
 * VideoAgent - Smart Hybrid Video Generation
 * Automatically switches between HeyGen (premium 10/month) and Stock Videos (unlimited free)
 * Priority: HeyGen if quota available → Stock Videos if HeyGen exhausted → Cache fallback
 */
class VideoAgent {
  constructor(heygenService, database, apiLimiter, stockVideoService = null, ttsService = null, compositionService = null) {
    this.heygenService = heygenService;
    this.db = database;
    this.apiLimiter = apiLimiter;
    
    // New free-tier services
    this.stockVideoService = stockVideoService;
    this.ttsService = ttsService;
    this.compositionService = compositionService;
    this.preferredGenerator = process.env.PREFERRED_VIDEO_GENERATOR || 'stock';
    
    console.log('[VideoAgent] Initialized with smart hybrid generation');
    console.log(`[VideoAgent] Priority mode: ${this.preferredGenerator}`);
  }

  /**
   * MAIN ENTRY POINT: Generate video with smart quota-aware switching
   */
  async generateVideoForDay(script = null, dayNumber = new Date().getDate()) {
    try {
      console.log('[VideoAgent 🎬] Generating video for day:', dayNumber);
      
      // Check HeyGen quota first
      const heygenStatus = await this.checkHeyGenQuota();
      console.log('[VideoAgent] HeyGen Status:', heygenStatus);

      let result = null;

      const preferStock = this.preferredGenerator === 'stock';

      if (preferStock) {
        console.log('[VideoAgent] ✅ Tier 1: Preferred generator is stock video');
        result = await this.generateStockVideo(script);
        if (result) return result;
      }

      // STRATEGY 1: Try HeyGen if quota available
      if (heygenStatus.remaining > 0) {
        console.log('[VideoAgent] ✅ Tier 1: HeyGen available, attempting premium generation');
        result = await this.generateWithHeyGen(script);
        if (result) return result;
      }

      // STRATEGY 2: Fall back to free stock videos
      if (!preferStock) {
        console.log('[VideoAgent] ⚠️  Tier 2: Switching to free stock video generation');
        result = await this.generateStockVideo(script);
        if (result) return result;
      }

      // STRATEGY 3: Fall back to cache
      console.log('[VideoAgent] ⚠️  Tier 3: Attempting cache fallback');
      result = await this.reuseOldVideo();
      if (result) return result;

      throw new Error('All video generation methods exhausted');
    } catch (error) {
      console.error('[VideoAgent] ❌ Error generating video:', error.message);
      throw error;
    }
  }

  /**
   * Check HeyGen monthly quota
   */
  async checkHeyGenQuota() {
    try {
      const monthlyData = await this.apiLimiter.getRemainingForMonth('HEYGEN');
      return {
        total: monthlyData.total || 10,
        remaining: monthlyData.remaining || 0,
        used: (monthlyData.total || 10) - (monthlyData.remaining || 0),
        percentUsed: Math.round(((monthlyData.total || 10) - (monthlyData.remaining || 0)) / (monthlyData.total || 10) * 100),
        available: (monthlyData.remaining || 0) > 0,
      };
    } catch (error) {
      console.error('[VideoAgent] Error checking HeyGen quota:', error.message);
      return { total: 10, remaining: 0, used: 10, percentUsed: 100, available: false };
    }
  }

  /**
   * TIER 1: Premium HeyGen Generation (10 videos/month)
   */
  async generateWithHeyGen(script = null) {
    try {
      console.log('[VideoAgent] 🎭 [TIER 1] Starting HeyGen generation...');

      if (!script) {
        const queuedScript = await this.db.getQueuedScript();
        if (!queuedScript) {
          console.log('[VideoAgent] No script for HeyGen generation');
          return null;
        }
        script = queuedScript.script;
      }

      const scriptText = typeof script === 'string' ? script : script?.script;
      if (!scriptText) {
        console.warn('[VideoAgent] Missing script text for HeyGen generation');
        return null;
      }

      // Verify quota again before calling API
      const quota = await this.checkHeyGenQuota();
      if (quota.remaining <= 0) {
        console.warn('[VideoAgent] HeyGen quota exhausted');
        return null;
      }

      console.log('[VideoAgent] 🚀 Calling HeyGen API...');
      const videoResult = await this.heygenService.generateVideo(scriptText);
      if (!videoResult) {
        console.warn('[VideoAgent] HeyGen returned null');
        return null;
      }

      console.log('[VideoAgent] ⏳ Waiting for HeyGen video to complete...');
      const completedVideo = await this.heygenService.waitForVideoCompletion(videoResult.videoId);
      
      console.log('[VideoAgent] 📥 Downloading HeyGen video...');
      const downloadResult = await this.heygenService.downloadVideo(
        completedVideo.videoUrl,
        completedVideo.videoId
      );

      // Cache for future use
      await this.db.cacheResult('video', {
        file: downloadResult.fileName,
        url: completedVideo.videoUrl,
        topic: scriptText.substring(0, 50),
        method: 'heygen',
      });

      console.log('[VideoAgent] ✅ HeyGen premium video generated successfully!');
      return {
        videoPath: downloadResult.videoPath,
        videoId: completedVideo.videoId,
        videoUrl: completedVideo.videoUrl,
        generator: 'heygen-premium',
        duration: 90,
        quality: '🎬 Premium (AI Avatar)',
        tier: 1,
      };
    } catch (error) {
      console.error('[VideoAgent] ❌ HeyGen generation failed:', error.message);
      return null;
    }
  }

  /**
   * TIER 2: Free Stock Video Generation (unlimited)
   */
  async generateStockVideo(script = null) {
    try {
      console.log('[VideoAgent] 🎞️ [TIER 2] Starting free stock video generation...');

      // Check if free services are available
      if (!this.stockVideoService || !this.ttsService || !this.compositionService) {
        console.warn('[VideoAgent] Free video services not initialized');
        return null;
      }

      let payload = script;
      if (!payload) {
        const queuedScript = await this.db.getQueuedScript();
        if (!queuedScript) {
          console.log('[VideoAgent] No script for stock video generation');
          return null;
        }
        payload = {
          script: queuedScript.script,
          videoPrompt: queuedScript.hooks?.videoPrompt || queuedScript.topic,
          scenes: queuedScript.hooks?.scenes || null,
        };
      }

      const scriptText = typeof payload === 'string' ? payload : payload.script;
      const videoPrompt = typeof payload === 'string' ? payload : payload.videoPrompt;
      const scenes = this.normalizeScenes(scriptText, payload?.scenes);
      const topic = (scriptText || '').substring(0, 70);

      // Step 1: Find stock videos per scene
      console.log('[VideoAgent] 🔍 Searching stock video clips for scenes...');
      const sceneSources = await this.stockVideoService.searchVideosForScenes(scenes, videoPrompt || topic);
      const downloadedVideos = [];
      for (const source of sceneSources) {
        const downloaded = await this.stockVideoService.downloadVideo(source.videoUrl, source.videoId);
        downloadedVideos.push({
          ...source,
          ...downloaded,
        });
      }
      console.log('[VideoAgent] ✓ Retrieved scene clips:', downloadedVideos.length);

      // Step 2: Generate scene-level TTS audio
      console.log('[VideoAgent] 🎙️ Generating scene voiceover...');
      const audioData = await this.ttsService.generateSceneAudio(scenes);
      console.log('[VideoAgent] ✓ Scene audio prepared (format:', audioData.format + ')');

      // Step 3: Prepare text overlay
      const textOverlay = {
        script: scriptText.substring(0, 200),
        position: 'bottom',
      };

      // Step 4: Compose reel
      console.log('[VideoAgent] 🎬 Composing final reel...');
      const components = this.compositionService.prepareComponents(
        {
          ...downloadedVideos[0],
          videoUrl: downloadedVideos[0]?.videoPath,
        },
        { script: scriptText, scenes, videoPrompt },
        audioData,
        topic,
        new Date().toISOString().split('T')[0]
      );

      components.videoSources = downloadedVideos;
      components.scenes = audioData.scenes?.length ? audioData.scenes : scenes;

      const reel = await this.compositionService.composeReel(components);
      console.log('[VideoAgent] ✓ Reel composed');

      // Step 5: Cache the reel
      await this.db.cacheResult('video', {
        file: `${reel.videoId}.mp4`,
        url: reel.videoUrl,
        topic: topic,
        method: 'stock-video-free',
      });

      console.log('[VideoAgent] ✅ Free stock video generated successfully!');
      return {
        videoPath: reel.videoPath,
        videoId: reel.videoId,
        videoUrl: reel.videoUrl,
        generator: 'stock-video-free',
        duration: reel.duration || 90,
        quality: reel.quality || '📹 Free (Stock + Text)',
        tier: 2,
        composition: reel.composition,
        scenes: components.scenes,
      };
    } catch (error) {
      console.error('[VideoAgent] ❌ Stock video generation failed:', error.message);
      return null;
    }
  }

  normalizeScenes(script, rawScenes) {
    if (Array.isArray(rawScenes) && rawScenes.length > 0) {
      return rawScenes
        .map((scene, index) => ({
          index,
          text: String(scene?.text || '').trim(),
          visualPrompt: String(scene?.visualPrompt || scene?.text || '').trim(),
          duration: Math.max(4, Math.min(10, Number(scene?.duration) || 6)),
        }))
        .filter((scene) => scene.text);
    }

    const lines = String(script || '')
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const chunks = [];
    for (let i = 0; i < lines.length; i++) {
      chunks.push({
        index: i,
        text: lines[i],
        visualPrompt: lines[i],
        duration: 6,
      });
    }

    return chunks.slice(0, 20);
  }

  /**
   * TIER 3: Cached Video Fallback
   */
  async reuseOldVideo() {
    try {
      console.log('[VideoAgent] 📦 [TIER 3] Attempting cached video...');

      return new Promise((resolve, reject) => {
        const query = `
          SELECT * FROM video_cache
          ORDER BY reuse_count ASC, last_used_date ASC
          LIMIT 1
        `;

        this.db.db.get(query, async (err, row) => {
          if (err) {
            console.error('[VideoAgent] Error fetching cache:', err);
            reject(err);
            return;
          }

          if (!row) {
            console.warn('[VideoAgent] ❌ No cached videos available');
            resolve(null);
            return;
          }

          try {
            await this.db.updateVideoReuse(row.id);
            console.log('[VideoAgent] ✅ Reusing cached video:', row.video_file);

            resolve({
              videoPath: `./videos/${row.video_file}`,
              videoId: row.video_file,
              videoUrl: row.video_url,
              generator: 'cache-fallback',
              duration: 45,
              quality: '⚡ Cached (Previous)',
              tier: 3,
              reuseCount: row.reuse_count + 1,
            });
          } catch (error) {
            console.error('[VideoAgent] Error updating reuse count:', error.message);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('[VideoAgent] ❌ Cache fallback failed:', error.message);
      return null;
    }
  }

  /**
   * Get current system status
   */
  async getSystemStatus() {
    try {
      const heygenQuota = await this.checkHeyGenQuota();
      const cacheStats = await this.getCacheStats();

      return {
        tier1_heygen: {
          status: heygenQuota.available ? '✅ Available' : '❌ Exhausted',
          used: `${heygenQuota.used}/${heygenQuota.total}`,
          percentUsed: `${heygenQuota.percentUsed}%`,
          remaining: heygenQuota.remaining,
        },
        tier2_stockVideos: {
          status: this.stockVideoService ? '✅ Available' : '❌ Not initialized',
          cost: '$0/month',
          unlimited: true,
        },
        tier3_cache: {
          status: cacheStats.total_cached > 0 ? '✅ Available' : '❌ Empty',
          cachedVideos: cacheStats.total_cached,
          totalReuses: cacheStats.total_reuses,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[VideoAgent] Error getting status:', error.message);
      return { error: error.message };
    }
  }

  /**
   * Helper: Get cache statistics
   */
  async getCacheStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_cached,
          SUM(reuse_count) as total_reuses,
          AVG(reuse_count) as avg_reuses
        FROM video_cache
      `;

      this.db.db.get(query, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row || { total_cached: 0, total_reuses: 0, avg_reuses: 0 });
      });
    });
  }

}

export default VideoAgent;
