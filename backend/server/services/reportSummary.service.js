import crypto from "crypto";
import getPool from "../config/db.js";

// ═══════════════════════════════════════════════════════════
// IN-FLIGHT DEDUPLICATION MAP
// Prevents duplicate concurrent AI requests for the same filters
// ═══════════════════════════════════════════════════════════
const inFlightRequests = new Map(); // cacheKey → Promise

// ═══════════════════════════════════════════════════════════
// CACHE KEY GENERATION
// ═══════════════════════════════════════════════════════════

export function computeCacheKey({ school, klass, subject, reportType, dateRange }) {
  const raw = [
    (school || "All Schools").trim().toLowerCase(),
    (klass || "All Classes").trim().toLowerCase(),
    (subject || "All Subjects").trim().toLowerCase(),
    (reportType || "All Time").trim().toLowerCase(),
    Array.isArray(dateRange) ? dateRange.join("|") : "",
  ].join("::");
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

export function computeDataVersion(metrics) {
  const raw = JSON.stringify(
    (metrics || []).map((m) => ({ l: m.label, v: m.value }))
  );
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 64);
}

// ═══════════════════════════════════════════════════════════
// CACHE TTL (Time-To-Live) by report type
// ═══════════════════════════════════════════════════════════

function getCacheTTLHours(reportType) {
  switch ((reportType || "").toLowerCase()) {
    case "daily":    return 24;
    case "weekly":   return 24 * 7;
    case "monthly":  return 24 * 30;
    case "all time": return 24 * 90;
    default:         return 24;
  }
}

// ═══════════════════════════════════════════════════════════
// DATABASE CACHE OPERATIONS
// ═══════════════════════════════════════════════════════════

export async function getCachedReport(cacheKey, dataVersion) {
  try {
    const db = getPool();
    const [rows] = await db.query(
      `SELECT report_data, data_version, expires_at FROM report_summary_cache
       WHERE cache_key = ? AND expires_at > NOW() LIMIT 1`,
      [cacheKey]
    );
    if (rows.length === 0) return null;

    const row = rows[0];
    // If data has changed (metrics differ), invalidate cache
    if (dataVersion && row.data_version !== dataVersion) {
      return null;
    }

    const reportData = typeof row.report_data === "string"
      ? JSON.parse(row.report_data)
      : row.report_data;

    return reportData;
  } catch (err) {
    console.error("[ReportCache] getCachedReport error:", err.message);
    return null;
  }
}

