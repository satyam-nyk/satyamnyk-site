-- API Usage Tracking Table
CREATE TABLE IF NOT EXISTS api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    calls_used INTEGER DEFAULT 1,
    date TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service, date)
);

-- Script Queue Table
CREATE TABLE IF NOT EXISTS script_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    script TEXT NOT NULL,
    duration INTEGER,
    hooks TEXT,
    generated_date TEXT NOT NULL,
    used_date TEXT,
    video_id TEXT,
    posted_date TEXT,
    instagram_post_id TEXT,
    status TEXT DEFAULT 'queued',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Video Cache Table
CREATE TABLE IF NOT EXISTS video_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_file TEXT UNIQUE,
    video_url TEXT,
    topic TEXT,
    generation_date TEXT NOT NULL,
    generation_method TEXT DEFAULT 'heygen',
    reuse_count INTEGER DEFAULT 0,
    last_used_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Daily Posts Table
CREATE TABLE IF NOT EXISTS daily_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    topic TEXT,
    script TEXT,
    video_id TEXT,
    instagram_post_id TEXT UNIQUE,
    views INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    generation_method TEXT,
    posted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Static Current-Affairs Posts Table
CREATE TABLE IF NOT EXISTS static_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    topic TEXT NOT NULL,
    summary TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    source TEXT DEFAULT 'llm',
    status TEXT DEFAULT 'ready',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API Limits Tracking Table
CREATE TABLE IF NOT EXISTS api_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service TEXT NOT NULL,
    date TEXT NOT NULL,
    daily_limit INTEGER,
    monthly_limit INTEGER,
    used INTEGER DEFAULT 0,
    remaining INTEGER,
    cycle_type TEXT DEFAULT 'daily',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(service, date)
);

-- Topics Cache Table
CREATE TABLE IF NOT EXISTS topics_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT UNIQUE,
    description TEXT,
    alternative_descriptions TEXT,
    trending_score INTEGER DEFAULT 0,
    used_count INTEGER DEFAULT 0,
    last_used_date TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Table
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    total_posts INTEGER,
    total_views INTEGER,
    total_likes INTEGER,
    total_comments INTEGER,
    total_shares INTEGER,
    average_views_per_post REAL,
    average_engagement_rate REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_usage_service_date ON api_usage(service, date);
CREATE INDEX IF NOT EXISTS idx_script_queue_status ON script_queue(status);
CREATE INDEX IF NOT EXISTS idx_script_queue_generated_date ON script_queue(generated_date);
CREATE INDEX IF NOT EXISTS idx_daily_posts_date ON daily_posts(date);
CREATE INDEX IF NOT EXISTS idx_daily_posts_status ON daily_posts(status);
CREATE INDEX IF NOT EXISTS idx_static_posts_date ON static_posts(date);
CREATE INDEX IF NOT EXISTS idx_video_cache_topic ON video_cache(topic);
CREATE INDEX IF NOT EXISTS idx_topics_cache_used_count ON topics_cache(used_count);
