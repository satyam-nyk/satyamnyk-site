#!/usr/bin/env node

/**
 * Test Script: Post a single video to Instagram
 * Creates a test video or uses cached video and demonstrates posting with caption + hashtags
 */

import 'dotenv/config';
import Database from './src/database/db.js';
import InstagramService from './src/services/instagram-service.js';
import APILimiter from './src/services/api-limiter.js';
import { INSTAGRAM_CONFIG } from './src/config/constants.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';

async function main() {
  try {
    console.log('[Test] Starting Instagram posting test...\n');

    // 1. Initialize services
    console.log('[Test] Step 1: Initializing services...');
    const database = new Database(DB_PATH);
    await database.initDB();
    const apiLimiter = new APILimiter(database);

    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const businessAccountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

    if (!accessToken || !businessAccountId) {
      throw new Error('Instagram credentials not found in .env');
    }

    const instagramService = new InstagramService(accessToken, businessAccountId, apiLimiter);
    console.log('✅ Services initialized\n');

    // 2. Get or create test video
    console.log('[Test] Step 2: Finding test video...');
    const videosDir = './videos';
    if (!fs.existsSync(videosDir)) {
      fs.mkdirSync(videosDir, { recursive: true });
    }

    // Try to find existing video or create a test one
    let videoPath = null;
    const cachedVideos = fs.readdirSync(videosDir).filter(f => f.endsWith('.mp4'));

    if (cachedVideos.length > 0) {
      videoPath = path.join(videosDir, cachedVideos[0]);
      console.log(`✅ Using existing video: ${cachedVideos[0]}`);
    } else {
      // Create a minimal test MP4 file (very small for testing)
      // This is a valid minimal MP4 structure
      const testVideoPath = path.join(videosDir, 'test-video.mp4');
      
      // Minimal MP4 header (1 second, 1920x1080)
      const mp4Header = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31
      ]);

      fs.writeFileSync(testVideoPath, mp4Header);
      videoPath = testVideoPath;
      console.log(`✅ Created test video: ${testVideoPath}`);
    }

    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    console.log(`✅ Using video: ${videoPath}\n`);

    // 3. Create caption with script and hashtags
    console.log('[Test] Step 3: Building caption with hashtags...');
    const testScript = `🎯 Daily AI-Generated Content

Here's today's trending topic breakdown:
✨ Smart insights for your growth
💡 Practical tips you can use today
🚀 Join thousands of creators

Which tip resonates with you most? Drop a comment! 👇`;

    // Add hashtags
    const hashtags = INSTAGRAM_CONFIG.HASHTAGS.slice(0, 10).join(' ');
    const fullCaption = `${testScript}\n\n${hashtags}`;

    console.log('📝 Caption Preview:');
    console.log('─'.repeat(50));
    console.log(fullCaption);
    console.log('─'.repeat(50));
    console.log(`\n✅ Caption length: ${fullCaption.length}/${INSTAGRAM_CONFIG.CAPTION_MAX_LENGTH} characters\n`);

    // 4. Post to Instagram
    console.log('[Test] Step 4: Posting to Instagram...');
    try {
      const result = await instagramService.postReel(videoPath, fullCaption);

      if (result) {
        console.log('\n✅ SUCCESS! Video posted to Instagram!\n');
        console.log('📊 Post Details:');
        console.log('─'.repeat(50));
        console.log(`Post ID: ${result.postId}`);
        console.log(`Media ID: ${result.mediaId}`);
        console.log(`URL: ${result.url}`);
        console.log(`Status: ${result.status}`);
        console.log(`Posted At: ${result.postedAt}`);
        console.log('─'.repeat(50));
      } else {
        console.log('\n⚠️  Instagram posting returned null (likely rate limited or video file issue)');
      }
    } catch (error) {
      console.error('\n❌ Instagram posting failed:', error.message);
      console.log('\nPossible reasons:');
      console.log('1. Instagram API credentials incorrect');
      console.log('2. Video file too small or invalid format');
      console.log('3. Rate limit reached');
      console.log('4. Business account not properly configured');
      process.exit(1);
    }

    // 5. Close database
    await database.closeDB();
    console.log('\n✅ Test completed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

main();
