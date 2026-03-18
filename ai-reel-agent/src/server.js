import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Database and services
import Database from './database/db.js';
import APILimiter from './services/api-limiter.js';
import LLMService from './services/gemini-service.js';
import HeyGenService from './services/heygen-service.js';
import InstagramService from './services/instagram-service.js';
import YouTubeService from './services/youtube-service.js';
import StockVideoService from './services/stock-video-service.js';
import TTSService from './services/tts-service.js';
import VideoCompositionService from './services/video-composition-service.js';

// Agents
import ResearchAgent from './agents/research-agent.js';
import ScriptAgent from './agents/script-agent.js';
import VideoAgent from './agents/video-agent.js';
import { FEATURES, TIMING } from './config/constants.js';

// Routes
import { createWebhookRouter } from './routes/webhook.js';
import { createDashboardRouter } from './routes/dashboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get configuration from environment
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = process.env.DATABASE_PATH || './database.sqlite';

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Global state
let database = null;
let apiLimiter = null;
let llmService = null;
let heygenService = null;
let instagramService = null;
let youtubeService = null;
let stockVideoService = null;
let ttsService = null;
let compositionService = null;
let researchAgent = null;
let scriptAgent = null;
let videoAgent = null;
let dailySchedulerTimeout = null;

function getDailySchedulerHours() {
  const envRaw = process.env.DAILY_POST_TIMES_UTC || '';
  const source = envRaw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 23);

  const fallback = Array.isArray(TIMING.DAILY_POST_TIMES)
    ? TIMING.DAILY_POST_TIMES
    : [0, 6, 12, 18];

  const hours = (source.length ? source : fallback)
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 0 && v <= 23);

  if (!hours.length) return [0, 6, 12, 18];
  return [...new Set(hours)].sort((a, b) => a - b);
}

/**
 * Initialize all services
 */
async function initializeServices() {
  try {
    console.log('[Server] Initializing services...');

    // 1. Initialize Database
    console.log('[Server] Initializing database...');
    database = new Database(DB_PATH);
    await database.initDB();

    // 2. Initialize API Limiter
    console.log('[Server] Initializing API limiter...');
    apiLimiter = new APILimiter(database);

    // 3. Initialize LLM Service (Mistral primary, Gemini fallback)
    if (!process.env.MISTRAL_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error('MISTRAL_API_KEY or GOOGLE_GEMINI_API_KEY must be set');
    }
    console.log('[Server] Initializing LLM service (Mistral primary)...');
    llmService = new LLMService(process.env.MISTRAL_API_KEY, apiLimiter, {
      geminiApiKey: process.env.GOOGLE_GEMINI_API_KEY,
      mistralModel: process.env.MISTRAL_MODEL,
    });

    // 4. Initialize HeyGen Service
    if (!process.env.HEYGEN_API_KEY) {
      throw new Error('HEYGEN_API_KEY is not set');
    }
    console.log('[Server] Initializing HeyGen service...');
    heygenService = new HeyGenService(process.env.HEYGEN_API_KEY, apiLimiter);

    // 5. Initialize Instagram Service
    if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
      throw new Error('Instagram credentials are not set');
    }
    console.log('[Server] Initializing Instagram service...');
    instagramService = new InstagramService(
      process.env.INSTAGRAM_ACCESS_TOKEN,
      process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
      apiLimiter
    );

    const youtubeEnabled = String(process.env.YOUTUBE_ENABLED || 'false').toLowerCase() === 'true';
    if (youtubeEnabled) {
      console.log('[Server] Initializing YouTube service...');
      youtubeService = new YouTubeService({ apiLimiter });
    }

    // 6. Initialize Agents
    console.log('[Server] Initializing agents...');
    researchAgent = new ResearchAgent(llmService, database, apiLimiter);
    scriptAgent = new ScriptAgent(llmService, database, apiLimiter);
    
    // 7. Initialize free-tier hybrid video services
    console.log('[Server] Initializing free-tier video services...');
    stockVideoService = new StockVideoService();
    ttsService = new TTSService();
    compositionService = new VideoCompositionService();
    
    // 8. Initialize VideoAgent with hybrid support
    videoAgent = new VideoAgent(
      heygenService,
      database,
      apiLimiter,
      stockVideoService,
      ttsService,
      compositionService
    );

    console.log('[Server] All services initialized successfully');
  } catch (error) {
    console.error('[Server] Error initializing services:', error.message);
    throw error;
  }
}

/**
 * Setup routes
 */
