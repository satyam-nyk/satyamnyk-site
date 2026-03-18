import 'dotenv/config';
import LLMService from '../src/services/gemini-service.js';

function printConfigStatus() {
  const status = {
    CLOUDFLARE_ACCOUNT_ID: Boolean(process.env.CLOUDFLARE_ACCOUNT_ID),
    CLOUDFLARE_API_TOKEN: Boolean(process.env.CLOUDFLARE_API_TOKEN),
    CLOUDFLARE_WORKERS_AI_MODEL: process.env.CLOUDFLARE_WORKERS_AI_MODEL || '(default will be used)',
  };

  console.log('[Cloudflare Smoke] Config status:', status);
}

async function main() {
  printConfigStatus();

  const noopLimiter = {
    async canMakeRequest() {
      return true;
    },
    async consumeLimit() {
      return { success: true };
    },
    async checkLimit() {
      return { available: true, remaining: 999 };
    },
  };

  let llm;
  try {
    llm = new LLMService(process.env.MISTRAL_API_KEY || null, noopLimiter, {
      geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY || null,
    });
  } catch (error) {
    console.error('[Cloudflare Smoke] LLMService initialization failed:', error.message);
    process.exit(1);
  }

  if (!llm.isWorkersAiConfigured()) {
    console.error('[Cloudflare Smoke] Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in .env');
    process.exit(1);
  }

  try {
    const textResult = await llm.callWorkersAI('Respond with one short line confirming this test is successful.', {
      temperature: 0.2,
      maxTokens: 120,
      json: false,
    });

    const jsonResultRaw = await llm.callWorkersAI(
      'Return JSON only: {"ok": true, "provider": "workers-ai", "kind": "smoke"}',
      {
        temperature: 0.1,
        maxTokens: 120,
        json: true,
      }
    );

    let jsonResult = null;
    try {
      jsonResult = llm.extractJson(jsonResultRaw) || JSON.parse(jsonResultRaw);
    } catch (_error) {
      jsonResult = { parseFailed: true, raw: String(jsonResultRaw || '').slice(0, 300) };
    }

    console.log('[Cloudflare Smoke] Text response:', textResult);
    console.log('[Cloudflare Smoke] JSON response:', jsonResult);
    console.log('[Cloudflare Smoke] SUCCESS');
  } catch (error) {
    console.error('[Cloudflare Smoke] Request failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

main();