export async function setCachedReport(cacheKey, data, dataVersion, filters, provider, model, generationMs) {
  try {
    const db = getPool();
    const ttlHours = getCacheTTLHours(filters.reportType);
    const reportDataStr = JSON.stringify(data);

    await db.query(
      `INSERT INTO report_summary_cache
         (cache_key, data_version, report_data, report_type, school_filter, class_filter, subject_filter,
          date_range_start, date_range_end, ai_provider, ai_model, generation_ms, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
       ON DUPLICATE KEY UPDATE
         data_version = VALUES(data_version),
         report_data = VALUES(report_data),
         ai_provider = VALUES(ai_provider),
         ai_model = VALUES(ai_model),
         generation_ms = VALUES(generation_ms),
         expires_at = VALUES(expires_at),
         created_at = NOW()`,
      [
        cacheKey,
        dataVersion,
        reportDataStr,
        filters.reportType || "All Time",
        filters.school || "All Schools",
        filters.klass || "All Classes",
        filters.subject || "All Subjects",
        Array.isArray(filters.dateRange) ? filters.dateRange[0] : null,
        Array.isArray(filters.dateRange) ? filters.dateRange[1] : null,
        provider || "ollama",
        model || "mistral",
        generationMs || 0,
        ttlHours,
      ]
    );
  } catch (err) {
    console.error("[ReportCache] setCachedReport error:", err.message);
    // Non-fatal — report still returned to user even if cache write fails
  }
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS LOGGING
// ═══════════════════════════════════════════════════════════

export async function logAnalytics(entry) {
  try {
    const db = getPool();
    await db.query(
      `INSERT INTO report_analytics_log
         (cache_key, request_type, ai_provider, ai_model, generation_ms, estimated_tokens, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.cacheKey || null,
        entry.requestType,
        entry.aiProvider || null,
        entry.aiModel || null,
        entry.generationMs || 0,
        entry.estimatedTokens || 0,
        entry.errorMessage || null,
      ]
    );
  } catch (err) {
    console.error("[ReportAnalytics] logAnalytics error:", err.message);
  }
}

export async function getAnalyticsSummary() {
  try {
    const db = getPool();

    const [[totals]] = await db.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(CASE WHEN request_type = 'cache_hit' THEN 1 ELSE 0 END) as cache_hits,
        SUM(CASE WHEN request_type = 'cache_miss' THEN 1 ELSE 0 END) as cache_misses,
        SUM(CASE WHEN request_type = 'dedup' THEN 1 ELSE 0 END) as dedup_avoided,
        SUM(CASE WHEN request_type = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(CASE WHEN request_type = 'fallback' THEN 1 ELSE 0 END) as fallbacks,
        ROUND(AVG(CASE WHEN request_type = 'cache_miss' THEN generation_ms END)) as avg_generation_ms,
        SUM(CASE WHEN request_type = 'cache_hit' THEN estimated_tokens ELSE 0 END) as tokens_saved,
        SUM(CASE WHEN request_type = 'cache_miss' THEN estimated_tokens ELSE 0 END) as tokens_used
      FROM report_analytics_log
    `);

    const [recent] = await db.query(`
      SELECT request_type, ai_provider, ai_model, generation_ms, estimated_tokens, created_at
      FROM report_analytics_log
      ORDER BY created_at DESC
      LIMIT 20
    `);

    const cacheHitRate = totals.total_requests > 0
      ? Math.round(((totals.cache_hits + totals.dedup_avoided) / totals.total_requests) * 100)
      : 0;

    return {
      totalRequests: totals.total_requests || 0,
      cacheHits: totals.cache_hits || 0,
      cacheMisses: totals.cache_misses || 0,
      dedupAvoided: totals.dedup_avoided || 0,
      errors: totals.errors || 0,
      fallbacks: totals.fallbacks || 0,
      cacheHitRate,
      avgGenerationMs: totals.avg_generation_ms || 0,
      tokensSaved: totals.tokens_saved || 0,
      tokensUsed: totals.tokens_used || 0,
      aiCallsAvoided: (totals.cache_hits || 0) + (totals.dedup_avoided || 0),
      recentHistory: recent || [],
    };
  } catch (err) {
    console.error("[ReportAnalytics] getAnalyticsSummary error:", err.message);
    return {
      totalRequests: 0, cacheHits: 0, cacheMisses: 0, dedupAvoided: 0,
      errors: 0, fallbacks: 0, cacheHitRate: 0, avgGenerationMs: 0,
      tokensSaved: 0, tokensUsed: 0, aiCallsAvoided: 0, recentHistory: [],
    };
  }
}

// ═══════════════════════════════════════════════════════════
// AI PROVIDER ABSTRACTION
// Supports: ollama, gemini, openai
// ═══════════════════════════════════════════════════════════

function getAIConfig() {
  return {
    provider: (process.env.AI_PROVIDER || "ollama").toLowerCase(),
    model: process.env.AI_MODEL || "mistral",
    ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.0-flash",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiUrl: process.env.OPENAI_URL || "https://api.openai.com/v1",
    openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

async function callOllama(prompt, config) {
  const response = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model,
      prompt,
      stream: false,
      format: "json",
    }),
  });
  if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
  const result = await response.json();
  let text = result.response || "";
  text = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(text);
}

