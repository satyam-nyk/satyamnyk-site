import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

// Load env manually
const envContent = readFileSync(join(projectRoot, '.env'), 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.+)$/);
  if (m) env[m[1]] = m[2].trim();
}

const key = env.GOOGLE_GEMINI_API_KEY;
const videosDir = join(projectRoot, 'videos');
const outputFile = join(videosDir, 'script.json');

const decodeHtml = (s) => s
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/<!\[CDATA\[|\]\]>/g, '');

const cleanTitle = (s) => decodeHtml(s)
  .replace(/\s+-\s+(Reuters|AP News|BBC|CNBC|The Guardian|Al Jazeera|NYTimes|The New York Times).*$/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const parseRssTitles = (xml) => {
  const titles = [];
  const itemRegex = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const t = cleanTitle(m[1] || '');
    if (t && !/^(top stories|world)$/i.test(t)) titles.push(t);
  }
  return titles;
};

const fetchRecentHeadlines = async () => {
  const feeds = [
    'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
    'https://feeds.reuters.com/reuters/worldNews',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://feeds.bbci.co.uk/news/world/rss.xml'
  ];

  const all = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const xml = await res.text();
      const titles = parseRssTitles(xml).slice(0, 8);
      for (const t of titles) all.push(t);
    } catch {
      // Continue with remaining feeds.
    }
  }

  const dedup = [];
  const seen = new Set();
  for (const t of all) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(t);
  }
  return dedup.slice(0, 20);
};

const fallbackScript = {
  topic: 'Global Inflation and Jobs Outlook',
  hook: 'What the latest global headlines really mean',
  tone: 'neutral-explainer',
  angle: 'fact-based, balanced, non-partisan',
  slides: [
    { text: 'Recent global data shows inflation easing in some regions', duration: 7, graphic: 'line', stat_value: '4.1%' },
    { text: 'But food and energy prices remain volatile worldwide', duration: 7, graphic: 'bar', stat_value: 'High variance' },
    { text: 'Central banks still balance growth against price stability', duration: 7, graphic: 'split', stat_value: 'Growth vs inflation' },
    { text: 'Labor markets stay tight in services but soften in manufacturing', duration: 7, graphic: 'bar', stat_value: 'Mixed labor trends' },
    { text: 'Emerging economies face stronger currency and debt pressure', duration: 7, graphic: 'map', stat_value: 'Uneven risk' },
    { text: 'Policy choices now shape household costs and job demand', duration: 7, graphic: 'timeline', stat_value: 'Policy lag effects' },
    { text: 'Analysts expect uneven progress, not one global outcome', duration: 7, graphic: 'stat', stat_value: 'No single trend' },
    { text: 'Watch data monthly and avoid one-sided narratives', duration: 8, graphic: 'arrow', stat_value: 'Stay objective' }
  ],
  caption: 'A neutral look at recent global economic headlines and what they actually indicate.',
  hashtags: '#GlobalNews #Economy #Inflation #Jobs #Policy #WorldUpdate #DataDriven #Explainer #CurrentAffairs #Unbiased'
};

const saveScript = (data, source) => {
  mkdirSync(videosDir, { recursive: true });
  writeFileSync(outputFile, JSON.stringify(data, null, 2));
  console.error(`SCRIPT_SOURCE=${source}`);
  console.error(`SCRIPT_FILE=${outputFile}`);
  console.log(JSON.stringify(data, null, 2));
};

const headlines = await fetchRecentHeadlines();
console.error(`HEADLINES_FOUND=${headlines.length}`);

const prompt = `You are a neutral newsroom explainer scriptwriter for short vertical videos.
Date context: March 2026.

Recent headlines list:
${headlines.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Task:
1) Pick ONE currently trending global topic from the headlines above.
2) Write a balanced, fact-first, non-partisan 56-60 second script.
3) Avoid sensational or biased framing and avoid taking sides.
4) Make it engaging but objective.

Return ONLY valid JSON (no markdown, no code fences) with EXACT fields:
{
  "topic": "max 9 words",
  "hook": "max 11 words",
  "tone": "neutral-explainer",
  "angle": "one-line balanced framing",
  "slides": [
    {
      "text": "max 14 words, factual",
      "duration": 7,
      "graphic": "bar|line|timeline|split|map|stat|arrow",
      "stat_value": "short text/number"
    }
  ],
  "caption": "max 220 chars, neutral",
  "hashtags": "10 relevant hashtags"
}

Constraints:
- Exactly 8 slides.
- Total duration must be between 56 and 60 seconds.
- Mention at least one uncertainty/limitation in the narrative.
- Use plain English and avoid loaded language.`;

const models = ['gemini-2.0-flash', 'gemini-2.5-flash-lite'];

let generated = null;
for (const model of models) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      }
    );
    const data = await response.json();
    if (data.error) {
      console.error(`GEMINI_${model}_ERROR:`, JSON.stringify(data.error));
      continue;
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) continue;
    const clean = text.replace(/^```json\s*/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed.slides) || parsed.slides.length !== 8) {
      throw new Error('Invalid slides structure from model');
    }
    generated = parsed;
    generated.research_headlines = headlines;
    saveScript(generated, `gemini:${model}`);
    break;
  } catch (err) {
    console.error(`GEMINI_${model}_EXCEPTION:`, err.message);
  }
}

if (!generated) {
  fallbackScript.research_headlines = headlines;
  saveScript(fallbackScript, 'local-fallback');
}
