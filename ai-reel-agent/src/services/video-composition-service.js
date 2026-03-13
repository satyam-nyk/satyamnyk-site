import { API_LIMITS } from '../config/constants.js';

/**
 * VideoCompositionService - Combines stock videos, text overlays, and audio
 * Creates complete Instagram reels from components
 */
class VideoCompositionService {
  constructor() {
    this.timeout = API_LIMITS.VIDEO_COMPOSITION?.TIMEOUT || 30000;
    console.log('[VideoCompositionService] Initialized (video composition enabled)');
  }

  /**
   * Compose final reel from video, text, and audio
   * Returns: {videoPath, duration, quality}
   */
  async composeReel(components) {
    try {
      console.log('[VideoCompositionService] Composing reel from components');
      
      const {
        videoSource, // {url, id, title}
        textOverlay, // {script, position}
        audioPart,   // {audioPath, scriptText}
        metadata     // {topic, date}
      } = components;

      console.log('[VideoCompositionService] Video source:', videoSource.title);
      console.log('[VideoCompositionService] Text overlay:', textOverlay.position);
      console.log('[VideoCompositionService] Format: Text overlay on video');

      // For MVP: return video reference with metadata
      // In production: would use FFmpeg to create actual composite video
      
      const compositionId = `reel_${metadata.date}_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        videoPath: `./videos/${compositionId}.mp4`,
        videoId: compositionId,
        videoUrl: videoSource.url, // Use stock video directly
        duration: videoSource.duration || 30,
        quality: '1080p',
        format: 'mp4',
        composition: {
          videoSource: videoSource.id,
          hasTextOverlay: true,
          textContent: textOverlay.script.substring(0, 100),
          position: textOverlay.position || 'center',
        },
        metadata: metadata,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[VideoCompositionService] Error composing reel:', error.message);
      throw error;
    }
  }

  /**
   * Prepare components for composition
   */
  prepareComponents(videoData, scriptData, audioData, topic, date) {
    return {
      videoSource: {
        url: videoData.videoUrl,
        id: videoData.videoId,
        title: videoData.title || 'Stock Video',
        duration: videoData.duration || 30,
      },
      textOverlay: {
        script: scriptData.script,
        position: 'bottom', // Instagram style text position
        fontSize: 32,
        fontColor: '#FFFFFF',
        backgroundColor: 'rgba(0,0,0,0.7)',
      },
      audioPart: {
        audioPath: audioData.audioPath,
        scriptText: audioData.scriptText || scriptData.script,
        duration: audioData.duration,
      },
      metadata: {
        topic: topic,
        date: date,
        generator: 'stock-video-composition',
      },
    };
  }

  /**
   * Estimate final video specs
   */
  estimateVideoSpecs(components) {
    return {
      resolution: '1080x1920', // Instagram reel spec
      format: 'mp4',
      codec: 'h264',
      bitrate: '10000k',
      fps: 30,
      duration: components.videoSource.duration,
    };
  }
}

export default VideoCompositionService;
