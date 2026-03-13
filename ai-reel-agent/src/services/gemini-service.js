import axios from 'axios';
import { API_LIMITS, SCRIPT_CONFIG } from '../config/constants.js';

/**
 * GeminiService - Handles Google Gemini API interactions
 * Generates topics and scripts for reel content
 */
class GeminiService {
  constructor(apiKey, apiLimiter) {
    if (!apiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is required');
    }
    this.apiKey = apiKey;
    this.apiLimiter = apiLimiter;
    this.baseURL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    this.timeout = API_LIMITS.GEMINI.TIMEOUT;
  }

  /**
   * Generate a trending topic for reel content
   * Returns: {topic, description, alternatives}
   */
  async generateTopic() {
    try {
      // Check API limit before making request
      if (!(await this.apiLimiter.canMakeRequest('GEMINI'))) {
        console.warn('[GeminiService] API limit reached, falling back to cached topic');
        return null;
      }

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

      const response = await axios.post(
        `${this.baseURL}?key=${this.apiKey}`,
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
            temperature: 1,
            maxOutputTokens: 500,
          },
        },
        { timeout: this.timeout }
      );

      // Record API usage
      await this.apiLimiter.consumeLimit('GEMINI', 1);

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[GeminiService] Could not parse JSON response:', content);
        return null;
      }

      const topicData = JSON.parse(jsonMatch[0]);

      console.log('[GeminiService] Generated topic:', topicData.topic);
      return topicData;
    } catch (error) {
      console.error('[GeminiService] Error generating topic:', error.message);
      throw error;
    }
  }

  /**
   * Generate a script for a given topic
   * Returns: {script, duration, hooks}
   */
  async generateScript(topic) {
    try {
      if (!topic) {
        throw new Error('Topic is required for script generation');
      }

      // Check API limit
      if (!(await this.apiLimiter.canMakeRequest('GEMINI'))) {
        console.warn('[GeminiService] API limit reached for script generation');
        return null;
      }

      const prompt = `Create an engaging Instagram Reel script about: "${topic}"

Requirements:
- Duration: 30-60 seconds (about 80-150 words)
- Include a hook in the first 3 seconds
- Use emojis strategically
- Include a call-to-action (CTA)
- Add trending language and phrases
- Format as a natural speaking script
- Return ONLY JSON with no extra text:
{
  "script": "the full script text",
  "duration": 45,
  "hook": "opening hook",
  "cta": "call-to-action",
  "emojis": ["emoji1", "emoji2"]
}`;

      const response = await axios.post(
        `${this.baseURL}?key=${this.apiKey}`,
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
            temperature: 0.8,
            maxOutputTokens: 1000,
          },
        },
        { timeout: this.timeout }
      );

      // Record API usage
      await this.apiLimiter.consumeLimit('GEMINI', 1);

      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error('Empty response from Gemini API');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[GeminiService] Could not parse JSON response:', content);
        return null;
      }

      const scriptData = JSON.parse(jsonMatch[0]);

      console.log('[GeminiService] Generated script for:', topic);
      return scriptData;
    } catch (error) {
      console.error('[GeminiService] Error generating script:', error.message);
      throw error;
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

      // Check API limit
      if (!(await this.apiLimiter.canMakeRequest('GEMINI'))) {
        return text; // Return unoptimized text if limit reached
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

      const response = await axios.post(
        `${this.baseURL}?key=${this.apiKey}`,
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
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        },
        { timeout: this.timeout }
      );

      // Record API usage
      await this.apiLimiter.consumeLimit('GEMINI', 1);

      const optimizedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      return optimizedText || text;
    } catch (error) {
      console.error('[GeminiService] Error optimizing text:', error.message);
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
          console.warn(`[GeminiService] Error generating topic ${i + 1}:`, error.message);
        }
      }

      console.log(`[GeminiService] Generated ${topics.length} topics in batch`);
      return topics;
    } catch (error) {
      console.error('[GeminiService] Error in batch generation:', error.message);
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
    console.warn(`[GeminiService] Rate limited. Waiting ${backoffTime}ms before retry...`);

    await new Promise((resolve) => setTimeout(resolve, backoffTime));
  }

  /**
   * Check API health
   */
  async healthCheck() {
    try {
      const limits = await this.apiLimiter.checkLimit('GEMINI');
      return {
        service: 'Gemini',
        available: limits.available,
        remaining: limits.remaining,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[GeminiService] Health check failed:', error.message);
      return {
        service: 'Gemini',
        available: false,
        error: error.message,
      };
    }
  }
}

export default GeminiService;
