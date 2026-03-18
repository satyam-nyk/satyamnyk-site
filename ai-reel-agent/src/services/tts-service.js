import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { API_LIMITS } from '../config/constants.js';

/**
 * TTSService - Text-to-Speech for video overlays
 * Uses free TTS APIs for audio generation
 * Fallback: Uses script as text overlay in video
 */
class TTSService {
  constructor() {
    this.timeout = API_LIMITS.TTS?.TIMEOUT || 15000;
    this.provider = process.env.TTS_PROVIDER || 'auto';
    this.coquiModel = process.env.COQUI_TTS_MODEL || 'tts_models/en/ljspeech/tacotron2-DDC';
    this.voice = process.env.EDGE_TTS_VOICE || 'en-US-AvaMultilingualNeural';
    this.hinglishVoice = process.env.EDGE_TTS_HINGLISH_VOICE || 'hi-IN-SwaraNeural';
    this.rate = process.env.EDGE_TTS_RATE || '+0%';
    this.pitch = process.env.EDGE_TTS_PITCH || '+0Hz';
    this.volume = process.env.EDGE_TTS_VOLUME || '+2%';

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.audioDir = path.resolve(__dirname, '../../videos/audio');
    fs.mkdirSync(this.audioDir, { recursive: true });

    console.log('[TTSService] Initialized (Edge TTS enabled)');
  }

