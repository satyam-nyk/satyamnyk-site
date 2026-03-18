/**
 * Creates a 1080x1920 60-second Instagram Reel using FFmpeg
 * Topic: AI Is Replacing Jobs at Record Speed in 2026
 * 
 * Approach:
 *  - Each "slide" = solid gradient bg + bold white text overlay
 *  - Slides are concatenated into a 60s video
 *  - No external assets needed — pure FFmpeg drawtext
 */

import { execSync } from 'child_process';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outputDir = join(projectRoot, 'videos');
if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

const OUTPUT = join(outputDir, 'reel_ai_jobs_2026.mp4');

// ── Script Data ─────────────────────────────────────────────────────────────
const script = {
  topic: 'AI Is Replacing Jobs at Record Speed in 2026',
  slides: [
    {
      duration: 4,
      emoji: '🚨',
      headline: '300 MILLION JOBS',
      subtext: 'at risk from AI by 2030',
      bg: ['#0f0c29', '#302b63'],   // deep purple
    },
    {
      duration: 7,
      emoji: '🤖',
      headline: 'AI IS NO LONGER',
      subtext: 'the future — it is TODAY',
      bg: ['#1a1a2e', '#16213e'],
    },
    {
      duration: 8,
      emoji: '📉',
      headline: 'WHITE-COLLAR JOBS',
      subtext: 'coders, analysts, writers — all disrupted',
      bg: ['#0d0d0d', '#1a0000'],
    },
    {
      duration: 7,
      emoji: '🏭',
      headline: 'MANUFACTURING',
      subtext: 'robots replaced 40% of factory roles',
      bg: ['#003300', '#001a00'],
    },
    {
      duration: 8,
      emoji: '💡',
      headline: 'NEW JOBS EMERGING',
      subtext: 'AI trainers • Prompt engineers • Ethics officers',
      bg: ['#00416a', '#e4e5e6'],   // deep blue
    },
    {
      duration: 7,
      emoji: '📚',
      headline: 'RE-SKILL NOW',
      subtext: 'learn AI tools before they learn your job',
      bg: ['#4a00e0', '#8e2de2'],
    },
    {
      duration: 8,
      emoji: '🌍',
      headline: 'GLOBAL IMPACT',
      subtext: 'developing nations hit hardest — IMF warns',
      bg: ['#134e5e', '#71b280'],
    },
    {
      duration: 8,
      emoji: '🔮',
      headline: 'ADAPT OR FALL BEHIND',
      subtext: 'the AI age is here — your move',
      bg: ['#f12711', '#f5af19'],
    },
  ],
  caption: '🤖 AI is reshaping every industry in 2026. Are you ready? 300M jobs at risk — here\'s what you must know. 👇',
  hashtags: '#AI #FutureOfWork #Automation #AIRevolution #Jobs2026 #ArtificialIntelligence #TechNews #CareerAdvice #WorkTrends #Technology',
};

const W = 1080, H = 1920;
const FONT = '/System/Library/Fonts/Helvetica.ttc';   // macOS built-in
const FONT_BOLD = '/System/Library/Fonts/Helvetica.ttc';

// ── Build individual slide clips ─────────────────────────────────────────────
console.log('🎬 Building', script.slides.length, 'slide segments...\n');

const segmentFiles = [];

