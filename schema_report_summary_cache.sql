-- ============================================================
-- Report Summary Cache Table
-- Stores AI-generated report summaries for reuse.
-- Prevents duplicate AI calls for identical filter combinations.
-- ============================================================

CREATE TABLE IF NOT EXISTS report_summary_cache (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cache_key       VARCHAR(128)   NOT NULL COMMENT 'SHA-256 hash of school+class+subject+reportType+dateRange',
  data_version    VARCHAR(128)   NOT NULL COMMENT 'SHA-256 hash of current metric values — detects data changes',
  report_data     JSON           NOT NULL COMMENT 'Full AI response JSON blob',
  report_type     VARCHAR(32)    DEFAULT NULL,
  school_filter   VARCHAR(255)   DEFAULT NULL,
  class_filter    VARCHAR(255)   DEFAULT NULL,
  subject_filter  VARCHAR(255)   DEFAULT NULL,
  date_range_start VARCHAR(32)   DEFAULT NULL,
  date_range_end   VARCHAR(32)   DEFAULT NULL,
  ai_provider     VARCHAR(32)    DEFAULT 'ollama' COMMENT 'Which AI provider generated this report',
  ai_model        VARCHAR(64)    DEFAULT 'mistral',
  generation_ms   INT            DEFAULT 0 COMMENT 'Time taken to generate in milliseconds',
  from_cache      TINYINT(1)     DEFAULT 0,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  expires_at      TIMESTAMP      NULL DEFAULT NULL,
  UNIQUE KEY idx_cache_key (cache_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Report Analytics Log Table
-- Tracks every report request for analytics dashboard.
-- ============================================================

CREATE TABLE IF NOT EXISTS report_analytics_log (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  cache_key       VARCHAR(128)   DEFAULT NULL,
  request_type    ENUM('cache_hit','cache_miss','dedup','fallback','error') NOT NULL,
  ai_provider     VARCHAR(32)    DEFAULT NULL,
  ai_model        VARCHAR(64)    DEFAULT NULL,
  generation_ms   INT            DEFAULT 0,
  estimated_tokens INT           DEFAULT 0 COMMENT 'Estimated prompt tokens used',
  error_message   TEXT           DEFAULT NULL,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
