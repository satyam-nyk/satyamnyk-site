import { API_LIMITS } from '../config/constants.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

/**
 * VideoCompositionService - Combines stock videos, text overlays, and audio
 * Creates complete Instagram reels from components
 */
class VideoCompositionService {
  constructor() {
    this.timeout = API_LIMITS.VIDEO_COMPOSITION?.TIMEOUT || 30000;
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    this.videosDir = path.resolve(__dirname, '../../videos');
    this.tempDir = path.resolve(this.videosDir, 'temp');
    this.generatedDir = path.resolve(this.videosDir, 'generated');
    this.fontFile = process.env.REEL_FONT_FILE || '/System/Library/Fonts/Supplemental/Arial Bold.ttf';
    fs.mkdirSync(this.tempDir, { recursive: true });
    fs.mkdirSync(this.generatedDir, { recursive: true });
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
        videoSources,
        textOverlay, // {script, position}
        audioPart,   // {audioPath, scriptText}
        scenes,
        metadata     // {topic, date}
      } = components;

      console.log('[VideoCompositionService] Video source:', videoSource.title);
      const compositionId = `reel_${metadata.date}_${Math.random().toString(36).slice(2, 9)}`;
      const inputVideo = videoSource.url;
      const audioPath = audioPart?.audioPath;

      let targetDuration = Math.max(60, Math.min(120, Math.ceil(audioPart?.duration || videoSource.duration || 90)));
      if (audioPath && fs.existsSync(audioPath)) {
        const actualAudioDuration = await this.probeDuration(audioPath);
        if (actualAudioDuration > 0) {
          targetDuration = Math.max(60, Math.min(120, Math.ceil(actualAudioDuration)));
        }
      }

      const preprocessedVideo = path.join(this.tempDir, `${compositionId}_video.mp4`);
      const musicPath = path.join(this.tempDir, `${compositionId}_music.m4a`);
      const mixedAudioPath = path.join(this.tempDir, `${compositionId}_mix.m4a`);
      const badgeImagePath = path.join(this.tempDir, `${compositionId}_badge.png`);
      const outputPath = path.join(this.generatedDir, `${compositionId}.mp4`);
      await this.createBadgeImage(badgeImagePath);

      if (Array.isArray(videoSources) && videoSources.length > 0 && Array.isArray(scenes) && scenes.length > 0) {
        await this.createSceneTimelineVideo(videoSources, scenes, preprocessedVideo, targetDuration);
      } else {
        await this.createVerticalVideo(inputVideo, preprocessedVideo, targetDuration);
      }

      if (audioPath && fs.existsSync(audioPath)) {
        await this.createMusicBed(musicPath, targetDuration);
        await this.mixAudio(audioPath, musicPath, mixedAudioPath, targetDuration);
        await this.mergeVideoAudioWithBadge(preprocessedVideo, mixedAudioPath, badgeImagePath, outputPath);
      } else {
        await this.renderFinalVideo(preprocessedVideo, badgeImagePath, outputPath);
      }