async function callGemini(prompt, config) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.3,
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
  const result = await response.json();
  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text.replace(/```json/gi, "").replace(/```/g, "").trim());
}

async function callOpenAI(prompt, config) {
  const response = await fetch(`${config.openaiUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.openaiModel,
      messages: [
        { role: "system", content: "You are an educational analytics AI. Respond only with valid JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI API error: ${response.status}`);
  const result = await response.json();
  const text = result?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text);
}

async function callAI(prompt, config) {
  switch (config.provider) {
    case "gemini": return callGemini(prompt, config);
    case "openai": return callOpenAI(prompt, config);
    case "ollama":
    default:       return callOllama(prompt, config);
  }
}

// ═══════════════════════════════════════════════════════════
// OPTIMIZED PROMPT BUILDER
// Sends only essential data — reduces tokens by ~60%
// ═══════════════════════════════════════════════════════════

function buildOptimizedPrompt({ school, klass, subject, reportType, dateRange, metrics, weakestTopics, strongestTopics }) {
  // Extract only key values from metrics
  const metricSummary = (metrics || [])
    .map((m) => `${m.label}: ${m.value}`)
    .join(", ");

  const strongest = (strongestTopics || [])
    .slice(0, 2)
    .map((t) => `${t.topic || t.subject} (${t.avg}%)`)
    .join(", ");

  const weakest = (weakestTopics || [])
    .slice(0, 2)
    .map((t) => `${t.topic || t.subject} (${t.avg}%)`)
    .join(", ");

  return `You are an expert district educational administrator AI assistant.
Write a formal executive summary (3 bullet points) and analytical insights (3 bullet points) for this school district report.

Scope: ${school || "All Schools"} | ${klass || "All Classes"} | ${subject || "All Subjects"}
Period: ${reportType} (${Array.isArray(dateRange) ? dateRange.join(" to ") : "All Time"})
Metrics: ${metricSummary}
Top Topics: ${strongest || "N/A"}
Weak Topics: ${weakest || "N/A"}

RULES:
1. Return ONLY valid JSON, no markdown.
2. JSON structure:
{"executiveSummary":["bullet1","bullet2","bullet3"],"aiAnalysis":["bullet1","bullet2","bullet3"],"projectStatus":"THRIVING|ON TRACK|AT RISK|CRITICAL","healthScore":0-100}`;
}

// ═══════════════════════════════════════════════════════════
// GENERATE WITH RETRY (max 2 retries)
// ═══════════════════════════════════════════════════════════

async function generateWithRetry(prompt, config, maxRetries = 2) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callAI(prompt, config);
    } catch (err) {
      lastError = err;
      console.warn(`[ReportAI] Attempt ${attempt + 1}/${maxRetries + 1} failed:`, err.message);
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s
        await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
      }
    }
  }
  throw lastError;
}

// ═══════════════════════════════════════════════════════════
// FALLBACK GENERATOR (when AI is completely unavailable)
// ═══════════════════════════════════════════════════════════

