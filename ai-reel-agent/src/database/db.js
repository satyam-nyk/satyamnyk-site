import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Database {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database and create tables
   */
  async initDB() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
          return;
        }

        console.log('Database connected');

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        this.db.exec(schema, (err) => {
          if (err) {
            console.error('Schema initialization error:', err);
            reject(err);
            return;
          }
          this.ensureMigrations()
            .then(() => {
              console.log('Database schema initialized');
              resolve();
            })
            .catch((migrationErr) => {
              console.error('Database migration error:', migrationErr);
              reject(migrationErr);
            });
        });
      });
    });
  }

  async ensureMigrations() {
    await this.ensureColumns('daily_posts', {
      youtube_video_id: 'TEXT',
      youtube_url: 'TEXT',
      youtube_views: 'INTEGER DEFAULT 0',
      youtube_likes: 'INTEGER DEFAULT 0',
      youtube_comments: 'INTEGER DEFAULT 0',
    });
  }

  async ensureColumns(tableName, columns) {
    const existing = await new Promise((resolve, reject) => {
      this.db.all(`PRAGMA table_info(${tableName})`, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(new Set((rows || []).map((row) => row.name)));
      });
    });

    for (const [columnName, definition] of Object.entries(columns)) {
      if (existing.has(columnName)) {
        continue;
      }

      await new Promise((resolve, reject) => {
        this.db.run(
          `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`,
          (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          }
        );
      });
    }
  }

  /**
   * Get API usage for a specific service and date
   */
  async getAPIUsage(service, date) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM api_usage WHERE service = ? AND date = ?';
      this.db.get(query, [service, date], (err, row) => {
        if (err) {
          console.error('Error getting API usage:', err);
          reject(err);
          return;
        }
        resolve(row || { service, date, calls_used: 0 });
      });
    });
  }

  /**
   * Record API usage
   */
  async recordAPIUsage(service, calls = 1) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const query = `
        INSERT INTO api_usage (service, calls_used, date)
        VALUES (?, ?, ?)
        ON CONFLICT(service, date) DO UPDATE SET calls_used = calls_used + ?
      `;
      this.db.run(query, [service, calls, today, calls], (err) => {
        if (err) {
          console.error('Error recording API usage:', err);
          reject(err);
          return;
        }
        resolve({ service, date: today, calls_added: calls });
      });
    });
  }

  /**
   * Insert scripts into queue (batch operation)
   */
  async insertScriptQueue(scripts) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(scripts) || scripts.length === 0) {
        reject(new Error('Scripts must be a non-empty array'));
        return;
      }

      const stmt = this.db.prepare(`
        INSERT INTO script_queue (topic, script, duration, hooks, generated_date, status)
        VALUES (?, ?, ?, ?, ?, 'queued')
      `);

      const today = new Date().toISOString().split('T')[0];
      let inserted = 0;

      scripts.forEach((scriptData, index) => {
        stmt.run(
          [
            scriptData.topic,
            scriptData.script,
            scriptData.duration || 45,
            JSON.stringify(scriptData.hooks || {}),
            today,
          ],
          (err) => {
            if (err) {
              console.error('Error inserting script:', err);
              reject(err);
              return;
            }
            inserted++;
            if (inserted === scripts.length) {
              stmt.finalize();
              resolve({ inserted, total: scripts.length });
            }
          }
        );
      });
    });
  }

  /**
   * Get next queued script
   */
  async getQueuedScript() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM script_queue
        WHERE status = 'queued'
        ORDER BY generated_date ASC, id ASC
        LIMIT 1
      `;
      this.db.get(query, (err, row) => {
        if (err) {
          console.error('Error getting queued script:', err);
          reject(err);
          return;
        }
        if (row && row.hooks) {
          row.hooks = JSON.parse(row.hooks);
        }
        resolve(row);
      });
    });
  }

  /**
   * Update script status after posting
   */
  async updateScriptStatus(scriptId, status, videoId, postId) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const query = `
        UPDATE script_queue
        SET status = ?, video_id = ?, instagram_post_id = ?, used_date = ?, posted_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      this.db.run(query, [status, videoId, postId, today, today, scriptId], (err) => {
        if (err) {
          console.error('Error updating script status:', err);
          reject(err);
          return;
        }
        resolve({ scriptId, status, videoId, postId });
      });
    });
  }

  /**
   * Get cached topic if API limit reached
   */
  async getCachedTopic() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM topics_cache
        ORDER BY used_count ASC, last_used_date ASC
        LIMIT 1
      `;
      this.db.get(query, (err, row) => {
        if (err) {
          console.error('Error getting cached topic:', err);
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * Cache a result (topic, video, or script)
   */
  async cacheResult(type, data) {
    return new Promise((resolve, reject) => {
      if (type === 'topic') {
        const query = `
          INSERT INTO topics_cache (topic, description, alternative_descriptions, trending_score)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(topic) DO UPDATE SET
            alternative_descriptions = excluded.alternative_descriptions,
            trending_score = excluded.trending_score,
            updated_at = CURRENT_TIMESTAMP
        `;
        this.db.run(
          query,
          [
            data.topic,
            data.description,
            JSON.stringify(data.alternatives || []),
            data.score || 0,
          ],
          (err) => {
            if (err) reject(err);
            else resolve({ type, topic: data.topic });
          }
        );
      } else if (type === 'video') {
        const query = `
          INSERT INTO video_cache (video_file, video_url, topic, generation_date, generation_method)
          VALUES (?, ?, ?, ?, ?)
        `;
        this.db.run(
          query,
          [
            data.file,
            data.url,
            data.topic,
            new Date().toISOString().split('T')[0],
            data.method || 'heygen',
          ],
          (err) => {
            if (err) reject(err);
            else resolve({ type, file: data.file });
          }
        );
      } else {
        reject(new Error('Invalid cache type'));
      }
    });
  }

  /**
   * Update video reuse count
   */
  async updateVideoReuse(videoId) {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const query = `
        UPDATE video_cache
        SET reuse_count = reuse_count + 1, last_used_date = ?
        WHERE id = ?
      `;
      this.db.run(query, [today, videoId], (err) => {
        if (err) {
          console.error('Error updating video reuse:', err);
          reject(err);
          return;
        }
        resolve({ videoId, reuseUpdated: true });
      });
    });
  }

  /**
   * Get analytics for specified number of days
   */
  async getAnalytics(days = 30) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM analytics
        WHERE date >= date('now', ?)
        ORDER BY date DESC
      `;
      this.db.all(query, [`-${days} days`], (err, rows) => {
        if (err) {
          console.error('Error getting analytics:', err);
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get all post statistics
   */
  async getAllPostStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          COUNT(*) as total_posts,
          SUM(views) as total_views,
          SUM(likes) as total_likes,
          SUM(comments) as total_comments,
          SUM(shares) as total_shares,
          ROUND(AVG(views), 2) as avg_views,
          ROUND(AVG((likes + comments + shares) / CAST(NULLIF(views, 0) AS FLOAT)), 4) as avg_engagement_rate
        FROM daily_posts
        WHERE status = 'posted'
      `;
      this.db.get(query, (err, row) => {
        if (err) {
          console.error('Error getting post stats:', err);
          reject(err);
          return;
        }
        resolve(row || {});
      });
    });
  }

  /**
   * Get today's post
   */
  async getTodayPost() {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      const query = 'SELECT * FROM daily_posts WHERE date = ?';
      this.db.get(query, [today], (err, row) => {
        if (err) {
          console.error('Error getting today post:', err);
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  /**
   * Insert or update daily post
   */
  async upsertDailyPost(date, data) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO daily_posts (date, topic, script, video_id, status, generation_method)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          topic = excluded.topic,
          script = excluded.script,
          video_id = excluded.video_id,
          status = excluded.status,
          generation_method = excluded.generation_method,
          updated_at = CURRENT_TIMESTAMP
      `;
      this.db.run(
        query,
        [
          date,
          data.topic,
          data.script,
          data.videoId,
          data.status || 'pending',
          data.method,
        ],
        (err) => {
          if (err) {
            console.error('Error upserting daily post:', err);
            reject(err);
            return;
          }
          resolve({ date, ...data });
        }
      );
    });
  }

  /**
   * Update post with Instagram data
   */
  async updatePostWithInstagram(date, instagramPostId, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE daily_posts
        SET instagram_post_id = ?, status = ?, posted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `;
      this.db.run(query, [instagramPostId, status, date], (err) => {
        if (err) {
          console.error('Error updating post with Instagram data:', err);
          reject(err);
          return;
        }
        resolve({ date, instagramPostId, status });
      });
    });
  }

  /**
   * Update post with YouTube data
   */
  async updatePostWithYouTube(date, youtubeVideoId, youtubeUrl) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE daily_posts
        SET youtube_video_id = ?, youtube_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE date = ?
      `;
      this.db.run(query, [youtubeVideoId, youtubeUrl, date], (err) => {
        if (err) {
          console.error('Error updating post with YouTube data:', err);
          reject(err);
          return;
        }
        resolve({ date, youtubeVideoId, youtubeUrl });
      });
    });
  }

  /**
   * Update post analytics
   */
  async updatePostAnalytics(instagramPostId, views, likes, comments, shares) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE daily_posts
        SET views = ?, likes = ?, comments = ?, shares = ?, updated_at = CURRENT_TIMESTAMP
        WHERE instagram_post_id = ?
      `;
      this.db.run(query, [views, likes, comments, shares, instagramPostId], (err) => {
        if (err) {
          console.error('Error updating post analytics:', err);
          reject(err);
          return;
        }
        resolve({ instagramPostId, views, likes, comments, shares });
      });
    });
  }

  async updatePostYouTubeAnalytics(youtubeVideoId, views, likes, comments) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE daily_posts
        SET youtube_views = ?, youtube_likes = ?, youtube_comments = ?, updated_at = CURRENT_TIMESTAMP
        WHERE youtube_video_id = ?
      `;
      this.db.run(query, [views, likes, comments, youtubeVideoId], (err) => {
        if (err) {
          console.error('Error updating YouTube analytics:', err);
          reject(err);
          return;
        }
        resolve({ youtubeVideoId, views, likes, comments });
      });
    });
  }

  async upsertStaticPost(date, data) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO static_posts (date, topic, summary, word_count, source, status)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          topic = excluded.topic,
          summary = excluded.summary,
          word_count = excluded.word_count,
          source = excluded.source,
          status = excluded.status,
          updated_at = CURRENT_TIMESTAMP
      `;

      this.db.run(
        query,
        [
          date,
          data.topic,
          data.summary,
          data.wordCount || 0,
          data.source || 'llm',
          data.status || 'ready',
        ],
        (err) => {
          if (err) {
            console.error('Error upserting static post:', err);
            reject(err);
            return;
          }
          resolve({ date, ...data });
        }
      );
    });
  }

  async getLatestStaticPost() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, date, topic, summary, word_count, source, status, created_at, updated_at
        FROM static_posts
        ORDER BY date DESC
        LIMIT 1
      `;
      this.db.get(query, (err, row) => {
        if (err) {
          console.error('Error getting latest static post:', err);
          reject(err);
          return;
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Get monthly trending topics
   */
  async getMonthlyTrendingTopics(limit = 10) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT topic, COUNT(*) as usage_count, AVG(views) as avg_views
        FROM daily_posts
        WHERE date >= date('now', '-30 days') AND status = 'posted'
        GROUP BY topic
        ORDER BY usage_count DESC, avg_views DESC
        LIMIT ?
      `;
      this.db.all(query, [limit], (err, rows) => {
        if (err) {
          console.error('Error getting trending topics:', err);
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Get post history with pagination and computed engagement rate
   */
  async getPostHistory(limit = 50, offset = 0, status = null) {
    return new Promise((resolve, reject) => {
      const params = [];
      let where = '';
      if (status && status !== 'all') {
        where = 'WHERE status = ?';
        params.push(status);
      }

      const query = `
        SELECT
          id,
          date,
          topic,
          script,
          video_id,
          instagram_post_id,
          youtube_video_id,
          youtube_url,
          youtube_views,
          youtube_likes,
          youtube_comments,
          views,
          likes,
          comments,
          shares,
          status,
          generation_method,
          posted_at,
          created_at,
          updated_at,
          CASE
            WHEN views > 0 THEN ROUND(((likes + comments + shares) * 100.0) / views, 2)
            ELSE 0
          END as engagement_rate
        FROM daily_posts
        ${where}
        ORDER BY date DESC
        LIMIT ? OFFSET ?
      `;

      this.db.all(query, [...params, limit, offset], (err, rows) => {
        if (err) {
          console.error('Error getting post history:', err);
          reject(err);
          return;
        }
        resolve(rows || []);
      });
    });
  }

  /**
   * Count total posts for history pagination
   */
  async countPosts(status = null) {
    return new Promise((resolve, reject) => {
      const params = [];
      let where = '';
      if (status && status !== 'all') {
        where = 'WHERE status = ?';
        params.push(status);
      }

      const query = `SELECT COUNT(*) as total FROM daily_posts ${where}`;
      this.db.get(query, params, (err, row) => {
        if (err) {
          console.error('Error counting posts:', err);
          reject(err);
          return;
        }
        resolve(row?.total || 0);
      });
    });
  }

  /**
   * Get one post detail by id
   */
  async getPostById(postId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          id,
          date,
          topic,
          script,
          video_id,
          instagram_post_id,
          youtube_video_id,
          youtube_url,
          youtube_views,
          youtube_likes,
          youtube_comments,
          views,
          likes,
          comments,
          shares,
          status,
          generation_method,
          posted_at,
          created_at,
          updated_at,
          CASE
            WHEN views > 0 THEN ROUND(((likes + comments + shares) * 100.0) / views, 2)
            ELSE 0
          END as engagement_rate
        FROM daily_posts
        WHERE id = ?
      `;

      this.db.get(query, [postId], (err, row) => {
        if (err) {
          console.error('Error getting post by id:', err);
          reject(err);
          return;
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Aggregate insights for dashboard overview
   */
  async getInsightsSummary(days = 30) {
    return new Promise((resolve, reject) => {
      const params = [`-${days} days`];

      const kpiQuery = `
        SELECT
          COUNT(*) as total_posts,
          SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(views) as total_views,
          SUM(likes) as total_likes,
          SUM(comments) as total_comments,
          SUM(shares) as total_shares,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_rate
        FROM daily_posts
        WHERE date >= date('now', ?)
      `;

      this.db.get(kpiQuery, params, (kpiErr, kpiRow) => {
        if (kpiErr) {
          console.error('Error getting insight KPI:', kpiErr);
          reject(kpiErr);
          return;
        }

        const topTopicsQuery = `
          SELECT
            topic,
            COUNT(*) as posts,
            ROUND(AVG(views), 2) as avg_views,
            ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_rate
          FROM daily_posts
          WHERE date >= date('now', ?) AND topic IS NOT NULL AND topic != ''
          GROUP BY topic
          ORDER BY posts DESC, avg_views DESC
          LIMIT 10
        `;

        this.db.all(topTopicsQuery, params, (topicErr, topicRows) => {
          if (topicErr) {
            console.error('Error getting top topics:', topicErr);
            reject(topicErr);
            return;
          }

          const methodSplitQuery = `
            SELECT
              COALESCE(generation_method, 'unknown') as method,
              COUNT(*) as count
            FROM daily_posts
            WHERE date >= date('now', ?)
            GROUP BY COALESCE(generation_method, 'unknown')
            ORDER BY count DESC
          `;

          this.db.all(methodSplitQuery, params, (methodErr, methodRows) => {
            if (methodErr) {
              console.error('Error getting generation split:', methodErr);
              reject(methodErr);
              return;
            }

            resolve({
              kpi: kpiRow || {},
              topTopics: topicRows || [],
              methodSplit: methodRows || [],
            });
          });
        });
      });
    });
  }

  /**
   * Compute recommendation insights for posting strategy
   */
  async getRecommendations(days = 90) {
    return new Promise((resolve, reject) => {
      const rangeParam = `-${days} days`;

      const bestHourQuery = `
        SELECT
          strftime('%H', posted_at) as hour,
          COUNT(*) as posts,
          ROUND(AVG(views), 2) as avg_views,
          ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement
        FROM daily_posts
        WHERE status = 'posted' AND posted_at IS NOT NULL AND date >= date('now', ?)
        GROUP BY strftime('%H', posted_at)
        ORDER BY COALESCE(avg_engagement, 0) DESC, COALESCE(avg_views, 0) DESC, posts DESC
        LIMIT 1
      `;

      this.db.get(bestHourQuery, [rangeParam], (hourErr, bestHour) => {
        if (hourErr) {
          console.error('Error getting best posting hour:', hourErr);
          reject(hourErr);
          return;
        }

        const bestDayQuery = `
          SELECT
            strftime('%w', posted_at) as day,
            COUNT(*) as posts,
            ROUND(AVG(views), 2) as avg_views,
            ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement
          FROM daily_posts
          WHERE status = 'posted' AND posted_at IS NOT NULL AND date >= date('now', ?)
          GROUP BY strftime('%w', posted_at)
          ORDER BY COALESCE(avg_engagement, 0) DESC, COALESCE(avg_views, 0) DESC, posts DESC
          LIMIT 1
        `;

        this.db.get(bestDayQuery, [rangeParam], (dayErr, bestDay) => {
          if (dayErr) {
            console.error('Error getting best posting day:', dayErr);
            reject(dayErr);
            return;
          }

          const momentumQuery = `
            SELECT
              topic,
              COUNT(CASE WHEN date >= date('now', '-14 days') THEN 1 END) as recent_posts,
              ROUND(AVG(CASE WHEN date >= date('now', '-14 days') THEN views END), 2) as recent_avg_views,
              ROUND(AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END), 2) as previous_avg_views,
              ROUND(
                ((COALESCE(AVG(CASE WHEN date >= date('now', '-14 days') THEN views END), 0) -
                COALESCE(AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END), 0))
                * 100.0) /
                CASE
                  WHEN COALESCE(AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END), 0) <= 0 THEN 1
                  ELSE AVG(CASE WHEN date < date('now', '-14 days') AND date >= date('now', '-28 days') THEN views END)
                END,
                2
              ) as momentum_score
            FROM daily_posts
            WHERE status = 'posted' AND topic IS NOT NULL AND topic != ''
            GROUP BY topic
            HAVING recent_posts > 0
            ORDER BY momentum_score DESC, recent_avg_views DESC
            LIMIT 5
          `;

          this.db.all(momentumQuery, (momentumErr, momentumRows) => {
            if (momentumErr) {
              console.error('Error getting momentum topics:', momentumErr);
              reject(momentumErr);
              return;
            }

            const cadenceQuery = `
              SELECT
                COUNT(*) as posts_last_7,
                ROUND(AVG(views), 2) as avg_views_last_7,
                ROUND(AVG(CASE WHEN views > 0 THEN ((likes + comments + shares) * 100.0) / views END), 2) as avg_engagement_last_7
              FROM daily_posts
              WHERE status = 'posted' AND date >= date('now', '-7 days')
            `;

            this.db.get(cadenceQuery, (cadenceErr, cadence) => {
              if (cadenceErr) {
                console.error('Error getting cadence stats:', cadenceErr);
                reject(cadenceErr);
                return;
              }

              resolve({
                bestHour: bestHour || null,
                bestDay: bestDay || null,
                momentumTopics: momentumRows || [],
                cadence: cadence || {},
              });
            });
          });
        });
      });
    });
  }

  /**
   * Close database connection
   */
  closeDB() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            console.error('Error closing database:', err);
            reject(err);
            return;
          }
          console.log('Database closed');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

export default Database;
