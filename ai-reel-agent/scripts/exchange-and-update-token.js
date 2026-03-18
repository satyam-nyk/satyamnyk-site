import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const projectRoot = process.cwd();
const envPath = join(projectRoot, '.env');

const shortToken = process.argv[2];
if (!shortToken) {
  console.error('Usage: node scripts/exchange-and-update-token.js <short_token>');
  process.exit(1);
}

const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=820937153599049&client_secret=a4826916d991f600824d2eeb21746749&fb_exchange_token=${encodeURIComponent(shortToken)}`;
const resp = await fetch(url);
const data = await resp.json();
if (data.error || !data.access_token) {
  console.error('Exchange failed:', JSON.stringify(data.error || data));
  process.exit(1);
}

const longToken = data.access_token;

// Validate token quickly
const meResp = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${encodeURIComponent(longToken)}`);
const meData = await meResp.json();
if (meData.error) {
  console.error('Token validation failed:', JSON.stringify(meData.error));
  process.exit(1);
}

let env = readFileSync(envPath, 'utf8');
if (/^INSTAGRAM_ACCESS_TOKEN=.*/m.test(env)) {
  env = env.replace(/^INSTAGRAM_ACCESS_TOKEN=.*/m, `INSTAGRAM_ACCESS_TOKEN=${longToken}`);
} else {
  env += `\nINSTAGRAM_ACCESS_TOKEN=${longToken}\n`;
}
writeFileSync(envPath, env);

console.log('Updated .env with long-lived token.');
console.log('Token length:', longToken.length);
console.log('User ID:', meData.id);
