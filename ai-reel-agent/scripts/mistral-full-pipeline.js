/**
 * Full Mistral-only pipeline:
 *   1. Get YESTERDAY's trending topic via Mistral
 *   2. Generate 60-second script via Mistral
 *   3. Queue script in DB
 *   4. Generate video + audio (stock + TTS)
 *   5. Post to Instagram (force=1 duplicate-safe)
 *   6. Print summary
 */
import 'dotenv/config';
import { spawnSync } from 'child_process';
import Database from '../src/database/db.js';
import APILimiter from '../src/services/api-limiter.js';
import LLMService from '../src/services/gemini-service.js';
import ScriptAgent from '../src/agents/script-agent.js';
import ResearchAgent from '../src/agents/research-agent.js';
import VideoAgent from '../src/agents/video-agent.js';
import StockVideoService from '../src/services/stock-video-service.js';
import TTSService from '../src/services/tts-service.js';
import VideoCompositionService from '../src/services/video-composition-service.js';
import InstagramService from '../src/services/instagram-service.js';
import { STATUS, INSTAGRAM_CONFIG } from '../src/config/constants.js';
import fs from 'fs';

// ── Validate Mistral key ─────────────────────────────────────────────────────
if (!process.env.MISTRAL_API_KEY) {
  throw new Error('MISTRAL_API_KEY missing from .env — cannot run Mistral-only pipeline');
}
console.log('[Pipeline] Mistral API key loaded ✓');

// ── Boot services ────────────────────────────────────────────────────────────
const db = new Database('./database.sqlite');
await db.initDB();

const limiter = new APILimiter(db);

// Mistral-only LLM: no gemini fallback key passed
const llm = new LLMService(process.env.MISTRAL_API_KEY, limiter, {
  geminiApiKey: null,
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
});

const scriptAgent = new ScriptAgent(llm, db, limiter);
const researchAgent = new ResearchAgent(llm, db, limiter);
const stock = new StockVideoService();
const tts = new TTSService();
const composer = new VideoCompositionService();
const videoAgent = new VideoAgent(null, db, limiter, stock, tts, composer);
const instagram = new InstagramService(
  process.env.INSTAGRAM_ACCESS_TOKEN,
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
  limiter
);

// ── Step 1: Get yesterday's trending topic via Mistral ──────────────────────
const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
console.log(`\n[Step 1] Fetching yesterday's trending topic (${yesterday.toISOString().split('T')[0]}) with Mistral...`);
const topic = await researchAgent.researchYesterdaysTrendingTopic();
if (!topic || !topic.topic) {
  throw new Error('Mistral returned no topic — check API key and quota');
}
console.log('[Step 1] ✓ Topic:', topic.topic, '| Trend date:', topic.trendDate || 'N/A');

// ── Step 2: Generate script via Mistral ──────────────────────────────────────
console.log('\n[Step 2] Generating script with Mistral...');
const scriptData = await scriptAgent.generateScript(topic);
console.log('[Step 2] ✓ Script generated, duration:', scriptData.duration, 's, scenes:', scriptData.scenes?.length || 0);

// ── Step 3: Queue script ─────────────────────────────────────────────────────
console.log('\n[Step 3] Queuing script in database...');
await db.insertScriptQueue([{
  topic: scriptData.topic,
  script: scriptData.script,
  duration: scriptData.duration,
  hooks: {
    primary: scriptData.hooks,
    cta: scriptData.cta,
    videoPrompt: scriptData.videoPrompt,
    scenes: scriptData.scenes,
  },
}]);
const queued = await db.getQueuedScript();
if (!queued) {
  throw new Error('Script was not queued properly');
}
console.log('[Step 3] ✓ Queued script id:', queued.id, '| topic:', queued.topic);

// ── Step 4: Generate video + audio ───────────────────────────────────────────
console.log('\n[Step 4] Generating video + audio...');
const videoPayload = {
  script: scriptData.script,
  videoPrompt: scriptData.videoPrompt,
  scenes: scriptData.scenes,
};
const video = await videoAgent.generateVideoForDay(videoPayload);
if (!video) {
  throw new Error('Video generation failed');
}

// Verify file actually exists
if (!fs.existsSync(video.videoPath)) {
  throw new Error(`Generated video file not found at: ${video.videoPath}`);
}

const probe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', video.videoPath],
  { encoding: 'utf8' }
);
const videoDurationSeconds = Number((probe.stdout || '').trim() || 0);
console.log('[Step 4] ✓ Video path:', video.videoPath);
console.log('[Step 4] ✓ Duration (ffprobe):', videoDurationSeconds.toFixed(2), 's | generator:', video.generator);

// ── Step 5: Post to Instagram (force, duplicate-safe) ────────────────────────
console.log('\n[Step 5] Posting to Instagram (force mode)...');
const caption = `${scriptData.script}\n\n${INSTAGRAM_CONFIG.HASHTAGS.slice(0, 10).join(' ')}`;
let instagramResult = null;

try {
  instagramResult = await instagram.postReel(video.videoPath, caption);
} catch (igErr) {
  console.error('[Step 5] Instagram post error:', igErr.message);
  throw igErr;
}

if (!instagramResult) {
  throw new Error('Instagram returned no result');
}
console.log('[Step 5] ✓ Posted! Instagram post id:', instagramResult.postId);

// ── Step 6: Mark script as posted + upsert daily_posts row ──────────────────
const today = new Date().toISOString().split('T')[0];
await db.updateScriptStatus(queued.id, STATUS.POSTED, video.videoId, instagramResult.postId);
await db.upsertDailyPost(today, {
  topic: scriptData.topic,
  script: scriptData.script,
  videoId: video.videoId,
  status: STATUS.POSTED,
  method: video.generator,
});
await db.updatePostWithInstagram(today, instagramResult.postId, STATUS.POSTED);
console.log('[Step 6] ✓ DB updated: script marked posted, daily post row upserted');

// ── Final summary ─────────────────────────────────────────────────────────────
const summary = {
  success: true,
  llmProvider: 'mistral-only',
  topic: scriptData.topic,
  scriptPreview: scriptData.script.replace(/\s+/g, ' ').substring(0, 200) + '...',
  scriptDuration: scriptData.duration,
  scenes: scriptData.scenes?.length || 0,
  videoId: video.videoId,
  videoPath: video.videoPath,
  videoGenerator: video.generator,
  videoDurationSeconds,
  instagramPostId: instagramResult.postId,
  instagramUrl: instagramResult.url || `https://www.instagram.com/p/${instagramResult.postId}/`,
  timestamp: new Date().toISOString(),
};

console.log('\n' + '═'.repeat(60));
console.log('PIPELINE COMPLETE');
console.log('═'.repeat(60));
console.log(JSON.stringify(summary, null, 2));

await db.closeDB();
