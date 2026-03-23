import axios from 'axios';
import { API_LIMITS, SCRIPT_CONFIG, VIDEO_CONFIG } from '../config/constants.js';

/**
 * LLMService - Handles primary Mistral + fallback Gemini interactions
 * Keeps existing method names to avoid breaking agent wiring.
 */
class LLMService {
  constructor(mistralApiKey, apiLimiter, options = {}) {
    this.mistralApiKey = mistralApiKey || null;
    this.geminiApiKey = options.geminiApiKey || null;
    this.apiLimiter = apiLimiter;
    this.aiGatewayEnabled = String(process.env.AI_GATEWAY_ENABLED || options.aiGatewayEnabled || 'false').toLowerCase() === 'true';
    this.aiGatewayUrl = process.env.AI_GATEWAY_URL || options.aiGatewayUrl || '';
    this.aiGatewayToken = process.env.AI_GATEWAY_TOKEN || options.aiGatewayToken || '';
    this.aiGatewayModel = process.env.AI_GATEWAY_MODEL || options.aiGatewayModel || '';
    this.mistralBaseURL = this.aiGatewayEnabled && this.aiGatewayUrl
      ? this.aiGatewayUrl
      : 'https://api.mistral.ai/v1/chat/completions';
    this.geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.mistralModel = process.env.MISTRAL_MODEL || options.mistralModel || 'mistral-small-latest';
    this.cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID || options.cloudflareAccountId || '';
    this.cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN || options.cloudflareApiToken || '';
    this.workersAiModel = process.env.CLOUDFLARE_WORKERS_AI_MODEL || options.workersAiModel || '@cf/meta/llama-3.2-3b-instruct';
    this.workersAiBaseURL = this.cloudflareAccountId
      ? `https://api.cloudflare.com/client/v4/accounts/${this.cloudflareAccountId}/ai/run`
      : '';
    this.timeout = API_LIMITS.MISTRAL.TIMEOUT;

    if (!this.mistralApiKey && !this.geminiApiKey && !this.isAiGatewayConfigured() && !this.isWorkersAiConfigured()) {
      throw new Error('MISTRAL_API_KEY or GOOGLE_GEMINI_API_KEY is required (or configure AI Gateway / Workers AI)');
    }

    if (this.aiGatewayEnabled && !this.isAiGatewayConfigured()) {
      console.warn('[LLMService] AI Gateway enabled but AI_GATEWAY_URL/AI_GATEWAY_TOKEN is missing. Falling back to direct providers.');
    }
  }

  isWorkersAiConfigured() {
    return Boolean(this.workersAiBaseURL) && Boolean(this.cloudflareApiToken) && Boolean(this.workersAiModel);
  }

  isAiGatewayConfigured() {
    return this.aiGatewayEnabled && Boolean(this.aiGatewayUrl) && Boolean(this.aiGatewayToken);
  }

  getMistralEndpoint() {
    if (this.isAiGatewayConfigured()) {
      return this.aiGatewayUrl;
    }
    return this.mistralBaseURL;
  }

  getMistralHeaders() {
    if (this.isAiGatewayConfigured()) {
      return {
        'cf-aig-authorization': `Bearer ${this.aiGatewayToken}`,
        'Content-Type': 'application/json',
      };
    }

    return {
      Authorization: `Bearer ${this.mistralApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async callMistral(prompt, { temperature = 0.7, maxTokens = 800, json = false } = {}) {
    if (!this.mistralApiKey && !this.isAiGatewayConfigured()) {
      throw new Error('Mistral API key is not configured');
    }

    const payload = {
      model: this.aiGatewayModel || this.mistralModel,
      messages: [
        {
          role: 'system',
          content: json
            ? 'You are a precise assistant that returns strict JSON only when requested.'
            : 'You are a precise assistant for Instagram Reels content generation.',
        },
        { role: 'user', content: prompt },
      ],
      temperature,
      max_tokens: maxTokens,
    };

    if (json) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(this.getMistralEndpoint(), payload, {
      timeout: this.timeout,
      headers: this.getMistralHeaders(),
    });

    return response.data?.choices?.[0]?.message?.content || null;
  }

  async callGemini(prompt, { temperature = 0.7, maxTokens = 800 } = {}) {
    if (!this.geminiApiKey) {
      throw new Error('Gemini API key is not configured');
    }

    const response = await axios.post(
      `${this.geminiBaseURL}?key=${this.geminiApiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      },
      { timeout: this.timeout }
    );

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  }

