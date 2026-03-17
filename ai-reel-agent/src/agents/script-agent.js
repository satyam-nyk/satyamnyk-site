import { SCRIPT_CONFIG, VIDEO_CONFIG } from '../config/constants.js';

/**
 * ScriptAgent - Handles script generation and optimization
 * Creates engaging reel scripts with hooks, CTAs, and trending language
 */
class ScriptAgent {
  constructor(llmService, database, apiLimiter) {
    this.llmService = llmService;
    this.db = database;
    this.apiLimiter = apiLimiter;
  }

  /**
   * Generate a script for a topic
   * Returns: {script, duration, hooks, cta, emojis, topic}
   */
  async generateScript(topic) {
    try {
      if (!topic || !topic.topic) {
        throw new Error('Topic is required for script generation');
      }

      console.log('[ScriptAgent] Generating script for topic:', topic.topic);
      let scriptData = null;

      try {
        scriptData = await this.llmService.generateScript(topic.topic);
      } catch (error) {
        console.warn('[ScriptAgent] Error generating script with LLM provider:', error.message);
      }

      // Fallback to template if API fails or limit reached
      if (!scriptData) {
        console.log('[ScriptAgent] Using template script as fallback');
        scriptData = this.generateTemplateScript(topic.topic);
      }

      // Optimize the script
      const finalScript = await this.optimizeScript(scriptData.script);

      // Add hooks and CTAs
      const enrichedScript = this.addHooks(finalScript || scriptData.script);

      const scenes = this.normalizeScenes(scriptData.scenes, enrichedScript.script);

      const result = {
        topic: topic.topic,
        script: enrichedScript.script,
        duration: scriptData.duration || VIDEO_CONFIG.TARGET_DURATION || 90,
        hooks: enrichedScript.hooks,
        cta: enrichedScript.cta,
        emojis: scriptData.emojis || [],
        videoPrompt: scriptData.videoPrompt || this.generateVideoPromptFallback(topic.topic),
        scenes,
        originalScript: scriptData.script,
      };

      console.log('[ScriptAgent] Script generated successfully for:', topic.topic);
      return result;
    } catch (error) {
      console.error('[ScriptAgent] Error generating script:', error.message);
      throw error;
    }
  }

  /**
   * Optimize script for better engagement
   */
  async optimizeScript(script) {
    try {
      if (!script) return script;

      try {
        // Use configured LLM provider to optimize if quota is available
        const optimized = await this.llmService.optimizeForReels(script);
        return optimized;
      } catch (error) {
        console.warn('[ScriptAgent] Error optimizing with LLM provider:', error.message);
        return script; // Return unoptimized script
      }
    } catch (error) {
      console.error('[ScriptAgent] Error in optimize script:', error.message);
      return script;
    }
  }

