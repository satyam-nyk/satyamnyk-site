import axios from 'axios';
import { API_LIMITS, SCRIPT_CONFIG, VIDEO_CONFIG } from '../config/constants.js';

/**
 * LLMService - Handles primary Mistral + fallback Gemini interactions
 * Keeps existing method names to avoid breaking agent wiring.
 */
class LLMService {
  constructor(mistralApiKey, apiLimiter, options = {}) {
    if (!mistralApiKey && !options.geminiApiKey) {
      throw new Error('MISTRAL_API_KEY or GOOGLE_GEMINI_API_KEY is required');
    }
    this.mistralApiKey = mistralApiKey || null;
    this.geminiApiKey = options.geminiApiKey || null;
    this.apiLimiter = apiLimiter;
    this.mistralBaseURL = 'https://api.mistral.ai/v1/chat/completions';
    this.geminiBaseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.mistralModel = process.env.MISTRAL_MODEL || options.mistralModel || 'mistral-small-latest';
    this.timeout = API_LIMITS.MISTRAL.TIMEOUT;
  }

  async callMistral(prompt, { temperature = 0.7, maxTokens = 800, json = false } = {}) {
    if (!this.mistralApiKey) {
      throw new Error('Mistral API key is not configured');
    }

    const payload = {
      model: this.mistralModel,
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

    const response = await axios.post(this.mistralBaseURL, payload, {
      timeout: this.timeout,
      headers: {
        Authorization: `Bearer ${this.mistralApiKey}`,
        'Content-Type': 'application/json',
      },
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
          return null;
        }
        console.log('[LLMService] Generated yesterday trending topic with Gemini fallback:', topicData.topic);
        return topicData;
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
          return null;
        }
        console.log('[LLMService] Generated topic with Gemini fallback:', topicData.topic);
        return topicData;
      }

      console.warn('[LLMService] No LLM quota available for topic generation');
      return null;
    } catch (error) {
      console.error('[LLMService] Error generating topic:', error.message);
      throw error;
    }
  }

  /**
   * Generate a script for a given topic (targets 1-2 minute duration)
   * Returns: {script, duration, hooks}
   */
  async generateScript(topic) {
    try {
      if (!topic) {
        throw new Error('Topic is required for script generation');
      }

      const { min, max, target } = this.getScriptDurationBounds();
      const wordsMin = Math.max(180, Math.round(min * 2.6));
      const wordsMax = Math.max(wordsMin + 40, Math.round(max * 2.8));

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
          console.warn('[LLMService] Mistral script generation failed, trying Gemini fallback:', mistralError.message);
        }
      }

      if (this.geminiApiKey && (await this.apiLimiter.canMakeRequest('GEMINI'))) {
        const content = await this.callGemini(prompt, { temperature: 0.8, maxTokens: 1500 });
        const scriptData = this.extractJson(content);
        await this.apiLimiter.consumeLimit('GEMINI', 1);
        if (!scriptData) {
          console.warn('[LLMService] Could not parse Gemini JSON response:', content);
          return null;
        }
        
        const normalized = this.normalizeScriptPayload(scriptData);
        console.log('[LLMService] Generated long-form script with Gemini fallback for:', topic);
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
      const service = this.mistralApiKey ? 'MISTRAL' : 'GEMINI';
      const limits = await this.apiLimiter.checkLimit(service);
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