function generateFallback(filters) {
  const { metrics, weakestTopics, reportType, dateRange } = filters;

  const getVal = (lbl) => {
    const match = (metrics || []).find((m) =>
      m.label.toLowerCase().includes(lbl.toLowerCase())
    );
    if (!match) return 0;
    if (typeof match.value === "string")
      return Number(match.value.replace(/[^0-9.]/g, ""));
    return Number(match.value);
  };

  const totalStudents = getVal("total students");
  const averageScore = getVal("average");
  const attendanceRate = getVal("attendance");
  const engagementRate = getVal("engagement");

  const healthScore = Math.round(
    ((engagementRate || 70) + (averageScore || 65) + (attendanceRate || 75)) / 3
  );
  let projectStatus = "ON TRACK";
  if (healthScore >= 85) projectStatus = "THRIVING";
  else if (healthScore < 60) projectStatus = "AT RISK";

  return {
    executiveSummary: [
      `The ${(reportType || "").toLowerCase()} report from ${Array.isArray(dateRange) ? dateRange.join(" to ") : "the active window"} covers ${totalStudents.toLocaleString()} students.`,
      `Average quiz performance is ${averageScore}% and attendance is ${attendanceRate}% across the active timeline.`,
      `Overall participation and student engagement metrics indicate steady performance.`,
    ],
    aiAnalysis: [
      `AI server is currently offline. Operating in rule-based fallback mode.`,
      weakestTopics && weakestTopics.length > 0
        ? `Targeted revision recommended for ${weakestTopics[0].topic || weakestTopics[0].subject} to improve outcomes.`
        : "Review curriculum and chapter quiz metrics.",
      `Attendance compliance is at ${attendanceRate}%.`,
    ],
    projectStatus: `${projectStatus} (Fallback)`,
    healthScore,
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN ENTRY POINT — generateReportSummary
// Called by the controller. Handles cache, dedup, AI, fallback.
// ═══════════════════════════════════════════════════════════

export async function generateReport(filters) {
  const config = getAIConfig();
  const cacheKey = computeCacheKey(filters);
  const dataVersion = computeDataVersion(filters.metrics);
  const startTime = Date.now();

  // ── Step 1: Check cache ──────────────────────
  const cached = await getCachedReport(cacheKey, dataVersion);
  if (cached) {
    console.log("[ReportAI] Cache HIT for key:", cacheKey.slice(0, 12));
    await logAnalytics({
      cacheKey,
      requestType: "cache_hit",
      aiProvider: config.provider,
      aiModel: config.model,
      generationMs: Date.now() - startTime,
      estimatedTokens: 500, // estimated tokens saved
    });
    return { ...cached, fromCache: true, success: true };
  }

  // ── Step 2: Check in-flight dedup ────────────
  if (inFlightRequests.has(cacheKey)) {
    console.log("[ReportAI] DEDUP — joining existing request for:", cacheKey.slice(0, 12));
    await logAnalytics({
      cacheKey,
      requestType: "dedup",
      aiProvider: config.provider,
      aiModel: config.model,
      estimatedTokens: 500,
    });
    try {
      const result = await inFlightRequests.get(cacheKey);
      return { ...result, fromCache: true, success: true };
    } catch {
      // If the original request failed, fall through to generate fresh
    }
  }

  // ── Step 3: Generate fresh via AI ────────────
  const prompt = buildOptimizedPrompt(filters);
  const estimatedTokens = Math.ceil(prompt.length / 4); // rough token estimate

  const generationPromise = (async () => {
    try {
      const result = await generateWithRetry(prompt, config);
      const generationMs = Date.now() - startTime;

      // Store in cache
      await setCachedReport(cacheKey, result, dataVersion, filters, config.provider, config.model, generationMs);

      await logAnalytics({
        cacheKey,
        requestType: "cache_miss",
        aiProvider: config.provider,
        aiModel: config.model,
        generationMs,
        estimatedTokens,
      });

      console.log(`[ReportAI] Generated fresh report in ${generationMs}ms via ${config.provider}/${config.model}`);
      return { ...result, fromCache: false, success: true };
    } catch (err) {
      console.error("[ReportAI] All retries failed:", err.message);

      // Log the error
      await logAnalytics({
        cacheKey,
        requestType: "error",
        aiProvider: config.provider,
        aiModel: config.model,
        generationMs: Date.now() - startTime,
        errorMessage: err.message,
      });

      // Return fallback
      const fallback = generateFallback(filters);
      await logAnalytics({
        cacheKey,
        requestType: "fallback",
        aiProvider: "fallback",
        generationMs: Date.now() - startTime,
      });

      return { ...fallback, fromCache: false, success: false };
    } finally {
      // Clean up in-flight map
      inFlightRequests.delete(cacheKey);
    }
  })();

  // Register in-flight
  inFlightRequests.set(cacheKey, generationPromise);

  return generationPromise;
}
