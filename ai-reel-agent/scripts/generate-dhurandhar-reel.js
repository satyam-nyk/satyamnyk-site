import 'dotenv/config';
import { spawnSync } from 'child_process';
import Database from '../src/database/db.js';
import APILimiter from '../src/services/api-limiter.js';
import VideoAgent from '../src/agents/video-agent.js';
import StockVideoService from '../src/services/stock-video-service.js';
import TTSService from '../src/services/tts-service.js';
import VideoCompositionService from '../src/services/video-composition-service.js';

process.env.EDGE_TTS_RATE = '-18%';

const db = new Database('./database.sqlite');
await db.initDB();

const limiter = new APILimiter(db);
const stock = new StockVideoService();
const tts = new TTSService();
const composer = new VideoCompositionService();
const videoAgent = new VideoAgent(null, db, limiter, stock, tts, composer);

const sceneTexts = [
  'Dhurandhar Part 2 is trending hard, and fan pages are full of teaser theories every single day.',
  'First clarity point, there is still no final official release date announcement from the makers or studio.',
  'Most reports indicate the sequel aims for a larger action canvas with wider locations and heavier stunt design.',
  'Trade talk also suggests the story may push a darker conflict arc with a more layered and strategic antagonist.',
  'Audience expectations are high for bigger set pieces, tighter screenplay pace, and a stronger emotional backstory.',
  'At the same time, several casting updates circulating online remain unverified, so rumor posts should be treated carefully.',
  'If production scheduling remains stable, insiders expect teaser communication before the full trailer marketing window opens.',
  'Music and sound design are another big talking point, with fans hoping for a sharper score and hard hitting mix.',
  'For now, the smartest move is to follow confirmed announcements and compare each new claim against verified sources.',
  'Marketing strategy may include character posters, short motion teasers, and phased reveals to build long tail momentum.',
  'Analysts also expect social media campaigns to focus on action identity, soundtrack recall, and fan community engagement.',
  'Stay tuned for grounded updates on Dhurandhar Part 2, and skip viral noise that has no official confirmation.',
];

const script = sceneTexts.join(' ');

const scenes = [
  {
    text: sceneTexts[0],
    visualPrompt: 'cinematic film teaser style city at night, dramatic atmosphere, vertical reel',
  },
  {
    text: sceneTexts[1],
    visualPrompt: 'movie calendar page flipping, official announcement pending, cinematic',
  },
  {
    text: sceneTexts[2],
    visualPrompt: 'stylized action sequence silhouettes, sparks, smoke, vertical frame',
  },
  {
    text: sceneTexts[3],
    visualPrompt: 'mysterious antagonist silhouette, moody lighting, dramatic composition',
  },
  {
    text: sceneTexts[4],
    visualPrompt: 'cinematic set construction, lights, camera rigs, dramatic ambience',
  },
  {
    text: sceneTexts[5],
    visualPrompt: 'casting board with blurred names, newsroom style visual',
  },
  {
    text: sceneTexts[6],
    visualPrompt: 'countdown clock and teaser poster reveal concept, cinematic',
  },
  {
    text: sceneTexts[7],
    visualPrompt: 'orchestral recording room, cinematic music scoring ambience, dramatic lights',
  },
  {
    text: sceneTexts[8],
    visualPrompt: 'fact check newsroom graphics, trustworthy update concept',
  },
  {
    text: sceneTexts[9],
    visualPrompt: 'film marketing wall with posters, teaser rollout strategy visuals, cinematic lighting',
  },
  {
    text: sceneTexts[10],
    visualPrompt: 'social media analytics for film campaign, audience engagement concept, modern cinematic graphics',
  },
  {
    text: sceneTexts[11],
    visualPrompt: 'movie fans watching trailer style visuals, social feed in soft focus, cinematic ending',
  },
];

const payload = {
  script,
  videoPrompt: 'Upcoming movie Dhurandhar Part 2 cinematic teaser energy, Indian action film style, dramatic lighting, vertical 9:16',
  scenes,
};

const result = await videoAgent.generateVideoForDay(payload);
if (result == null) {
  throw new Error('Video generation failed');
}

const probe = spawnSync(
  'ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', result.videoPath],
  { encoding: 'utf8' }
);

const duration = Number((probe.stdout || '').trim() || 0);

console.log(JSON.stringify({
  success: true,
  topic: 'Dhurandhar Part 2',
  scriptChars: script.length,
  estimatedByTTS: tts.estimateDuration(script),
  videoId: result.videoId,
  videoPath: result.videoPath,
  generator: result.generator,
  durationSeconds: duration,
  quality: result.quality,
}, null, 2));

await db.closeDB();