for (let i = 0; i < script.slides.length; i++) {
  const slide = script.slides[i];
  const segOut = join(outputDir, `seg_${i}.mp4`);
  segmentFiles.push(segOut);

  const c1 = slide.bg[0];
  const c2 = slide.bg[1];

  // Build gradient background using lavfi color + vignette, then overlay text
  // drawtext for emoji, headline, subtext
  const emojiY = '680';
  const headlineY = '820';
  const subtextY = '1020';

  // Escape colons and special chars for ffmpeg drawtext
  const escText = (t) => t
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\u2019")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/•/g, '|');

  const headlineEsc = escText(slide.headline);
  const subtextEsc = escText(slide.subtext);
  const emojiEsc = escText(slide.emoji);

  // Build gradient using gdigitalformat two-color blend via geq filter
  // We use a simpler approach: lavfi color for bg, then add text
  // For gradient: use two color boxes blended with overlay
  const r1 = parseInt(c1.slice(1, 3), 16);
  const g1 = parseInt(c1.slice(3, 5), 16);
  const b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16);
  const g2 = parseInt(c2.slice(3, 5), 16);
  const b2 = parseInt(c2.slice(5, 7), 16);

  const gradFilter = [
    // Source: gradient via geq
    `color=c=black:s=${W}x${H}:r=30`,
    `geq=r='${r1}+(${r2}-${r1})*Y/${H}':g='${g1}+(${g2}-${g1})*Y/${H}':b='${b1}+(${b2}-${b1})*Y/${H}'`,
  ].join('[bg];[bg]');

  // Build the full filtergraph
  const drawFilters = [
    // Gradient bg
    `geq=r='${r1}+(${r2}-${r1})*Y/${H}':g='${g1}+(${g2}-${g1})*Y/${H}':b='${b1}+(${b2}-${b1})*Y/${H}'`,
    // Top bar accent
    `drawbox=x=0:y=0:w=${W}:h=8:color=white@0.8:t=fill`,
    // Bottom bar accent
    `drawbox=x=0:y=${H - 8}:w=${W}:h=8:color=white@0.8:t=fill`,
    // Slide number pill
    `drawbox=x=460:y=180:w=160:h=60:color=white@0.15:t=fill`,
    `drawtext=fontfile='${FONT}':text='${i + 1} / ${script.slides.length}':fontsize=28:fontcolor=white@0.7:x=(w-tw)/2:y=197`,
    // Emoji (large)
    `drawtext=fontfile='${FONT}':text='${emojiEsc}':fontsize=120:fontcolor=white:x=(w-tw)/2:y=${emojiY}`,
    // Headline (bold, large)
    `drawtext=fontfile='${FONT_BOLD}':text='${headlineEsc}':fontsize=88:fontcolor=white:x=(w-tw)/2:y=${headlineY}:line_spacing=8`,
    // Subtext
    `drawtext=fontfile='${FONT}':text='${subtextEsc}':fontsize=48:fontcolor=white@0.85:x=(w-tw)/2:y=${subtextY}:line_spacing=6`,
    // Branding
    `drawtext=fontfile='${FONT}':text='@GlobalDailyDose':fontsize=36:fontcolor=white@0.5:x=(w-tw)/2:y=${H - 120}`,
  ].join(',');

  const cmd = [
    'ffmpeg -y',
    `-f lavfi -i color=c=black:s=${W}x${H}:r=30:d=${slide.duration}`,
    `-vf "${drawFilters}"`,
    `-c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p`,
    `-t ${slide.duration}`,
    `"${segOut}"`,
  ].join(' ');

  console.log(`  Segment ${i + 1}/${script.slides.length}: "${slide.headline}" (${slide.duration}s)`);
  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`  ✅ Done`);
  } catch (e) {
    console.error(`  ❌ FFmpeg error:\n${e.stderr?.toString().slice(-500)}`);
    process.exit(1);
  }
}

// ── Create concat list and merge ─────────────────────────────────────────────
console.log('\n🔗 Merging segments...');
const concatList = join(outputDir, 'concat.txt');
writeFileSync(concatList, segmentFiles.map(f => `file '${f}'`).join('\n'));

const mergeCmd = [
  'ffmpeg -y',
  `-f concat -safe 0 -i "${concatList}"`,
  `-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p`,
  `-movflags +faststart`,
  `"${OUTPUT}"`,
].join(' ');

try {
  execSync(mergeCmd, { stdio: 'pipe' });
} catch (e) {
  console.error('❌ Merge failed:\n', e.stderr?.toString().slice(-800));
  process.exit(1);
}

// Verify duration
const probeCmd = `ffprobe -v error -show_entries format=duration -of csv=p=0 "${OUTPUT}"`;
const duration = parseFloat(execSync(probeCmd, { encoding: 'utf8' }).trim());
console.log(`\n✅ Video created: ${OUTPUT}`);
console.log(`📐 Dimensions: ${W}x${H} (1080x1920)`);
console.log(`⏱  Duration: ${duration.toFixed(1)}s`);
console.log(`\n📝 Caption:\n${script.caption}`);
console.log(`\n#️⃣  Hashtags:\n${script.hashtags}`);

// Save caption for next step
import { writeFileSync as wfs } from 'fs';
const meta = { output: OUTPUT, caption: script.caption + '\n\n' + script.hashtags, topic: script.topic };
writeFileSync(join(outputDir, 'reel_meta.json'), JSON.stringify(meta, null, 2));
console.log('\n💾 Metadata saved to videos/reel_meta.json');
