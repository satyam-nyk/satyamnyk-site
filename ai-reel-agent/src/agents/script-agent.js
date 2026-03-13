import { SCRIPT_CONFIG } from '../config/constants.js';

/**
 * ScriptAgent - Handles script generation and optimization
 * Creates engaging reel scripts with hooks, CTAs, and trending language
 */
class ScriptAgent {
  constructor(geminiService, database, apiLimiter) {
    this.geminiService = geminiService;
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

      // Check if we can make API calls
      const canCallAPI = await this.apiLimiter.canMakeRequest('GEMINI');
      let scriptData = null;

      if (canCallAPI) {
        try {
          scriptData = await this.geminiService.generateScript(topic.topic);
        } catch (error) {
          console.warn('[ScriptAgent] Error generating script with Gemini:', error.message);
        }
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

      const result = {
        topic: topic.topic,
        script: enrichedScript.script,
        duration: scriptData.duration || 45,
        hooks: enrichedScript.hooks,
        cta: enrichedScript.cta,
        emojis: scriptData.emojis || [],
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
        // Use Gemini to optimize if quota available
        const optimized = await this.geminiService.optimizeForReels(script);
        return optimized;
      } catch (error) {
        console.warn('[ScriptAgent] Error optimizing with Gemini:', error.message);
        return script; // Return unoptimized script
      }
    } catch (error) {
      console.error('[ScriptAgent] Error in optimize script:', error.message);
      return script;
    }
  }

  /**
   * Generate a template script when API fails
   * Returns reliable fallback script with structure
   */
  generateTemplateScript(topic) {
    const templates = [
      {
        script: `You won't believe what I just discovered about ${topic}! 🤯
        
        Most people don't know this, but...
        
        If you want to learn more about ${topic}, this might surprise you.
        
        Comment below what you think! 👇`,
        duration: 45,
        hooks: [`You won't believe`, 'this might surprise you'],
        cta: 'Comment below what you think',
        emojis: ['🤯', '👇'],
      },
      {
        script: `Let me tell you about ${topic} 🎯
        
        Here's why everyone is talking about this...
        
        The amazing thing is...
        
        Drop a like if you agree! ❤️`,
        duration: 40,
        hooks: [`Let me tell you`, 'everyone is talking about'],
        cta: 'Drop a like if you agree',
        emojis: ['🎯', '❤️'],
      },
      {
        script: `${topic} just got interesting 🔥
        
        Wait for the end...
        
        This is why it matters.
        
        What's your take? Let's discuss! 💬`,
        duration: 50,
        hooks: ['just got interesting', 'wait for the end'],
        cta: "What's your take? Let's discuss",
        emojis: ['🔥', '💬'],
      },
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    return {
      script: randomTemplate.script.replace(/\${topic}/g, topic),
      duration: randomTemplate.duration,
      hooks: randomTemplate.hooks,
      cta: randomTemplate.cta,
      emojis: randomTemplate.emojis,
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
            hooks: { primary: scriptData.hooks, cta: scriptData.cta },
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
      if (script.duration < 30 || script.duration > 60) {
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
