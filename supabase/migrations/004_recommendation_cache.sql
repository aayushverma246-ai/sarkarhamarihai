-- Create ai_recommendation_cache table to support high-performance persistent caching
-- and prevent rate-limit exhaustion of the Gemini API under the free tier.

CREATE TABLE IF NOT EXISTS ai_recommendation_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cache sorting and stale check
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_updated ON ai_recommendation_cache(updated_at DESC);
