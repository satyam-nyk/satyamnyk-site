/**
 * ResearchAgent - Handles topic research and discovery
 * Generates trending topics or falls back to cached topics if API limit reached
 */
class ResearchAgent {
  constructor(geminiService, database, apiLimiter) {
    this.geminiService = geminiService;
    this.db = database;
    this.apiLimiter = apiLimiter;
  }

  /**
   * Research today's trending topic
   * Falls back to cached topic if Gemini limit reached
   * Returns: {topic, description, hook, keywords, source}
   */
  async researchTodaysTopic() {
    try {
      console.log('[ResearchAgent] Researching topics for today...');

      // Check if we can make API calls
      const canCallAPI = await this.apiLimiter.canMakeRequest('GEMINI');

      let topic = null;

      if (canCallAPI) {
        try {
          topic = await this.geminiService.generateTopic();
          if (topic) {
            // Cache the topic
            await this.db.cacheResult('topic', {
              topic: topic.topic,
              description: topic.description,
              alternatives: topic.keywords,
              score: 10,
            });
          }
        } catch (error) {
          console.warn('[ResearchAgent] Error generating topic with Gemini:', error.message);
          // Will fall back to cached topic
        }
      } else {
        console.log('[ResearchAgent] Gemini API limit reached, falling back to cached topic');
      }

      // If topic generation failed or API limit reached, use cached topic
      if (!topic) {
        topic = await this.getCachedTopicIfLimitReached();
        if (topic) {
          topic.source = 'cache';
        }
      } else {
        topic.source = 'gemini';
      }

      if (!topic) {
        throw new Error('Could not obtain topic from Gemini or cache');
      }

      // Update cache usage
      if (topic.source === 'cache') {
        await this.db.db.run(
          'UPDATE topics_cache SET used_count = used_count + 1, last_used_date = ? WHERE topic = ?',
          [new Date().toISOString().split('T')[0], topic.topic],
          (err) => {
            if (err) console.error('Error updating topic cache:', err);
          }
        );
      }

      console.log('[ResearchAgent] Topic research complete:', topic.topic);
      return topic;
    } catch (error) {
      console.error('[ResearchAgent] Error in topic research:', error.message);
      throw error;
    }
  }

  /**
   * Get cached topic when API limit is reached
   * Returns: {topic, description, keywords}
   */
  async getCachedTopicIfLimitReached() {
    try {
      console.log('[ResearchAgent] Getting cached topic...');

      const cachedTopic = await this.db.getCachedTopic();

      if (cachedTopic) {
        console.log('[ResearchAgent] Using cached topic:', cachedTopic.topic);
        
        // Handle alternatives - could be string or array
        let keywords = [];
        if (cachedTopic.alternative_descriptions) {
          if (typeof cachedTopic.alternative_descriptions === 'string') {
            try {
              keywords = JSON.parse(cachedTopic.alternative_descriptions);
            } catch (e) {
              // If it's not valid JSON, split by comma
              keywords = cachedTopic.alternative_descriptions.split(',').map(k => k.trim());
            }
          } else {
            keywords = cachedTopic.alternative_descriptions;
          }
        }
        
        return {
          topic: cachedTopic.topic,
          description: cachedTopic.description,
          keywords: keywords,
          trendingScore: cachedTopic.trending_score,
          source: 'cache',
        };
      }

      return null;
    } catch (error) {
      console.error('[ResearchAgent] Error getting cached topic:', error.message);
      return null;
    }
  }

  /**
   * Batch research weekly topics (for Sunday)
   * Generates topics for entire week
   * Returns: array of topics
   */
  async batchResearchWeekly() {
    try {
      console.log('[ResearchAgent] Starting weekly batch research...');

      // Get batch recommendation based on available budget
      const recommendation = await this.apiLimiter.getBatchRecommendation();

      if (!recommendation || recommendation.topicsToGenerate <= 0) {
        console.warn('[ResearchAgent] Insufficient budget for batch research');
        return [];
      }

      // Generate topics in batch
      const topics = await this.geminiService.generateTopicsBatch(
        recommendation.topicsToGenerate
      );

      if (!topics || topics.length === 0) {
        console.warn('[ResearchAgent] No topics generated in batch');
        return [];
      }

      // Store all topics
      const cachedTopics = [];
      for (const topic of topics) {
        try {
          await this.db.cacheResult('topic', {
            topic: topic.topic,
            description: topic.description,
            alternatives: topic.keywords,
            score: 10,
          });
          cachedTopics.push(topic);
        } catch (error) {
          console.warn('[ResearchAgent] Error caching topic:', error.message);
        }
      }

      console.log(`[ResearchAgent] Batch research complete. Generated ${cachedTopics.length} topics`);
      return cachedTopics;
    } catch (error) {
      console.error('[ResearchAgent] Error in batch research:', error.message);
      throw error;
    }
  }

  /**
   * Verify topic quality and relevance
   */
  async verifyTopic(topic) {
    try {
      if (!topic || !topic.topic || !topic.description) {
        console.warn('[ResearchAgent] Invalid topic format');
        return false;
      }

      // Basic validation
      if (topic.topic.length < 3 || topic.topic.length > 100) {
        console.warn('[ResearchAgent] Topic length invalid');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[ResearchAgent] Error verifying topic:', error.message);
      return false;
    }
  }

  /**
   * Get trending topics for dashboard display
   */
  async getTrendingTopics(days = 30, limit = 10) {
    try {
      return await this.db.getMonthlyTrendingTopics(limit);
    } catch (error) {
      console.error('[ResearchAgent] Error getting trending topics:', error.message);
      return [];
    }
  }
}

export default ResearchAgent;
