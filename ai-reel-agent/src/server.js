import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';

// Database and services
import Database from './database/db.js';
import APILimiter from './services/api-limiter.js';
import GeminiService from './services/gemini-service.js';
import HeyGenService from './services/heygen-service.js';
import InstagramService from './services/instagram-service.js';
import StockVideoService from './services/stock-video-service.js';
import TTSService from './services/tts-service.js';
import VideoCompositionService from './services/video-composition-service.js';

// Agents
import ResearchAgent from './agents/research-agent.js';
import ScriptAgent from './agents/script-agent.js';
import VideoAgent from './agents/video-agent.js';

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
let geminiService = null;
let heygenService = null;
let instagramService = null;
let stockVideoService = null;
let ttsService = null;
let compositionService = null;
let researchAgent = null;
let scriptAgent = null;
let videoAgent = null;

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

    // 3. Initialize Gemini Service
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not set');
    }
    console.log('[Server] Initializing Gemini service...');
    geminiService = new GeminiService(process.env.GOOGLE_GEMINI_API_KEY, apiLimiter);

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

    // 6. Initialize Agents
    console.log('[Server] Initializing agents...');
    researchAgent = new ResearchAgent(geminiService, database, apiLimiter);
    scriptAgent = new ScriptAgent(geminiService, database, apiLimiter);
    
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
    instagramService
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