  extractWorkersAiText(data) {
    const result = data?.result;
    if (!result) return null;
    if (typeof result === 'string') return result;
    if (typeof result.response === 'string') return result.response;
    if (typeof result.output_text === 'string') return result.output_text;

    if (Array.isArray(result.messages) && result.messages.length > 0) {
      const assistant = [...result.messages].reverse().find((msg) => msg?.role === 'assistant');
      if (assistant && typeof assistant.content === 'string') {
        return assistant.content;
      }
    }

    if (Array.isArray(result.content)) {
      const textParts = result.content
        .map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .filter(Boolean);
      if (textParts.length > 0) {
        return textParts.join('\n');
      }
    }

    return null;
  }

  async callWorkersAI(prompt, { temperature = 0.7, maxTokens = 800, json = false } = {}) {
    if (!this.isWorkersAiConfigured()) {
      throw new Error('Cloudflare Workers AI is not configured');
    }

    const payload = {
      messages: [
        {
          role: 'system',
          content: json
            ? 'You are a precise assistant that returns strict JSON only when requested.'
            : 'You are a precise assistant for Instagram Reels content generation.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature,
    };

    if (json) {
      payload.response_format = { type: 'json_object' };
    }

    const response = await axios.post(
      `${this.workersAiBaseURL}/${this.workersAiModel}`,
      payload,
      {
        timeout: this.timeout,
        headers: {
          Authorization: `Bearer ${this.cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return this.extractWorkersAiText(response.data);
  }

  async tryWorkersAiJson(prompt, { temperature = 0.7, maxTokens = 800 } = {}) {
    if (!this.isWorkersAiConfigured()) return null;

    if (this.apiLimiter && !(await this.apiLimiter.canMakeRequest('WORKERS_AI'))) {
      console.warn('[LLMService] Workers AI quota unavailable for JSON generation');
      return null;
    }

    try {
      const content = await this.callWorkersAI(prompt, { temperature, maxTokens, json: true });
      if (this.apiLimiter) {
        await this.apiLimiter.consumeLimit('WORKERS_AI', 1);
      }

      if (!content) return null;
      return this.extractJson(content) || JSON.parse(content);
    } catch (error) {
      console.warn('[LLMService] Workers AI JSON generation failed:', error.message);
      return null;
    }
  }

  async tryWorkersAiText(prompt, { temperature = 0.7, maxTokens = 800 } = {}) {
    if (!this.isWorkersAiConfigured()) return null;

    if (this.apiLimiter && !(await this.apiLimiter.canMakeRequest('WORKERS_AI'))) {
      console.warn('[LLMService] Workers AI quota unavailable for text generation');
      return null;
    }

    try {
      const content = await this.callWorkersAI(prompt, { temperature, maxTokens, json: false });
      if (this.apiLimiter) {
        await this.apiLimiter.consumeLimit('WORKERS_AI', 1);
      }
      return content || null;
    } catch (error) {
      console.warn('[LLMService] Workers AI text generation failed:', error.message);
      return null;
    }
  }

  extractJson(content) {
    if (!content) return null;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  }

  getScriptDurationBounds() {
    const minFromEnv = Number(process.env.REEL_DURATION_MIN_SEC);
    const maxFromEnv = Number(process.env.REEL_DURATION_MAX_SEC);
    const min = Number.isFinite(minFromEnv) && minFromEnv > 0
      ? minFromEnv
      : (VIDEO_CONFIG.DURATION_MIN || 60);
    const max = Number.isFinite(maxFromEnv) && maxFromEnv >= min
      ? maxFromEnv
      : (VIDEO_CONFIG.DURATION_MAX || 120);
    const target = Math.round((min + max) / 2);
    return { min, max, target };
  }

  normalizeScriptPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const { min, max, target } = this.getScriptDurationBounds();
    const fallbackDuration = Number(payload.duration) || target;
    const duration = Math.max(min, Math.min(max, Math.round(fallbackDuration)));
    payload.duration = duration;

    if (Array.isArray(payload.scenes) && payload.scenes.length > 0) {
      const safeScenes = payload.scenes
        .map((scene) => ({
          ...scene,
          text: String(scene?.text || '').trim(),
          visualPrompt: String(scene?.visualPrompt || scene?.text || '').trim(),
          duration: Math.max(3, Math.min(12, Number(scene?.duration) || 6)),
        }))
        .filter((scene) => scene.text);

      if (safeScenes.length > 0) {
        const total = safeScenes.reduce((sum, scene) => sum + scene.duration, 0) || duration;
        const ratio = duration / total;
        payload.scenes = safeScenes.map((scene, index) => {
          const scaled = Math.max(3, Math.min(12, Math.round(scene.duration * ratio)));
          return {
            ...scene,
            duration: scaled,
            index,
          };
        });

        const adjustedTotal = payload.scenes.reduce((sum, scene) => sum + scene.duration, 0);
        const delta = duration - adjustedTotal;
        if (payload.scenes.length > 0 && delta !== 0) {
          const last = payload.scenes[payload.scenes.length - 1];
          last.duration = Math.max(3, Math.min(12, last.duration + delta));
        }
      }
    }

    return payload;
  }

  /**
   * Generate a trending topic for reel content from YESTERDAY's trends
   * Returns: {topic, description, alternatives}
   */
  async generateYesterdaysTrendingTopic() {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const prompt = `Generate 1 trending topic from YESTERDAY (${yesterdayStr}) that was viral or trending on Instagram Reels.
      
Requirements:
- Topic should be from yesterday's trends (recent but not today)
- Focus on what was trending yesterday
- Should be relatable and engaging
- Include yesterday's viral content, news trends, or social media moments
- Return ONLY JSON format with no extra text:
{
  "topic": "topic name",
  "description": "brief description of why it was trending yesterday",
  "hook": "attention-grabbing hook",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "trendDate": "${yesterdayStr}"
}`;

      if (this.mistralApiKey && (await this.apiLimiter.canMakeRequest('MISTRAL'))) {
        try {
          const content = await this.callMistral(prompt, { temperature: 0.9, maxTokens: 500, json: true });
          await this.apiLimiter.consumeLimit('MISTRAL', 1);
          const topicData = this.extractJson(content) || JSON.parse(content);
          console.log('[LLMService] Generated yesterday trending topic with Mistral:', topicData.topic);
          return topicData;
        } catch (mistralError) {
          console.warn('[LLMService] Mistral yesterday topic generation failed, trying Gemini fallback:', mistralError.message);
        }
      }

      if (this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        const content = await this.callGemini(prompt, { temperature: 1, maxTokens: 500 });
        await this.apiLimiter.consumeLimit('GEMINI', 1);
        const topicData = this.extractJson(content);
        if (!topicData) {
          console.warn('[LLMService] Could not parse Gemini JSON response:', content);
        } else {
          console.log('[LLMService] Generated yesterday trending topic with Gemini fallback:', topicData.topic);
          return topicData;
        }
      }

      const workersTopicData = await this.tryWorkersAiJson(prompt, { temperature: 1, maxTokens: 500 });
      if (workersTopicData) {
        console.log('[LLMService] Generated yesterday trending topic with Workers AI fallback:', workersTopicData.topic);
        return workersTopicData;
      }

      console.warn('[LLMService] No LLM quota available for yesterday topic generation');
      return null;
    } catch (error) {
      console.error('[LLMService] Error generating yesterday trending topic:', error.message);
      throw error;
    }
  }

  /**
   * Generate a trending topic for reel content
   * Returns: {topic, description, alternatives}
   */
  async generateTopic() {
    try {
      const prompt = `Generate 1 trending topic for Instagram Reels right now that would go viral.
      
Requirements:
- Topic should be relatable and engaging
- Include current trends or timeless viral content
- Return ONLY JSON format with no extra text:
{
  "topic": "topic name",
  "description": "brief description",
  "hook": "attention-grabbing hook",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

      if (this.mistralApiKey && (await this.apiLimiter.canMakeRequest('MISTRAL'))) {
        try {
          const content = await this.callMistral(prompt, { temperature: 0.9, maxTokens: 500, json: true });
          await this.apiLimiter.consumeLimit('MISTRAL', 1);
          const topicData = this.extractJson(content) || JSON.parse(content);
          console.log('[LLMService] Generated topic with Mistral:', topicData.topic);
          return topicData;
        } catch (mistralError) {
          console.warn('[LLMService] Mistral topic generation failed, trying Gemini fallback:', mistralError.message);
        }
      }

      if (this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        const content = await this.callGemini(prompt, { temperature: 1, maxTokens: 500 });
        await this.apiLimiter.consumeLimit('GEMINI', 1);
        const topicData = this.extractJson(content);
        if (!topicData) {
          console.warn('[LLMService] Could not parse Gemini JSON response:', content);
        } else {
          console.log('[LLMService] Generated topic with Gemini fallback:', topicData.topic);
          return topicData;
        }
      }

      const workersTopicData = await this.tryWorkersAiJson(prompt, { temperature: 1, maxTokens: 500 });
      if (workersTopicData) {
        console.log('[LLMService] Generated topic with Workers AI fallback:', workersTopicData.topic);
        return workersTopicData;
      }

      console.warn('[LLMService] No LLM quota available for topic generation');
      return null;
    } catch (error) {
      console.error('[LLMService] Error generating topic:', error.message);
      throw error;
    }
  }

  async generateThemedTopic(theme) {
    try {
      const safeTheme = String(theme || 'Technology update').trim();
      const today = new Date().toISOString().split('T')[0];
      const currentYear = new Date().getUTCFullYear();
      const prompt = `Generate 1 highly relevant short-form reel topic in this strict theme: "${safeTheme}".

Today (UTC): ${today}

Requirements:
- Topic must be timely and specific (avoid vague generic ideas)
- Prefer India-relevant angle when applicable
- Recency rule: avoid stale years/topics; do NOT choose topics centered on years older than ${currentYear - 1}
- For technology/politics/news themes, prefer developments from last 30-90 days
- Must be useful for audience: clear practical impact on users/citizens/market
- Return ONLY JSON format with no extra text:
{
  "topic": "short specific topic title",
  "description": "1-2 line reason this matters now",
  "hook": "attention-grabbing first line",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

      if (this.mistralApiKey && (await this.apiLimiter.canMakeRequest('MISTRAL'))) {
        try {
          const content = await this.callMistral(prompt, { temperature: 0.8, maxTokens: 450, json: true });
          await this.apiLimiter.consumeLimit('MISTRAL', 1);
          const topicData = this.extractJson(content) || JSON.parse(content);
          return topicData;
        } catch (mistralError) {
          console.warn('[LLMService] Mistral themed topic failed, trying Gemini fallback:', mistralError.message);
        }
      }

      if (this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        const content = await this.callGemini(prompt, { temperature: 0.9, maxTokens: 500 });
        await this.apiLimiter.consumeLimit('GEMINI', 1);
        const topicData = this.extractJson(content);
        if (topicData) return topicData;
      }

      const workersTopicData = await this.tryWorkersAiJson(prompt, { temperature: 0.9, maxTokens: 500 });
      if (workersTopicData) return workersTopicData;

      return null;
    } catch (error) {
      console.error('[LLMService] Error generating themed topic:', error.message);
      return null;
    }
  }

  /**
   * Generate a script for a given topic (targets 1-2 minute duration)
   * Returns: {script, duration, hooks}
   */
  async generateScript(topic, options = {}) {
    try {
      if (!topic) {
        throw new Error('Topic is required for script generation');
      }

      const { min, max, target } = this.getScriptDurationBounds();
      const wordsMin = Math.max(180, Math.round(min * 2.6));
      const wordsMax = Math.max(wordsMin + 40, Math.round(max * 2.8));
      const languageStyle = String(options.languageStyle || '').trim();
      const theme = String(options.theme || '').trim();
      const style = String(options.style || '').trim();
      const wantsHindi = /hindi/i.test(languageStyle);
      const currentYear = new Date().getUTCFullYear();
      const extraInstruction = [
        languageStyle
          ? wantsHindi
            ? `- Language style: ${languageStyle}. Write the full narration in natural conversational Hindi using Devanagari script only. Keep the wording simple, clear, and spoken, without Roman-script Hinglish.`
            : `- Language style: ${languageStyle}. Write the full narration in clear conversational English only. Do not use Hindi words, Hinglish, or Devanagari script.`
          : '',
        theme
          ? `- Keep content strictly within theme: ${theme}`
          : '',
        style
          ? `- Narrative style: ${style}`
          : '',
        '- Hard anti-hallucination rule: do not invent numbers, quotes, dates, or claims.',
        '- Avoid exact numeric claims/predictions unless they are widely verified; prefer cautious phrasing over precise unsupported numbers.',
        `- Year consistency rule: avoid stale framing (e.g., ${currentYear - 2} launch/news as current) unless explicitly marked historical comparison.`,
        '- Value-add rule: include at least 3 concrete facts with named entities/policies/products/timeline.',
        '- Each fact must answer at least one of: what changed, why now, who is affected, what to do next.',
        wantsHindi
          ? '- If a point is uncertain, clearly say "रिपोर्ट्स के अनुसार" or "सार्वजनिक जानकारी के आधार पर".'
          : '- If a point is uncertain, clearly say "according to reports" or "based on public reports".',
        '- Use a clean explainer flow: Hook -> Context -> 3 clear facts -> Why it matters -> Actionable takeaway -> CTA.',
        '- Avoid sensational words like "shocking", "mind-blowing", "guaranteed" unless factually justified.',
      ]
        .filter(Boolean)
        .join('\n');

      console.log('[LLMService] Generating long-form script for topic:', topic, `(${min}-${max}s target=${target}s)`);
      const prompt = `Create an Instagram Reel script for the topic: "${topic}"

Requirements:
    - Duration: between ${min} and ${max} seconds (target ${target} seconds)
    - Word count target: ${wordsMin}-${wordsMax} words
- Include a hook in the first 3-5 seconds that grabs attention immediately
    - Use emojis strategically (4-8 emojis total)
- Include a clear call-to-action (CTA) in the last 5 seconds
- Add trending language and phrases
- Format as a natural speaking script (conversational, engaging)
- Avoid misinformation; keep claims grounded and concise
- Also create a strong, cinematic visual generation prompt for the video model
- Visual prompt must describe scene, camera movement, lighting, mood, style, quality, and orientation
- Example style: "Aerial cinematic video of Mumbai skyline at sunset, dramatic lighting, 4k, vertical 9:16"
- Return ONLY JSON with no extra text:
{
  "script": "the full script text",
  "duration": ${target},
  "hook": "opening hook (first 3-5 seconds)",
  "cta": "call-to-action (last 5 seconds)",
  "emojis": ["emoji1", "emoji2", "emoji3", "emoji4"],
  "videoPrompt": "detailed cinematic prompt for a text-to-video model",
  "scenes": [
    {"text": "short line for scene 1", "duration": 6, "visualPrompt": "what to show for this scene"},
    {"text": "short line for scene 2", "duration": 6, "visualPrompt": "what to show for this scene"},
    {"text": "short line for scene 3", "duration": 6, "visualPrompt": "what to show for this scene"}
  ]
}

Rules for scenes:
- Each scene duration must add up to the final duration
- Most scenes should be 5-9 seconds each
- Provide enough scenes to naturally cover a ${min}-${max} second reel
- visualPrompt must be production-ready for stock/video generation query
- Keep scene text aligned to spoken narration
- Make sure total duration of all scenes matches the duration value
${extraInstruction ? `\nAdditional constraints:\n${extraInstruction}` : ''}
`;

      if (this.mistralApiKey && (await this.apiLimiter.canMakeRequest('MISTRAL'))) {
        try {
          const content = await this.callMistral(prompt, { temperature: 0.75, maxTokens: 1500, json: true });
          await this.apiLimiter.consumeLimit('MISTRAL', 1);
          const scriptData = this.extractJson(content) || JSON.parse(content);
          const normalized = this.normalizeScriptPayload(scriptData);
          console.log('[LLMService] Generated long-form script with Mistral for:', topic);
          return normalized;
        } catch (mistralError) {
          console.warn('[LLMService] Mistral script generation failed, retrying with compact schema:', mistralError.message);

          // Retry with a compact schema to avoid malformed nested JSON from large scenes arrays.
          try {
            const compactPrompt = `Create a factual Instagram Reel narration for: "${topic}".

Today context: ${new Date().toISOString().split('T')[0]}

Return STRICT valid JSON only, minified, no markdown, no trailing commas.
Schema:
{
  "script": "${wantsHindi ? 'Natural spoken Hindi in Devanagari' : 'Natural spoken English'} with concrete facts and practical value",
  "duration": ${target},
  "hook": "short opening hook",
  "cta": "short CTA",
  "emojis": ["😀","📌","✅"],
  "videoPrompt": "single cinematic 9:16 stock-video generation prompt"
}

Rules:
- Mention at least 3 concrete facts and why they matter now
- Avoid stale framing; treat years older than ${new Date().getUTCFullYear() - 1} as historical context only
- Do not invent unverifiable numbers
- If numeric data is uncertain, use qualitative wording (e.g., "rapid", "high capacity", "early stage") instead of exact figures
- Keep duration between ${min}-${max} seconds`;

            const compactContent = await this.callMistral(compactPrompt, {
              temperature: 0.45,
              maxTokens: 1100,
              json: true,
            });
            await this.apiLimiter.consumeLimit('MISTRAL', 1);
            const compactData = this.extractJson(compactContent) || JSON.parse(compactContent);
            const normalizedCompact = this.normalizeScriptPayload(compactData);
            console.log('[LLMService] Generated script with compact Mistral retry for:', topic);
            return normalizedCompact;
          } catch (compactError) {
            console.warn('[LLMService] Compact Mistral retry failed, trying Gemini fallback:', compactError.message);
          }
        }
      }

      if (this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        const content = await this.callGemini(prompt, { temperature: 0.8, maxTokens: 1500 });
        const scriptData = this.extractJson(content);
        await this.apiLimiter.consumeLimit('GEMINI', 1);
        if (!scriptData) {
          console.warn('[LLMService] Could not parse Gemini JSON response:', content);
        } else {
          const normalized = this.normalizeScriptPayload(scriptData);
          console.log('[LLMService] Generated long-form script with Gemini fallback for:', topic);
          return normalized;
        }
      }

      const workersScriptData = await this.tryWorkersAiJson(prompt, { temperature: 0.8, maxTokens: 1500 });
      if (workersScriptData) {
        const normalized = this.normalizeScriptPayload(workersScriptData);
        console.log('[LLMService] Generated long-form script with Workers AI fallback for:', topic);
        return normalized;
      }

      console.warn('[LLMService] No LLM quota available for script generation');
      return null;
    } catch (error) {
      console.error('[LLMService] Error generating script:', error.message);
      throw error;
    }
  }

  async generateStaticCurrentAffairsPost(topic, trendDate = null) {
    try {
      const maxWords = SCRIPT_CONFIG.STATIC_POST?.MAX_WORDS || 50;
      const dateLabel = trendDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const safeTopic = String(topic || '').trim();
      if (!safeTopic) {
        throw new Error('Topic is required for static post generation');
      }

      const prompt = `Write a static Instagram post caption about current affairs based on this yesterday trend: "${safeTopic}" (${dateLabel}).

Requirements:
- Under ${maxWords} words
- Neutral, factual tone
- Mention 2-3 key highlights from yesterday
- Add 1 short CTA at the end
- Return ONLY JSON:
{
  "post": "text under ${maxWords} words"
}`;

      let content = null;
      if (this.mistralApiKey && (await this.apiLimiter.canMakeRequest('MISTRAL'))) {
        try {
          content = await this.callMistral(prompt, { temperature: 0.45, maxTokens: 250, json: true });
          await this.apiLimiter.consumeLimit('MISTRAL', 1);
        } catch (error) {
          console.warn('[LLMService] Mistral static post generation failed, trying Gemini fallback:', error.message);
        }
      }

      if (!content && this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        content = await this.callGemini(prompt, { temperature: 0.5, maxTokens: 250 });
        await this.apiLimiter.consumeLimit('GEMINI', 1);
      }

      if (!content) {
        content = await this.tryWorkersAiText(prompt, { temperature: 0.5, maxTokens: 250 });
      }

      const parsed = this.extractJson(content || '') || { post: '' };
      const compact = String(parsed.post || '')
        .replace(/\s+/g, ' ')
        .trim();
      const words = compact.split(/\s+/).filter(Boolean);

      if (!compact) {
        return null;
      }

      return {
        post: words.slice(0, maxWords).join(' '),
        maxWords,
      };
    } catch (error) {
      console.error('[LLMService] Error generating static current affairs post:', error.message);
      return null;
    }
  }

  /**
   * Optimize text for Instagram Reels
   * Ensures proper formatting, adds emojis, optimizes length
   */
  async optimizeForReels(text) {
    try {
      if (!text || text.length === 0) {
        throw new Error('Text is required for optimization');
      }

      const prompt = `Optimize this text for Instagram Reels:
"${text}"

Requirements:
- Keep it under 2200 characters
- Make it engaging and trendy
- Add strategic emojis (max 5)
- Ensure proper line breaks
- Include relevant hashtags
- Return ONLY the optimized text`;

      if (this.mistralApiKey && (await this.apiLimiter.canMakeRequest('MISTRAL'))) {
        try {
          const optimizedText = await this.callMistral(prompt, { temperature: 0.6, maxTokens: 500 });
          await this.apiLimiter.consumeLimit('MISTRAL', 1);
          return optimizedText || text;
        } catch (mistralError) {
          console.warn('[LLMService] Mistral optimization failed, trying Gemini fallback:', mistralError.message);
        }
      }

      if (this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        const optimizedText = await this.callGemini(prompt, { temperature: 0.7, maxTokens: 500 });
        await this.apiLimiter.consumeLimit('GEMINI', 1);
        return optimizedText || text;
      }

      const workersOptimized = await this.tryWorkersAiText(prompt, { temperature: 0.7, maxTokens: 500 });
      if (workersOptimized) {
        return workersOptimized;
      }

      return text;
    } catch (error) {
      console.error('[LLMService] Error optimizing text:', error.message);
      return text; // Return original text on error
    }
  }

  /**
   * Generate multiple topics in batch (for Sunday batch processing)
   * Returns: array of topics
   */
  async generateTopicsBatch(count = 7) {
    try {
      const recommendation = await this.apiLimiter.getBatchRecommendation();
      const actualCount = Math.min(count, recommendation.topicsToGenerate);

      const topics = [];
      for (let i = 0; i < actualCount; i++) {
        try {
          const topic = await this.generateTopic();
          if (topic) {
            topics.push(topic);
          }
          // Small delay between requests
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          console.warn(`[LLMService] Error generating topic ${i + 1}:`, error.message);
        }
      }

      console.log(`[LLMService] Generated ${topics.length} topics in batch`);
      return topics;
    } catch (error) {
      console.error('[LLMService] Error in batch generation:', error.message);
      throw error;
    }
  }

  /**
   * Handle rate limit errors with backoff
   */
  async handleRateLimit(retryCount = 0) {
    const maxRetries = 3;
    if (retryCount >= maxRetries) {
      throw new Error('Max retries exceeded for rate limit');
    }

    const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
    console.warn(`[LLMService] Rate limited. Waiting ${backoffTime}ms before retry...`);

    await new Promise((resolve) => setTimeout(resolve, backoffTime));
  }

  /**
   * Check API health
   */
  async healthCheck() {
    try {
      const service = this.mistralApiKey
        ? 'MISTRAL'
        : this.geminiApiKey
          ? 'GEMINI'
          : this.isWorkersAiConfigured()
            ? 'WORKERS_AI'
            : 'LLM';
      const limits = service === 'LLM' ? { available: true, remaining: null } : await this.apiLimiter.checkLimit(service);
      return {
        service,
        available: limits.available,
        remaining: limits.remaining,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[LLMService] Health check failed:', error.message);
      return {
        service: 'LLM',
        available: false,
        error: error.message,
      };
    }
  }
}

export default LLMService;
