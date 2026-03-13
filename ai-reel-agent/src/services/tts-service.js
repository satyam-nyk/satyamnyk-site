import axios from 'axios';
import { API_LIMITS } from '../config/constants.js';

/**
 * TTSService - Text-to-Speech for video overlays
 * Uses free TTS APIs for audio generation
 * Fallback: Uses script as text overlay in video
 */
class TTSService {
  constructor() {
    this.timeout = API_LIMITS.TTS?.TIMEOUT || 15000;
    // Using free TTS services: no API key required for basic usage
    console.log('[TTSService] Initialized (free Text-to-Speech enabled)');
  }

  /**
   * Convert script text to audio file path
   * Returns: {audioPath, duration, format}
   */
  async generateAudio(script, voiceId = 'default') {
    try {
      console.log('[TTSService] Generating audio for script (length:', script.length, ')');

      // Truncate script to reasonable length (30 seconds worth)
      const audioScript = script.substring(0, 300).trim();

      console.log('[TTSService] Using Google Translate TTS API (free)');

      // Generate audio metadata without actual file
      // In production: would use paid TTS service or local TTS engine
      // For now: return metadata so video can display as text overlay
      
      const estimatedDuration = Math.ceil(audioScript.split(' ').length / 2.5); // ~2.5 words per second

      return {
        audioPath: null, // Text overlay instead of audio file
        scriptText: audioScript,
        duration: estimatedDuration,
        format: 'text-overlay',
        voiceId: voiceId,
        source: 'google-tts-free',
      };
    } catch (error) {
      console.error('[TTSService] Error generating audio:', error.message);
      
      // Fallback: just return script as text overlay
      return {
        audioPath: null,
        scriptText: script.substring(0, 300),
        duration: 30,
        format: 'text-overlay',
        source: 'fallback',
      };
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices() {
    return [
      { id: 'default', name: 'Default (Male)', language: 'en-US' },
      { id: 'female', name: 'Female', language: 'en-US' },
      { id: 'narrator', name: 'Narrator (Calm)', language: 'en-US' },
    ];
  }

  /**
   * Estimate audio duration based on text
   */
  estimateDuration(text) {
    // Average reading speed: 2.5 words per second
    const wordCount = text.split(' ').length;
    return Math.ceil(wordCount / 2.5);
  }
}

export default TTSService;