      return {
        videoPath: outputPath,
        videoId: compositionId,
        videoUrl: outputPath,
        duration: targetDuration,
        quality: '1080x1920',
        format: 'mp4',
        composition: {
          videoSource: videoSource.id,
          hasTextOverlay: !!(audioPart?.scriptText || textOverlay?.script),
          hasAudio: Boolean(audioPath && fs.existsSync(audioPath)),
          position: textOverlay.position || 'bottom',
        },
        metadata: metadata,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[VideoCompositionService] Error composing reel:', error.message);
      throw error;
    }
  }

  async createVerticalVideo(input, output, duration) {
    await this.runFfmpeg([
      '-y',
      '-stream_loop', '-1',
      '-i', input,
      '-t', String(duration),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,unsharp=5:5:0.8:3:3:0.4,eq=saturation=1.08:contrast=1.04:brightness=0.02,fps=30',
      '-an',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      output,
    ]);
  }

  async createSceneTimelineVideo(videoSources, scenes, outputPath, targetDuration = 60) {
    const segmentPaths = [];
    const safeTargetDuration = Math.max(60, Number(targetDuration) || 60);

    const baseDurations = scenes.map((scene) => Math.max(4, Math.min(10, Number(scene?.duration) || 6)));
    const baseTotal = baseDurations.reduce((sum, value) => sum + value, 0) || 1;
    const durationRatio = safeTargetDuration / baseTotal;

    for (let i = 0; i < scenes.length; i++) {
      const source = videoSources[i % videoSources.length];
      const scene = scenes[i];
      const base = Math.max(4, Math.min(10, Number(scene.duration) || 6));
      const clipDuration = Math.max(4, Math.min(20, Number((base * durationRatio).toFixed(2))));
      const segmentPath = path.join(this.tempDir, `scene_${Date.now()}_${i}.mp4`);
      const captionImagePath = path.join(this.tempDir, `scene_caption_${Date.now()}_${i}.png`);

      await this.createSceneCaptionImage(captionImagePath, scene.text);
      await this.runFfmpeg([
        '-y',
        '-stream_loop', '-1',
        '-i', source.videoPath || source.videoUrl || source.url,
        '-i', captionImagePath,
        '-t', String(clipDuration),
        '-filter_complex',
        '[0:v]scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,unsharp=5:5:0.8:3:3:0.4,eq=saturation=1.08:contrast=1.04:brightness=0.02,fps=30[v0];[v0][1:v]overlay=(W-w)/2:H-h-160[v]',
        '-map', '[v]',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '18',
        '-profile:v', 'high',
        '-pix_fmt', 'yuv420p',
        segmentPath,
      ]);

      segmentPaths.push(segmentPath);
    }

    const concatPath = path.join(this.tempDir, `scene_concat_${Date.now()}.txt`);
    fs.writeFileSync(concatPath, segmentPaths.map((p) => `file '${p}'`).join('\n'), 'utf8');

    const concatOutputPath = path.join(this.tempDir, `scene_concat_output_${Date.now()}.mp4`);

    await this.runFfmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-an',
      concatOutputPath,
    ]);

    const composedDuration = await this.probeDuration(concatOutputPath);
    if (composedDuration > 0 && composedDuration >= safeTargetDuration - 0.5) {
      fs.renameSync(concatOutputPath, outputPath);
      return;
    }

    await this.createVerticalVideo(concatOutputPath, outputPath, safeTargetDuration);
  }

  async createSceneCaptionImage(filePath, text) {
    const safeText = String(text || '').slice(0, 120).replace(/"/g, '\\"');
    const script = [
      'from PIL import Image, ImageDraw, ImageFont',
      'import textwrap, sys',
      'w, h = 940, 170',
      'img = Image.new("RGBA", (w, h), (0, 0, 0, 0))',
      'draw = ImageDraw.Draw(img)',
      'draw.rounded_rectangle((0, 0, w, h), radius=22, fill=(0, 0, 0, 145))',
      'font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 36)',
      `text = "${safeText}"`,
      'lines = textwrap.wrap(text, width=36)[:2]',
      'y = 36',
      'for line in lines:',
      '    tw = draw.textlength(line, font=font)',
      '    draw.text(((w - tw) / 2, y), line, font=font, fill=(255, 255, 255, 255))',
      '    y += 50',
      'img.save(sys.argv[1])',
    ].join('\n');

    await new Promise((resolve, reject) => {
      const proc = spawn('python3', ['-c', script, filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
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
        reject(new Error(stderr || `scene caption render failed with code ${code}`));
      });
    });
  }

  buildCaptionChunks(text, totalDuration) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) {
      return [];
    }

    const chunks = clean
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 10);

    const wordCount = chunks.reduce((sum, line) => sum + line.split(/\s+/).length, 0) || 1;
    let cursor = 0;
    const rows = [];

    chunks.forEach((line, index) => {
      const words = line.split(/\s+/).length;
      const seg = Math.max(1.2, (words / wordCount) * totalDuration);
      const start = cursor;
      const end = Math.min(totalDuration, start + seg);
      cursor = end;
      rows.push({ start, end, text: line, index });
    });

    return rows;
  }

  srtTime(seconds) {
    const ms = Math.max(0, Math.floor(seconds * 1000));
    const hh = String(Math.floor(ms / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    const mmm = String(ms % 1000).padStart(3, '0');
    return `${hh}:${mm}:${ss},${mmm}`;
  }

  async mergeVideoAudioWithBadge(videoPath, audioPath, badgeImagePath, outputPath) {
    await this.runFfmpeg([
      '-y',
      '-i', videoPath,
      '-i', badgeImagePath,
      '-i', audioPath,
      '-filter_complex', '[0:v][1:v]overlay=40:H-h-44[v]',
      '-map', '[v]',
      '-map', '2:a:0',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-b:v', '12M',
      '-maxrate', '14M',
      '-bufsize', '28M',
      '-profile:v', 'high',
      '-c:a', 'aac',
      '-b:a', '320k',
      '-r', '30',
      '-shortest',
      outputPath,
    ]);
  }

  async renderFinalVideo(videoPath, badgeImagePath, outputPath) {
    await this.runFfmpeg([
      '-y',
      '-i', videoPath,
      '-i', badgeImagePath,
      '-filter_complex', '[0:v][1:v]overlay=40:H-h-44[v]',
      '-map', '[v]',
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-b:v', '12M',
      '-maxrate', '14M',
      '-bufsize', '28M',
      '-profile:v', 'high',
      '-r', '30',
      '-an',
      outputPath,
    ]);
  }

  async createMusicBed(outputPath, duration) {
    await this.runFfmpeg([
      '-y',
      '-f', 'lavfi',
      '-i', `sine=frequency=196:sample_rate=44100:duration=${duration}`,
      '-f', 'lavfi',
      '-i', `sine=frequency=294:sample_rate=44100:duration=${duration}`,
      '-filter_complex', '[0:a]volume=0.035[a0];[1:a]volume=0.02[a1];[a0][a1]amix=inputs=2:normalize=0,lowpass=f=900,afade=t=in:st=0:d=1.2,afade=t=out:st=' + Math.max(0, duration - 1.5) + ':d=1.5[a]',
      '-map', '[a]',
      '-c:a', 'aac',
      '-b:a', '96k',
      outputPath,
    ]);
  }

  async mixAudio(voicePath, musicPath, outputPath, duration) {
    await this.runFfmpeg([
      '-y',
      '-i', voicePath,
      '-i', musicPath,
      '-filter_complex', '[0:a]aresample=44100,volume=1.45,alimiter=limit=0.92[voice];[1:a]volume=0.22[music];[voice][music]amix=inputs=2:normalize=0:duration=longest[a]',
      '-map', '[a]',
      '-t', String(duration),
      '-c:a', 'aac',
      '-b:a', '160k',
      outputPath,
    ]);
  }

  async createBadgeImage(filePath) {
    const script = [
      'from PIL import Image, ImageDraw, ImageFont',
      'import sys',
      'w, h = 420, 56',
      'img = Image.new("RGBA", (w, h), (0, 0, 0, 0))',
      'draw = ImageDraw.Draw(img)',
      'draw.rounded_rectangle((0, 0, w, h), radius=18, fill=(10, 12, 18, 170))',
      'draw.rounded_rectangle((10, 12, 186, 44), radius=12, fill=(246, 201, 69, 255))',
      'font_bold = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 18)',
      'font_text = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 19)',
      'draw.text((20, 18), "FOLLOW NOW", font=font_bold, fill=(12, 12, 12, 255))',
      'draw.text((202, 17), "INSTAGRAM PAGE", font=font_text, fill=(255, 255, 255, 255))',
      'img.save(sys.argv[1])',
    ].join('; ');

    await new Promise((resolve, reject) => {
      const proc = spawn('python3', ['-c', script, filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
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
        reject(new Error(stderr || `badge render failed with code ${code}`));
      });
    });
  }

  writeOverlayAss(filePath, text, totalDuration) {
    const captionEvents = this.buildCaptionChunks(text, totalDuration)
      .map((chunk) => `Dialogue: 0,${this.assTime(chunk.start)},${this.assTime(chunk.end)},Caption,,0,0,0,,${this.assEscape(chunk.text)}`)
      .join('\n');
    const end = this.assTime(totalDuration);
    const content = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Arial,22,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,3,1,0,2,80,80,150,0
Style: Badge,Arial,20,&H00FFFFFF,&H00FFFFFF,&H00101010,&H64000000,1,0,0,0,100,100,0,0,3,1,0,1,48,48,72,0

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${captionEvents}
Dialogue: 0,0:00:00.00,${end},Badge,,0,0,0,,{\\an1}FOLLOW NOW  @satyamnyk
`;

    fs.writeFileSync(filePath, content, 'utf8');
  }

  assTime(seconds) {
    const total = Math.max(0, seconds);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = Math.floor(total % 60);
    const cs = Math.floor((total - Math.floor(total)) * 100);
    return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  assEscape(text) {
    return String(text || '').replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
  }

  escapeFilterPath(filePath) {
    const normalizedPath = path.isAbsolute(filePath)
      ? path.relative(process.cwd(), filePath)
      : filePath;

    return String(normalizedPath)
      .replace(/\\/g, '/')
      .replace(/:/g, '\\:')
      .replace(/,/g, '\\,');
  }

  async runFfmpeg(args) {
    await new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';
      proc.stderr.on('data', (buf) => { stderr += buf.toString(); });
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(stderr || `ffmpeg failed with code ${code}`));
      });
    });
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
        proc.stdout.on('data', (buf) => {
          stdout += buf.toString();
        });
        proc.stderr.on('data', (buf) => {
          stderr += buf.toString();
        });
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
    } catch (error) {
      console.warn('[VideoCompositionService] Could not probe audio duration:', error.message);
      return 0;
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
        duration: videoData.duration || 90,
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
      scenes: scriptData.scenes || audioData.scenes || [],
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
