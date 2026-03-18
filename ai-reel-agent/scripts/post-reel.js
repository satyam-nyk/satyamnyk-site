/**
 * Post the AI Jobs reel to Instagram.
 * Steps:
 *  1. Create media container (video_url)
 *  2. Poll until status_code === FINISHED
 *  3. Publish
 */
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load .env
const envContent = readFileSync(join(projectRoot, '.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const TOKEN   = env.INSTAGRAM_ACCESS_TOKEN;
const IG_ID   = env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const BASE    = 'https://graph.facebook.com/v18.0';

const metaCandidates = [
  join(projectRoot, 'videos', 'reel_voice_meta.json'),
  join(projectRoot, 'videos', 'reel_meta.json')
];
const metaPath = metaCandidates.find((p) => existsSync(p));
if (!metaPath) {
  console.error('No metadata file found. Run create_reel_with_voice.py and upload_video.py first.');
  process.exit(1);
}

const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
const VIDEO_URL = process.env.REEL_VIDEO_URL || meta.video_url;
const CAPTION = process.env.REEL_CAPTION || meta.caption || 'Daily reel update';
const TOPIC = meta.topic || 'Daily reel topic';
const DURATION = meta.duration || 'unknown';
if (!VIDEO_URL) {
  console.error('Missing video_url in metadata. Run upload_video.py first.');
  process.exit(1);
}

console.log('🚀 Posting reel to Instagram...');
console.log(`📹 Video URL: ${VIDEO_URL}`);
console.log(`📄 Caption: ${CAPTION.slice(0, 80)}...`);
console.log(`🆔 IG Account: ${IG_ID}\n`);

// Step 1: Create media container
console.log('Step 1: Creating media container...');
const createRes = await fetch(`${BASE}/${IG_ID}/media`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    media_type: 'REELS',
    video_url: VIDEO_URL,
    caption: CAPTION,
    access_token: TOKEN,
  }),
});
const createData = await createRes.json();
if (createData.error) {
  console.error('❌ Create container failed:', JSON.stringify(createData.error, null, 2));
  process.exit(1);
}
const creationId = createData.id;
console.log(`✅ Container created: ${creationId}`);

// Step 2: Poll until FINISHED (max 5 min)
console.log('\nStep 2: Waiting for Instagram to process video...');
let status = '';
let attempts = 0;
const maxAttempts = 30;

while (status !== 'FINISHED' && attempts < maxAttempts) {
  await new Promise(r => setTimeout(r, 10000)); // wait 10s
  attempts++;

  const pollRes = await fetch(
    `${BASE}/${creationId}?fields=status_code,status&access_token=${TOKEN}`
  );
  const pollData = await pollRes.json();

  if (pollData.error) {
    console.error('❌ Poll failed:', JSON.stringify(pollData.error, null, 2));
    process.exit(1);
  }

  status = pollData.status_code;
  console.log(`  [${attempts}/${maxAttempts}] Status: ${status} — ${pollData.status || ''}`);

  if (status === 'ERROR' || status === 'EXPIRED') {
    console.error('❌ Media processing failed with status:', status);
    process.exit(1);
  }
}

if (status !== 'FINISHED') {
  console.error('❌ Timed out waiting for media to be ready.');
  process.exit(1);
}

// Step 3: Publish
console.log('\nStep 3: Publishing reel...');
const publishRes = await fetch(`${BASE}/${IG_ID}/media_publish`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    creation_id: creationId,
    access_token: TOKEN,
  }),
});
const publishData = await publishRes.json();
if (publishData.error) {
  console.error('❌ Publish failed:', JSON.stringify(publishData.error, null, 2));
  process.exit(1);
}

const postId = publishData.id;
console.log(`\n🎉 REEL PUBLISHED SUCCESSFULLY!`);
console.log(`📌 Post ID: ${postId}`);
console.log(`🔗 View at: https://www.instagram.com/p/${postId}/`);
console.log(`\n📝 Topic: ${TOPIC}`);
console.log(`📐 Dimensions: 1080x1920  |  ⏱ Duration: ${DURATION}s`);
