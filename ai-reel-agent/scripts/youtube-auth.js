import 'dotenv/config';
import YouTubeService from '../src/services/youtube-service.js';

function printUsage() {
  console.log('YouTube OAuth helper');
  console.log('');
  console.log('Usage:');
  console.log('  npm run youtube:auth');
  console.log('  npm run youtube:auth -- url');
  console.log('  npm run youtube:auth -- exchange <authorization_code>');
  console.log('');
}

async function main() {
  const yt = new YouTubeService();
  const mode = process.argv[2] || 'url';

  if (mode === 'help' || mode === '--help' || mode === '-h') {
    printUsage();
    return;
  }

  if (mode === 'url') {
    const url = yt.getAuthUrl();
    console.log('Open this URL in your browser and complete consent:');
    console.log(url);
    return;
  }

  if (mode === 'exchange') {
    const code = process.argv[3];
    if (!code) {
      throw new Error('Missing authorization code. Use: npm run youtube:auth -- exchange <code>');
    }

    const tokens = await yt.exchangeCodeForTokens(code);
    console.log('OAuth token exchange successful. Save these in your local .env:');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token || ''}`);
    console.log(`YOUTUBE_ACCESS_TOKEN_EXPIRES_IN=${tokens.expires_in || ''}`);
    console.log('');
    console.log('Raw response:');
    console.log(JSON.stringify(tokens, null, 2));
    return;
  }

  printUsage();
  throw new Error(`Unknown mode: ${mode}`);
}

main().catch((error) => {
  console.error('[youtube-auth] Failed:', error.message);
  process.exit(1);
});
