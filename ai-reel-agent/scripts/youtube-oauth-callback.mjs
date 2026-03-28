import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import YouTubeService from '../src/services/youtube-service.js';

const y = new YouTubeService();
const envPath = path.resolve('.env');

const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://localhost:8080');
    if (u.pathname !== '/oauth2callback') {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const code = u.searchParams.get('code');
    if (!code) {
      res.statusCode = 400;
      res.end('Missing code');
      return;
    }

    const tokens = await y.exchangeCodeForTokens(code);
    const refresh = tokens?.refresh_token;
    if (!refresh) {
      throw new Error('No refresh_token returned. Revoke app access and re-consent with prompt=consent if needed.');
    }

    let env = '';
    try {
      env = fs.readFileSync(envPath, 'utf8');
    } catch {}

    if (/(^|\n)YOUTUBE_REFRESH_TOKEN=.*/.test(env)) {
      env = env.replace(/(^|\n)YOUTUBE_REFRESH_TOKEN=.*/, '$1YOUTUBE_REFRESH_TOKEN=' + refresh);
    } else {
      env += (env.endsWith('\n') || env.length === 0 ? '' : '\n') + 'YOUTUBE_REFRESH_TOKEN=' + refresh + '\n';
    }

    fs.writeFileSync(envPath, env, 'utf8');

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end('<h2>YouTube token captured successfully. You can close this tab.</h2>');

    console.log('YOUTUBE_REFRESH_TOKEN_UPDATED=1');
    server.close(() => process.exit(0));
  } catch (err) {
    console.error('YOUTUBE_OAUTH_CALLBACK_ERROR=' + err.message);
    res.statusCode = 500;
    res.end('OAuth failed: ' + err.message);
  }
});

server.listen(8080, () => {
  console.log('YOUTUBE_OAUTH_CALLBACK_LISTENER_READY=1');
});
