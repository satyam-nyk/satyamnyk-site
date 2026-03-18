/**
 * Post specific video files to Instagram directly.
 * Usage: node scripts/post-videos.js
 */
import 'dotenv/config';
import { spawnSync } from 'child_process';
import fs from 'fs';
import Database from '../src/database/db.js';
import APILimiter from '../src/services/api-limiter.js';
import InstagramService from '../src/services/instagram-service.js';
import { INSTAGRAM_CONFIG, STATUS } from '../src/config/constants.js';

// ── Videos to post ────────────────────────────────────────────────────────────
const VIDEOS = [
  {
    path: './videos/generated/reel_2026-03-13_b11ncf2.mp4',
    topic: 'Amazing Life Hacks That Will Change Your Daily Routine',
    caption: `🔥 These life hacks are absolutely mind-blowing! 🤯

Most people go through their entire lives without knowing these simple tricks...

Here's what you've been missing all along 👇

✅ Save time every single day
✅ Work smarter, not harder
✅ Level up your daily routine instantly

Drop a 🔥 in the comments if this helped you!
Tag someone who NEEDS to see this right now! 👥

Follow for more daily life hacks that actually work! ✨`,
  },
  {
    path: './videos/generated/reel_2026-03-13_rabzj4d.mp4',
    topic: 'Mind-Blowing Facts You Never Knew',
    caption: `🧠 These facts will literally blow your mind! 💥

99% of people don't know these incredible truths...

Wait until you see the last one — it changes everything! 👀

🔹 Surprising facts that challenge what you know
🔹 Science-backed and completely real
🔹 Share this with someone who loves learning

Comment your favourite fact below! 💬
Follow for more incredible content daily! 🚀`,
  },
];

async function postVideo(instagram, db, videoInfo, index) {
  const { path: videoPath, topic, caption } = videoInfo;
  const label = `[Video ${index + 1}/${VIDEOS.length}]`;

  console.log(`\n${label} Topic: ${topic}`);
  console.log(`${label} Path: ${videoPath}`);

  if (!fs.existsSync(videoPath)) {
    console.error(`${label} ❌ File not found: ${videoPath}`);
    return null;
  }

  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', videoPath],
    { encoding: 'utf8' }
  );
  const duration = Number((probe.stdout || '').trim() || 0);
  console.log(`${label} Duration: ${duration.toFixed(2)}s`);

  const hashtagsStr = INSTAGRAM_CONFIG.HASHTAGS.slice(0, 15).join(' ');
  const fullCaption = `${caption}\n\n${hashtagsStr}`;

  console.log(`${label} Uploading to Instagram...`);
  const result = await instagram.postReel(videoPath, fullCaption);

  if (!result) throw new Error('Instagram returned null result');
  console.log(`${label} ✅ Posted! Post ID: ${result.postId}`);

  // Record in DB as a posted entry
  const today = new Date().toISOString().split('T')[0];
  const videoId = videoPath.replace(/^.*\//, '').replace('.mp4', '');
  await db.upsertDailyPost(today, {
    topic,
    script: caption,
    videoId,
    status: STATUS.POSTED,
    method: 'manual-upload',
  });
  await db.updatePostWithInstagram(today, result.postId, STATUS.POSTED);

  return result;
}

async function main() {
  const db = new Database('./database.sqlite');
  await db.initDB();

  const limiter = new APILimiter(db);
  const instagram = new InstagramService(
    process.env.INSTAGRAM_ACCESS_TOKEN,
    process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    limiter
  );

  const results = [];

  for (let i = 0; i < VIDEOS.length; i++) {
    try {
      const result = await postVideo(instagram, db, VIDEOS[i], i);
      if (result) {
        results.push({ video: VIDEOS[i].path, postId: result.postId, success: true });
      }
    } catch (err) {
      console.error(`[Video ${i + 1}] ❌ Error:`, err.message);
      results.push({ video: VIDEOS[i].path, error: err.message, success: false });
    }

    // Small delay between posts to avoid rate limits
    if (i < VIDEOS.length - 1) {
      console.log('\nWaiting 10 seconds before next post...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  await db.closeDB();

  console.log('\n' + '═'.repeat(50));
  console.log('RESULTS');
  console.log('═'.repeat(50));
  results.forEach((r, i) => {
    const file = r.video.split('/').pop();
    if (r.success) {
      console.log(`✅ ${file} → Post ID: ${r.postId}`);
      console.log(`   URL: https://www.instagram.com/p/${r.postId}/`);
    } else {
      console.log(`❌ ${file} → Error: ${r.error}`);
    }
  });
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
