import dotenv from 'dotenv';
import path from 'path';
import Database from '../src/database/db.js';
import APILimiter from '../src/services/api-limiter.js';
import LLMService from '../src/services/gemini-service.js';
import ResearchAgent from '../src/agents/research-agent.js';
import ScriptAgent from '../src/agents/script-agent.js';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const projectRoot = new URL('../', import.meta.url);
const configuredDbPath = process.env.DATABASE_PATH || './database.sqlite';
const resolvedDbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.resolve(projectRoot.pathname, configuredDbPath);

async function main() {
  const db = new Database(resolvedDbPath);
  await db.initDB();

  const limiter = new APILimiter(db);
  const llm = new LLMService(process.env.MISTRAL_API_KEY, limiter, {
    geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY,
    mistralModel: process.env.MISTRAL_MODEL,
  });
  const research = new ResearchAgent(llm, db, limiter);
  const scriptAgent = new ScriptAgent(llm, db, limiter);

  let queued = await db.getQueuedScript();

  if (!queued) {
    let topic = null;
    try {
      topic = await research.researchTodaysTopic();
    } catch {
      topic = { topic: 'Practical Life Hacks That Work' };
    }

    const script = await scriptAgent.generateScript(topic);

    await db.insertScriptQueue([
      {
        topic: script.topic,
        script: script.script,
        duration: script.duration,
        hooks: {
          primary: script.hooks,
          cta: script.cta,
          videoPrompt: script.videoPrompt,
          scenes: script.scenes,
        },
      },
    ]);

    queued = await db.getQueuedScript();
    console.log('Queued script:', queued?.id, queued?.topic);
  } else {
    console.log('Using queued script:', queued.id, queued.topic);
  }

  const headers = {};
  if (process.env.WEBHOOK_SECRET) {
    headers.Authorization = `Bearer ${process.env.WEBHOOK_SECRET}`;
  }

  const response = await fetch('http://127.0.0.1:3000/api/webhook/manual-post', {
    method: 'POST',
    headers,
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});