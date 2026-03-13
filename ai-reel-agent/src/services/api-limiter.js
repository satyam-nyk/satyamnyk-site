import { API_LIMITS, BATCH_CONFIG } from '../config/constants.js';

/**
 * APILimiter - Manages API rate limits and quotas
 * Tracks daily and monthly usage to prevent exceeding limits
 */
class APILimiter {
  constructor(database) {
    this.db = database;
    this.geminiBucket = [];
    this.heygenMonthlyUsage = 0;
    this.lastResetDate = new Date().toISOString().split('T')[0];
  }

  /**
   * Check if API call is allowed and get remaining quota
   * Returns: {used, remaining, available: boolean}
   */
  async checkLimit(service) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get current usage from database
      const usage = await this.db.getAPIUsage(service, today);
      const limit = API_LIMITS[service];

      if (!limit) {
        throw new Error(`Unknown service: ${service}`);
      }

      const dailyLimit = limit.DAILY_LIMIT || limit.MONTHLY_LIMIT;
      const remaining = dailyLimit - (usage.calls_used || 0);
      const available = remaining > 0;

      console.log(
        `[APILimiter] ${service} - Used: ${usage.calls_used}/${dailyLimit}, Remaining: ${remaining}`
      );

      return {
        service,
        used: usage.calls_used || 0,
        remaining,
        available,
        limit: dailyLimit,
      };
    } catch (error) {
      console.error(`[APILimiter] Error checking limit for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Consume API limit and record usage
   * Returns: {success: boolean, newUsage: number}
   */
  async consumeLimit(service, amount = 1) {
    try {
      const limits = await this.checkLimit(service);

      if (!limits.available && limits.remaining < amount) {
        console.warn(`[APILimiter] Limit reached for ${service}`);
        return {
          success: false,
          newUsage: limits.used,
          remaining: limits.remaining,
        };
      }

      // Record the usage
      const result = await this.db.recordAPIUsage(service, amount);

      console.log(`[APILimiter] Consumed ${amount} calls for ${service}`);

      return {
        success: true,
        newUsage: (await this.checkLimit(service)).used,
        remaining: (await this.checkLimit(service)).remaining,
      };
    } catch (error) {
      console.error(`[APILimiter] Error consuming limit for ${service}:`, error);
      throw error;
    }
  }

  /**
   * Check if a request can be made to the service
   * Returns: boolean
   */
  async canMakeRequest(service) {
    try {
      const limits = await this.checkLimit(service);
      return limits.available;
    } catch (error) {
      console.error(`[APILimiter] Error in canMakeRequest:`, error);
      return false;
    }
  }

  /**
   * Get remaining quota for current month
   * Returns: {remaining: number, total: number}
   */
  async getRemainingForMonth(service) {
    try {
      // For monthly services like HeyGen
      if (service !== 'HEYGEN') {
        return { error: 'Only HEYGEN has monthly limits' };
      }

      const limit = API_LIMITS.HEYGEN.MONTHLY_LIMIT;
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];

      // Get all usage for current month
      const query = `
        SELECT SUM(calls_used) as total_used FROM api_usage
        WHERE service = ? AND date >= ?
      `;

      return new Promise((resolve, reject) => {
        this.db.db.get(query, [service, monthStartStr], (err, row) => {
          if (err) {
            console.error('Error getting monthly usage:', err);
            reject(err);
            return;
          }

          const used = row?.total_used || 0;
          const remaining = limit - used;

          resolve({
            service,
            total: limit,
            used,
            remaining,
          });
        });
      });
    } catch (error) {
      console.error(`[APILimiter] Error getting monthly remaining:`, error);
      throw error;
    }
  }

  /**
   * Check if monthly cycle is complete and should reset
   * Returns: boolean
   */
  async isMonthlyCycleComplete(service) {
    try {
      const monthlyData = await this.getRemainingForMonth(service);
      return monthlyData.remaining <= 0;
    } catch (error) {
      console.error(`[APILimiter] Error checking monthly cycle:`, error);
      return false;
    }
  }

  /**
   * Get smart batching recommendation for Sunday batch generation
   * Uses remaining quota to determine how many topics to generate
   */
  async getBatchRecommendation() {
    try {
      const geminiBatch = BATCH_CONFIG.SUNDAY_BATCH.TOPICS_TO_GENERATE;
      const geminiBudget = (await this.checkLimit('GEMINI')).remaining;
      const heygenBudget = (await this.getRemainingForMonth('HEYGEN')).remaining;

      // Adjust batch based on available budget
      const topicsToGenerate = Math.min(geminiBatch, Math.floor(geminiBudget / 2));
      const scriptsToGenerate = Math.min(geminiBatch, Math.floor(geminiBudget / 1));
      const videosToGenerate = Math.min(heygenBudget, 3); // Conservative estimate

      console.log(
        `[APILimiter] Batch recommendation - Topics: ${topicsToGenerate}, Scripts: ${scriptsToGenerate}, Videos: ${videosToGenerate}`
      );

      return {
        topicsToGenerate,
        scriptsToGenerate,
        videosToGenerate,
        geminiBudget,
        heygenBudget,
      };
    } catch (error) {
      console.error(`[APILimiter] Error getting batch recommendation:`, error);
      throw error;
    }
  }

  /**
   * Get overall API status
   */
  async getStatus() {
    try {
      const gemini = await this.checkLimit('GEMINI');
      const heygen = await this.getRemainingForMonth('HEYGEN');
      const instagram = await this.checkLimit('INSTAGRAM');

      return {
        gemini: {
          ...gemini,
          status: gemini.available ? 'healthy' : 'warning',
        },
        heygen: {
          ...heygen,
          status: heygen.remaining > 5 ? 'healthy' : 'warning',
        },
        instagram: {
          ...instagram,
          status: instagram.available ? 'healthy' : 'warning',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[APILimiter] Error getting status:`, error);
      throw error;
    }
  }
}

export default APILimiter;