function setupRoutes() {
  console.log('[Server] Setting up routes...');

  // Webhook routes
  const webhookRouter = createWebhookRouter(
    database,
    apiLimiter,
    researchAgent,
    scriptAgent,
    videoAgent,
    instagramService,
    youtubeService
  );
  app.use('/api/webhook', webhookRouter);

  // Dashboard routes
  const dashboardRouter = createDashboardRouter(
    database,
    apiLimiter,
    researchAgent,
    scriptAgent,
    videoAgent,
    instagramService
  );
  app.use('/dashboard', dashboardRouter);
  app.get('/api/dashboard', (req, res) => {
    res.redirect('/dashboard/api/dashboard-data');
  });

  app.get('/reel-agent', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/microsite.html'));
  });

  app.get('/dashboard-public-stats', async (req, res) => {
    try {
      const [postStats, insights] = await Promise.all([
        database.getAllPostStats(),
        database.getInsightsSummary(30),
      ]);

      const topMethod = insights?.methodSplit?.[0]?.method || null;
      return res.json({
        success: true,
        data: {
          totalPosts: postStats.total_posts || 0,
          totalViews: postStats.total_views || 0,
          avgEngagementRate: postStats.avg_engagement_rate || 0,
          topMethod,
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/public-config', (req, res) => {
    return res.json({
      success: true,
      instagramPageUrl: process.env.INSTAGRAM_PAGE_URL || null,
    });
  });

  // Health check endpoint
  app.get('/', (req, res) => {
    res.json({
      success: true,
      service: 'AI Reel Agent',
      version: '1.0.0',
      status: 'operational',
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      const status = await apiLimiter.getStatus();
      const todayPost = await database.getTodayPost();

      return res.json({
        success: true,
        status: 'operational',
        services: status,
        todayPost: {
          exists: !!todayPost,
          status: todayPost?.status || 'not_started',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Server] Health check error:', error.message);
      return res.status(500).json({
        success: false,
        status: 'error',
        error: error.message,
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      path: req.path,
    });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Internal Server Error',
    });
  });
}

function scheduleNextDailyRun() {
  if (!FEATURES.AUTO_SCHEDULE) {
    console.log('[Server] Daily scheduler disabled by feature flag');
    return;
  }

  const now = new Date();
  const hours = getDailySchedulerHours();
  let nextRun = null;
  let nextSlotIndex = 0;

  for (let i = 0; i < hours.length; i += 1) {
    const hour = hours[i];
    const candidate = new Date(now);
    candidate.setUTCHours(hour, 0, 0, 0);
    if (candidate > now) {
      nextRun = candidate;
      nextSlotIndex = i;
      break;
    }
  }

  if (!nextRun) {
    nextRun = new Date(now);
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
    nextRun.setUTCHours(hours[0], 0, 0, 0);
    nextSlotIndex = 0;
  }

  const delay = nextRun.getTime() - now.getTime();
  console.log(`[Server] Auto scheduler hours (UTC): ${hours.join(', ')}`);
  console.log(`[Server] Next reel scheduler run at ${nextRun.toISOString()} (slot ${nextSlotIndex})`);

  clearTimeout(dailySchedulerTimeout);
  dailySchedulerTimeout = setTimeout(async () => {
    try {
      const headers = {};
      if (process.env.WEBHOOK_SECRET) {
        headers.Authorization = `Bearer ${process.env.WEBHOOK_SECRET}`;
      }

      const response = await fetch(`http://127.0.0.1:${PORT}/api/webhook/generate-themed-reel?slot=${nextSlotIndex}`, {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      console.log('[Server] Daily scheduler response:', JSON.stringify(data));
    } catch (error) {
      console.error('[Server] Daily scheduler error:', error.message);
    } finally {
      scheduleNextDailyRun();
    }
  }, delay);
}

/**
 * Start server
 */
async function startServer() {
  try {
    // Initialize services
    await initializeServices();

    // Setup routes
    setupRoutes();

    // Start listening
    app.listen(PORT, () => {
      console.log(`[Server] AI Reel Agent started on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${NODE_ENV}`);
      console.log(`[Server] Database: ${DB_PATH}`);
      console.log(`[Server] Dashboard: http://localhost:${PORT}/dashboard`);
      console.log(`[Server] API Health: http://localhost:${PORT}/api/health`);
      scheduleNextDailyRun();
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error.message);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGINT', async () => {
  console.log('[Server] Shutting down gracefully...');
  try {
    if (database) {
      await database.closeDB();
    }
    process.exit(0);
  } catch (error) {
    console.error('[Server] Error during shutdown:', error.message);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down...');
  try {
    if (database) {
      await database.closeDB();
    }
    process.exit(0);
  } catch (error) {
    console.error('[Server] Error during shutdown:', error.message);
    process.exit(1);
  }
});

// Start the server
startServer();