  /**
   * Convert script text to audio file path
   * Returns: {audioPath, duration, format}
   */
  async generateAudio(script, voiceId = 'default') {
    try {
      console.log('[TTSService] Generating audio for script (length:', script.length, ')');

      const audioScript = this.humanizeScript(script).substring(0, 3500);
      const selectedVoice = this.selectVoiceForText(audioScript, voiceId);

      if (!audioScript) {
        throw new Error('Script is empty after cleanup');
      }

      const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`;
      const audioPath = path.join(this.audioDir, filename);

      if (this.provider === 'coqui' || this.provider === 'auto') {
        const coquiSuccess = await this.tryCoquiTts(audioScript, audioPath);
        if (!coquiSuccess && this.provider === 'coqui') {
          throw new Error('Coqui TTS selected but unavailable');
        }
        if (!coquiSuccess) {
          await this.runEdgeTts(audioScript, audioPath, selectedVoice);
        }
      } else {
        await this.runEdgeTts(audioScript, audioPath, selectedVoice);
      }

      await this.normalizeAudioForSpeech(audioPath);

      const measuredDuration = await this.probeDuration(audioPath);
      const duration = measuredDuration > 0 ? measuredDuration : this.estimateDuration(audioScript);

      return {
        audioPath,
        scriptText: audioScript,
        duration,
        format: 'mp3',
        voiceId: selectedVoice,
        source: this.provider === 'coqui' ? 'coqui-tts' : 'edge-tts',
      };
    } catch (error) {
      console.error('[TTSService] Error generating audio:', error.message);
      
      // Fallback: just return script as text overlay
      return {
        audioPath: null,
        scriptText: (script || '').substring(0, 2500),
        duration: this.estimateDuration(script || ''),
        format: 'text-overlay',
        source: 'fallback',
      };
    }
  }

  async generateSceneAudio(scenes = [], voiceId = 'default') {
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return this.generateAudio('', voiceId);
    }

    const sceneOutputs = [];

    for (let i = 0; i < scenes.length; i++) {
      const text = this.humanizeScript(scenes[i]?.text || '').slice(0, 320);
      const voice = this.selectVoiceForText(text, voiceId);
      if (!text) continue;
      const scenePath = path.join(this.audioDir, `scene_tts_${Date.now()}_${i}.mp3`);

      if (this.provider === 'coqui' || this.provider === 'auto') {
        const coquiSuccess = await this.tryCoquiTts(text, scenePath);
        if (!coquiSuccess && this.provider === 'coqui') {
          throw new Error('Coqui TTS selected but unavailable');
        }
        if (!coquiSuccess) {
          await this.runEdgeTts(text, scenePath, voice);
        }
      } else {
        await this.runEdgeTts(text, scenePath, voice);
      }

      await this.normalizeAudioForSpeech(scenePath);

      const duration = await this.probeDuration(scenePath);
      sceneOutputs.push({ audioPath: scenePath, duration: duration || this.estimateDuration(text), text });
    }

    if (!sceneOutputs.length) {
      return this.generateAudio(scenes.map((s) => s?.text || '').join(' '), voiceId);
    }

    const concatListPath = path.join(this.audioDir, `scene_concat_${Date.now()}.txt`);
    const mergedPath = path.join(this.audioDir, `scene_merged_${Date.now()}.mp3`);
    fs.writeFileSync(
      concatListPath,
      sceneOutputs.map((item) => `file '${item.audioPath.replace(/'/g, "'\\''")}'`).join('\n'),
      'utf8'
    );

    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        mergedPath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (buf) => {
        stderr += buf.toString();
      });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr || `ffmpeg concat failed with code ${code}`));
      });
    });

    const mergedDuration = await this.probeDuration(mergedPath);
    let cursor = 0;
    const rawDuration = sceneOutputs.reduce((sum, item) => sum + item.duration, 0) || 1;
    const scale = mergedDuration > 0 ? (mergedDuration / rawDuration) : 1;
    const timedScenes = sceneOutputs.map((item, index) => {
      const adjusted = item.duration * scale;
      const start = cursor;
      const end = start + adjusted;
      cursor = end;
      return {
        index,
        text: item.text,
        start,
        end,
        duration: adjusted,
      };
    });

    return {
      audioPath: mergedPath,
      scriptText: scenes.map((s) => s?.text || '').join(' '),
      duration: mergedDuration || cursor,
      format: 'mp3',
      voiceId,
      source: this.provider === 'coqui' ? 'coqui-tts' : 'edge-tts',
      scenes: timedScenes,
    };
  }

  async tryCoquiTts(text, outputPath) {
    try {
      await new Promise((resolve, reject) => {
        const proc = spawn('tts', [
          '--text', text,
          '--model_name', this.coquiModel,
          '--out_path', outputPath,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        let stderr = '';
        proc.stderr.on('data', (buf) => {
          stderr += buf.toString();
        });
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(stderr || `coqui tts failed with code ${code}`));
        });
      });

      return fs.existsSync(outputPath);
    } catch (error) {
      console.warn('[TTSService] Coqui unavailable, falling back:', error.message);
      return false;
    }
  }

  async probeDuration(filePath) {
    try {
      const output = await new Promise((resolve, reject) => {
        const proc = spawn('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=noprint_wrappers=1:nokey=1',
          filePath,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (buf) => { stdout += buf.toString(); });
        proc.stderr.on('data', (buf) => { stderr += buf.toString(); });
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) {
            resolve(stdout.trim());
            return;
          }
          reject(new Error(stderr || `ffprobe failed with code ${code}`));
        });
      });

      const parsed = Number(output);
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get available voices
   */
  getAvailableVoices() {
    return [
      { id: 'default', name: 'Emma Natural', language: 'en-US' },
      { id: 'warm', name: 'Ava Warm', language: 'en-US' },
      { id: 'male', name: 'Andrew Clear', language: 'en-US' },
    ];
  }

  resolveVoice(voiceId) {
    const voiceMap = {
      default: this.voice,
      warm: 'en-US-AvaMultilingualNeural',
      male: 'en-US-AndrewMultilingualNeural',
      hinglish: this.hinglishVoice,
    };

    return voiceMap[voiceId] || voiceId || this.voice;
  }

  humanizeScript(script) {
    return String(script || '')
      .replace(/[#*_`]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/#[\w]+/g, '')
      .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
      .replace(/\s+/g, ' ')
      .replace(/\bAI\b/g, 'A I')
      .replace(/\bUSA\b/g, 'U S A')
      .replace(/\bUK\b/g, 'U K')
      .replace(/\bEU\b/g, 'E U')
      .replace(/\s*([,.!?;:])\s*/g, '$1 ')
      .replace(/\.{2,}/g, '.')
      .trim();
  }

  selectVoiceForText(text, voiceId = 'default') {
    const explicitVoice = this.resolveVoice(voiceId);
    if (voiceId && voiceId !== 'default') {
      return explicitVoice;
    }

    const sample = String(text || '').toLowerCase();
    const hasDevanagari = /[\u0900-\u097F]/.test(sample);
    const hinglishMarkers = /\b(aaj|kal|kya|kyun|kyu|kaise|dekho|samjho|dosto|yaar|bharat|sarkar|rajniti|tech|itihas)\b/;
    if (hasDevanagari || hinglishMarkers.test(sample)) {
      return this.hinglishVoice;
    }

    return explicitVoice;
  }

  async normalizeAudioForSpeech(filePath) {
    if (!filePath || !fs.existsSync(filePath)) {
      return;
    }

    const normalizedPath = `${filePath}.norm.mp3`;
    try {
      await new Promise((resolve, reject) => {
        const proc = spawn('ffmpeg', [
          '-y',
          '-i', filePath,
          '-af', 'highpass=f=70,lowpass=f=9000,loudnorm=I=-16:TP=-1.5:LRA=11',
          '-ar', '48000',
          '-ac', '2',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          normalizedPath,
        ], { stdio: ['ignore', 'pipe', 'pipe'] });

        let stderr = '';
        proc.stderr.on('data', (buf) => {
          stderr += buf.toString();
        });
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(stderr || `ffmpeg normalize failed with code ${code}`));
        });
      });

      fs.renameSync(normalizedPath, filePath);
    } catch (error) {
      if (fs.existsSync(normalizedPath)) {
        fs.unlinkSync(normalizedPath);
      }
      console.warn('[TTSService] Audio normalization skipped:', error.message);
    }
  }

  async runEdgeTts(text, audioPath, voice) {
    const runners = [
      ['edge-tts', [
        `--voice=${voice}`,
        `--rate=${this.rate}`,
        `--pitch=${this.pitch}`,
        `--volume=${this.volume}`,
        `--text=${text}`,
        `--write-media=${audioPath}`,
      ]],
      ['python3', [
        '-m', 'edge_tts',
        `--voice=${voice}`,
        `--rate=${this.rate}`,
        `--pitch=${this.pitch}`,
        `--volume=${this.volume}`,
        `--text=${text}`,
        `--write-media=${audioPath}`,
      ]],
    ];

    let lastError = null;

    for (const [command, args] of runners) {
      try {
        await new Promise((resolve, reject) => {
          const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
          let stderr = '';
          proc.stderr.on('data', (buf) => {
            stderr += buf.toString();
          });
          proc.on('error', reject);
          proc.on('close', (code) => {
            if (code === 0) {
              resolve();
              return;
            }
            reject(new Error(stderr || `${command} failed with code ${code}`));
          });
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('No Edge TTS runtime available');
  }

  /**
   * Estimate audio duration based on text
   */
  estimateDuration(text) {
    // Natural social narration target ~2.8 words/sec
    const wordCount = (text || '').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(8, Math.ceil(wordCount / 2.8));
  }
}

export default TTSService;
