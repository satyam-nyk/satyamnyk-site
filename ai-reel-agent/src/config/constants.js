// API Configuration and Limits

export const API_LIMITS = {
  MISTRAL: {
    DAILY_LIMIT: 200,
    CALLS_PER_MINUTE: 30,
    TIMEOUT: 30000, // 30 seconds
  },
  GEMINI: {
    DAILY_LIMIT: 50,
    CALLS_PER_MINUTE: 15,
    TIMEOUT: 30000, // 30 seconds
  },
  HEYGEN: {
    MONTHLY_LIMIT: 10,
    MONTHLY_CREDITS: 3000,
    TIMEOUT: 60000, // 60 seconds
    VIDEO_QUALITY: 'high',
  },
  INSTAGRAM: {
    DAILY_LIMIT: 200,
    RATE_LIMIT: 200, // requests per hour
    TIMEOUT: 30000, // 30 seconds
  },
  YOUTUBE: {
    DAILY_LIMIT: 10000, // quota units/day on YouTube Data API
    TIMEOUT: 120000, // uploads and media endpoints can be slower
  },
};

// Video Configuration
export const VIDEO_CONFIG = {
  DURATION_MIN: 60, // seconds
  DURATION_MAX: 120, // seconds
  TARGET_DURATION: 90, // ideal duration
  FORMATS: {
    VIDEO: ['mp4', 'mov'],
    IMAGE: ['jpg', 'png', 'webp'],
  },
  RESOLUTION: {
    WIDTH: 1080,
    HEIGHT: 1920,
    FORMAT: '9:16',
  },
  STORAGE: {
    MAX_SIZE_MB: 100,
    CLEANUP_DAYS: 30,
  },
};

// Generation Strategy (Rotation Pattern)
export const GENERATION_STRATEGY = {
  WEEK_1: 'heygen', // Full HeyGen generation
  WEEK_2: 'runway', // Runway AI (alternative)
  WEEK_3: 'heygen', // Back to HeyGen
  WEEK_4: 'cached', // Use cached videos
};

// Database Configuration
export const DATABASE_CONFIG = {
  JOURNAL_MODE: 'WAL',
  TIMEOUT: 30000,
  CACHE_SIZE: -64000, // 64MB
  SYNCHRONOUS: 'NORMAL',
};

// Script Generation Defaults
export const SCRIPT_CONFIG = {
  LENGTH: {
    SHORT: { min: 15, max: 20, words: 50 }, // words estimate
    MEDIUM: { min: 30, max: 45, words: 100 },
    LONG: { min: 50, max: 60, words: 150 },
  },
  HOOKS: [
    'wait for the end',
    'you won\'t believe this',
    'watch till the end',
    'this changed everything',
    'one simple trick',
  ],
  EMOJIS_ENABLED: true,
  CTA_ENABLED: true,
  TRENDING_KEYWORDS: true,
  STATIC_POST: {
    MAX_WORDS: 50,
  },
};

// Batch Processing Configuration
export const BATCH_CONFIG = {
  SUNDAY_BATCH: {
    ENABLED: true,
    TOPICS_TO_GENERATE: 7, // Generate topics for entire week
    SCRIPTS_TO_GENERATE: 7,
  },
  MAX_CONCURRENT_REQUESTS: 5,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 2000,
};

// Caching Configuration
export const CACHE_CONFIG = {
  TOPIC_CACHE_DAYS: 30,
  VIDEO_CACHE_DAYS: 90,
  REUSE_AFTER_DAYS: 7,
  MAX_CACHED_TOPICS: 100,
  MAX_CACHED_VIDEOS: 50,
};

// Webhook Configuration
export const WEBHOOK_CONFIG = {
  TIMEOUT: 120000, // 2 minutes for full pipeline
  MAX_RETRIES: 3,
  RETRY_INTERVAL_MS: 5000,
};

// Logging Configuration
export const LOGGING_CONFIG = {
  LEVEL: process.env.LOG_LEVEL || 'info',
  FORMAT: 'combined',
  ARCHIVE_DAYS: 30,
};

// Instagram Post Configuration
export const INSTAGRAM_CONFIG = {
  CAPTION_MIN_LENGTH: 5,
  CAPTION_MAX_LENGTH: 2200,
  HASHTAG_COUNT: 25,
  HASHTAGS: [
    '#Reels',
    '#Trending',
    '#Viral',
    '#ForYou',
    '#FYP',
    '#Fyp',
    '#Explore',
    '#ExploreMore',
  ],
};

// Feature Flags
export const FEATURES = {
  AUTO_POST: true,
  AUTO_SCHEDULE: true,
  AUTO_ANALYTICS: true,
  BATCH_PROCESSING: true,
  FALLBACK_VIDEOS: true,
};

// Timing Configuration (in hours UTC)
export const TIMING = {
  DAILY_POST_TIMES: [0, 6, 12, 18], // every 6 hours UTC
  BATCH_PROCESSING_DAY: 0, // Sunday (0)
  BATCH_PROCESSING_TIME: 0, // Midnight UTC
  ANALYTICS_UPDATE_INTERVAL: 6, // Every 6 hours
};

// Default values
export const DEFAULTS = {
  VIDEO_GENERATOR: 'heygen',
  VIDEO_AVATAR: 'default',
  RETRY_ATTEMPTS: 3,
  TIMEOUT_SECONDS: 30,
  POLLING_INTERVAL_MS: 5000,
};

// Status Constants
export const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  POSTED: 'posted',
  FAILED: 'failed',
  QUEUED: 'queued',
};

// Error Messages
export const ERROR_MESSAGES = {
  API_LIMIT_EXCEEDED: 'Daily API limit exceeded',
  MONTHLY_QUOTA_EXCEEDED: 'Monthly quota exceeded',
  INVALID_VIDEO_FORMAT: 'Invalid video format',
  INSTAGRAM_POST_FAILED: 'Failed to post on Instagram',
  VIDEO_GENERATION_FAILED: 'Video generation failed',
  DATABASE_ERROR: 'Database operation failed',
  WEBHOOK_VERIFICATION_FAILED: 'Webhook verification failed',
};
