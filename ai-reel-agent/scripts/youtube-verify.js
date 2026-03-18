import 'dotenv/config';
import YouTubeService from '../src/services/youtube-service.js';

async function main() {
  const yt = new YouTubeService();
  const channel = await yt.getOwnChannel();

  if (!channel) {
    console.log('No channel returned. Check OAuth credentials and scopes.');
    process.exit(1);
  }

  console.log('YouTube connection verified.');
  console.log(JSON.stringify({
    id: channel.id,
    title: channel.snippet?.title,
    customUrl: channel.snippet?.customUrl,
    subscriberCount: channel.statistics?.subscriberCount,
    videoCount: channel.statistics?.videoCount,
    viewCount: channel.statistics?.viewCount,
  }, null, 2));
}

main().catch((error) => {
  console.error('[youtube-verify] Failed:', error.message);
  process.exit(1);
});