  /**
   * Generate a template script when API fails
  * Returns reliable fallback script with structure - long-form narration
   */
  generateTemplateScript(topic) {
    const templates = [
      {
        script: `You won't believe what I just discovered about ${topic}! 🤯
        
        Most people don't know this, but here's the full story...
        
        If you want to understand ${topic} completely, this is mind-blowing...
        
        Think about it this way: the real reason why it matters is because it affects everything we do daily.
        
        Here's what you need to remember about ${topic}...
        
        Comment below what you think! 👇 Drop a like if this opened your eyes! ❤️`,
        duration: VIDEO_CONFIG.TARGET_DURATION || 90,
        hooks: [`You won't believe`, 'this is mind-blowing'],
        cta: 'Comment below and drop a like',
        emojis: ['🤯', '❤️', '👇'],
      },
      {
        script: `Let me tell you about ${topic} 🎯

        Here's why everyone is suddenly talking about this recent trend...

        The fascinating part that nobody mentions is actually this...

        Most people miss this important detail about ${topic}.

        Here's what makes it so special and why you should care...

        What's your take on ${topic}? Let's discuss in the comments! 💬

        Drop a like if you found this helpful! ❤️`,
        duration: VIDEO_CONFIG.TARGET_DURATION || 90,
        hooks: ['Let me tell you', 'everyone is suddenly talking about', 'Most people miss this'],
        cta: "Let's discuss in the comments",
        emojis: ['🎯', '💬', '❤️'],
      },
      {
        script: `${topic} just got incredibly interesting 🔥

        Wait for the end because this will blow your mind...

        Here's what changed everything about ${topic}...

        The reason people are obsessed with this is clear when you understand the full context.

        This is exactly why ${topic} matters so much in 2026...

        You need to know this information about ${topic} before deciding anything.

        What do you think? Comment below and don't forget to like! 👍`,
        duration: VIDEO_CONFIG.TARGET_DURATION || 90,
        hooks: ['just got incredibly interesting', 'wait for the end', 'This will blow your mind'],
        cta: "Comment below and like",
        emojis: ['🔥', '👍', '💡'],
      },
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    return {
      script: randomTemplate.script.replace(/\${topic}/g, topic),
      duration: VIDEO_CONFIG.TARGET_DURATION || 90,
      hooks: randomTemplate.hooks,
      cta: randomTemplate.cta,
      emojis: randomTemplate.emojis,
      videoPrompt: this.generateVideoPromptFallback(topic),
    };
  }

  generateVideoPromptFallback(topic) {
    return `Cinematic vertical 9:16 video about ${topic}, dynamic camera movement, clean modern visuals, dramatic but natural lighting, high detail, realistic textures, social media reel style, 4k quality.`;
  }

  normalizeScenes(rawScenes, script) {
    if (Array.isArray(rawScenes) && rawScenes.length > 0) {
      const normalized = rawScenes
        .map((scene, index) => ({
          text: String(scene?.text || '').trim(),
          duration: Math.max(4, Math.min(10, Number(scene?.duration) || 6)),
          visualPrompt: String(scene?.visualPrompt || scene?.text || '').trim(),
          index,
        }))
        .filter((scene) => scene.text);

      if (normalized.length > 0) {
        return normalized;
      }
    }

    const lines = String(script || '')
      .split(/(?<=[.!?])\s+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const fallback = (lines.length ? lines : [String(script || '').trim()])
      .filter(Boolean)
      .map((line, index) => ({
        text: line,
        duration: 6,
        visualPrompt: line,
        index,
      }));

    return fallback.slice(0, 20);
  }

  async generateStaticCurrentAffairsPost(topicData) {
    const maxWords = SCRIPT_CONFIG.STATIC_POST?.MAX_WORDS || 50;
    const trendDate = topicData?.trendDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const topic = String(topicData?.topic || '').trim();
    const description = String(topicData?.description || '').trim();

    if (!topic) {
      throw new Error('Topic is required for static current-affairs post');
    }

    const llmPost = this.llmService?.generateStaticCurrentAffairsPost
      ? await this.llmService.generateStaticCurrentAffairsPost(`${topic}. ${description}`, trendDate)
      : null;

    if (llmPost?.post) {
      const words = llmPost.post.split(/\s+/).filter(Boolean);
      return {
        topic,
        trendDate,
        summary: words.slice(0, maxWords).join(' '),
        wordCount: Math.min(words.length, maxWords),
        source: 'llm',
      };
    }

    const fallbackText = `Yesterday's highlight: ${topic}. ${description || 'Major updates shaped policy, markets, and public debate.'} Follow for concise daily current-affairs updates.`
      .replace(/\s+/g, ' ')
      .trim();
    const words = fallbackText.split(/\s+/).filter(Boolean);
    return {
      topic,
      trendDate,
      summary: words.slice(0, maxWords).join(' '),
      wordCount: Math.min(words.length, maxWords),
      source: 'template',
    };
  }

  /**
   * Add hooks and CTAs to script
   * Ensures engagement-focused structure
   */
  addHooks(script) {
    try {
      if (!script) {
        throw new Error('Script is required');
      }

      // Select random hook from config
      const availableHooks = SCRIPT_CONFIG.HOOKS;
      const selectedHook =
        availableHooks[Math.floor(Math.random() * availableHooks.length)];

      // Common CTAs
      const ctas = [
        'Comment below your thoughts! 👇',
        'Like if you agree! ❤️',
        'Share this to your story! 📲',
        'Tag someone who needs this! 🏷️',
        'Follow for more content like this! 👆',
      ];

      const selectedCTA = ctas[Math.floor(Math.random() * ctas.length)];

      // Add CTA to script if not already present
      let finalScript = script;
      if (!script.toLowerCase().includes('comment') && !script.includes('like')) {
        finalScript = script + '\n\n' + selectedCTA;
      }

      return {
        script: finalScript,
        hooks: [selectedHook],
        cta: selectedCTA,
      };
    } catch (error) {
      console.error('[ScriptAgent] Error adding hooks:', error.message);
      return { script, hooks: [], cta: '' };
    }
  }

  /**
   * Batch generate and queue scripts for the week
   * Returns: {queued: number, total: number}
   */
  async batchQueueScripts(topics) {
    try {
      if (!Array.isArray(topics) || topics.length === 0) {
        throw new Error('Topics array is required');
      }

      console.log('[ScriptAgent] Batch generating scripts for', topics.length, 'topics');

      const scripts = [];

      for (const topic of topics) {
        try {
          const scriptData = await this.generateScript(topic);
          scripts.push({
            topic: scriptData.topic,
            script: scriptData.script,
            duration: scriptData.duration,
            hooks: {
              primary: scriptData.hooks,
              cta: scriptData.cta,
              videoPrompt: scriptData.videoPrompt || this.generateVideoPromptFallback(scriptData.topic),
              scenes: scriptData.scenes || this.normalizeScenes(null, scriptData.script),
            },
          });

          // Small delay between requests
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.warn('[ScriptAgent] Error generating script for topic:', error.message);
        }
      }

      // Insert all scripts into queue
      if (scripts.length > 0) {
        const result = await this.db.insertScriptQueue(scripts);
        console.log(
          `[ScriptAgent] Queued ${result.inserted} scripts out of ${topics.length} topics`
        );
        return result;
      }

      return { inserted: 0, total: topics.length };
    } catch (error) {
      console.error('[ScriptAgent] Error in batch queue scripts:', error.message);
      throw error;
    }
  }

  /**
   * Get next queued script for posting
   * Returns: {id, topic, script, duration, hooks, status}
   */
  async getNextScript() {
    try {
      const script = await this.db.getQueuedScript();

      if (!script) {
        console.log('[ScriptAgent] No queued scripts available');
        return null;
      }

      console.log('[ScriptAgent] Retrieved next script for topic:', script.topic);
      return script;
    } catch (error) {
      console.error('[ScriptAgent] Error getting next script:', error.message);
      throw error;
    }
  }

  /**
   * Verify script quality
   */
  async verifyScript(script) {
    try {
      if (!script || !script.script) {
        return false;
      }

      // Check minimum length
      if (script.script.length < 50) {
        console.warn('[ScriptAgent] Script too short');
        return false;
      }

      // Check maximum length (Instagram caption limit)
      if (script.script.length > 2200) {
        console.warn('[ScriptAgent] Script too long');
        return false;
      }

      // Check duration
      if (script.duration < (VIDEO_CONFIG.DURATION_MIN || 60) || script.duration > (VIDEO_CONFIG.DURATION_MAX || 120)) {
        console.warn('[ScriptAgent] Invalid duration');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ScriptAgent] Error verifying script:', error.message);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    try {
      return new Promise((resolve, reject) => {
        const query = `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted
          FROM script_queue
        `;

        this.db.db.get(query, (err, row) => {
          if (err) {
            console.error('[ScriptAgent] Error getting queue stats:', err);
            reject(err);
            return;
          }
          resolve(row || { total: 0, pending: 0, posted: 0 });
        });
      });
    } catch (error) {
      console.error('[ScriptAgent] Error in getQueueStats:', error.message);
      throw error;
    }
  }
}

export default ScriptAgent;
