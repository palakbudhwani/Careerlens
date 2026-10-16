import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

import './loadEnv.js';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';
const REQUEST_TIMEOUT_MS = 60_000;
// Per-attempt budget for the PRIMARY provider. The primary gets a much tighter
// deadline than the fallback: a stalled primary must hand over to the fallback
// after PRIMARY_TIMEOUT_MS instead of consuming the whole 60s budget before
// the fallback ever gets its turn. The fallback keeps REQUEST_TIMEOUT_MS so a
// slow-but-valid answer is still allowed to finish. Worst case chain is
// PRIMARY_TIMEOUT_MS + backoff + REQUEST_TIMEOUT_MS (~81s), well inside the
// frontend's own request deadline.
const PRIMARY_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_COMPLETION_TOKENS = 4096;
const MIN_MAX_COMPLETION_TOKENS = 256;
const PROVIDER_DETAIL_LIMIT = 160;

// Groq Structured Outputs strict mode is only supported by these models.
// Every other model falls back to response_format: json_object with the
// schema embedded in the system prompt (best effort).
const STRICT_OUTPUT_MODELS = new Set([
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'qwen/qwen3.8-27b'
]);

/**
 * Error carrying a client-safe HTTP status, code, and message.
 * server.js exposes these verbatim in its error middleware.
 */
export class AiProviderError extends Error {
  constructor(message, { statusCode = 502, code = 'AI_PROVIDER_ERROR' } = {}) {
    super(message);
    this.name = 'AiProviderError';
    this.statusCode = statusCode;
    this.code = code;
    this.expose = true;
  }
}

let warnedUnknownProvider = false;
let geminiClient = null;

function env(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Resolve the primary provider: 'groq' | 'gemini' | 'none'.
 * Explicit AI_PROVIDER wins; when unset, Gemini is preferred if its key
 * exists (Gemini is the primary provider), then Groq, otherwise AI is
 * treated as disabled (local fallbacks only).
 */
export function getAiProvider() {
  const raw = env('AI_PROVIDER').toLowerCase();
  if (raw === 'none') return 'none';
  if (raw === 'gemini') return 'gemini';
  if (raw === 'groq') return 'groq';
  if (raw && !warnedUnknownProvider) {
    warnedUnknownProvider = true;
    console.warn(`[aiProvider] Unknown AI_PROVIDER "${raw}". Use "gemini", "groq", or "none". Falling back to default selection.`);
  }
  if (env('GEMINI_API_KEY')) return 'gemini';
  if (env('GROQ_API_KEY')) return 'groq';
  return 'none';
}

let warnedFallbackConfig = false;

/**
 * Resolve the single fallback provider tried after an eligible primary
 * failure: 'groq' | 'gemini' | null.
 *
 * AI_FALLBACK_PROVIDER wins. When unset, the natural pairing applies
 * (Gemini primary -> Groq fallback, and vice versa). The fallback is
 * disabled (null) when it resolves to the primary itself — which prevents
 * retry loops — when it is 'none', or when it is unrecognized.
 */
export function getFallbackProvider() {
  const primary = getAiProvider();
  if (primary === 'none') return null;
  const raw = env('AI_FALLBACK_PROVIDER').toLowerCase();
  const resolved = raw
    ? raw
    : primary === 'gemini'
      ? 'groq'
      : primary === 'groq'
        ? 'gemini'
        : '';
  if (!raw && !warnedFallbackConfig) {
    warnedFallbackConfig = true;
    console.log(`[aiProvider] AI_FALLBACK_PROVIDER not set — defaulting to ${resolved} as the fallback for ${primary}.`);
  }
  if (resolved === 'none' || resolved === primary) return null;
  if (resolved !== 'gemini' && resolved !== 'groq') {
    if (!warnedFallbackConfig) {
      warnedFallbackConfig = true;
      console.warn(`[aiProvider] Unknown AI_FALLBACK_PROVIDER "${raw}". Use "gemini", "groq", or "none". Fallback disabled.`);
    }
    return null;
  }
  return resolved;
}

/** True when structured AI calls should be attempted instead of local fallbacks. */
export function isAiEnabled() {
  return getAiProvider() !== 'none';
}

function notConfiguredError(key) {
  return new AiProviderError(
    `AI provider is not configured: ${key} is missing in backend/.env. Add it, or set AI_PROVIDER=none to use local fallbacks.`,
    { statusCode: 503, code: 'AI_NOT_CONFIGURED' }
  );
}

function truncateDetail(message) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > PROVIDER_DETAIL_LIMIT ? `${text.slice(0, PROVIDER_DETAIL_LIMIT - 1)}…` : text;
}

/**
 * Clamp a task-specific completion-token budget to [256, 4096].
 * Callers pass explicit budgets derived from their response schema so small
 * tasks never request the full 4096-token allowance (which would inflate
 * output size against Groq's tokens-per-minute limit).
 */
export function clampMaxCompletionTokens(requested) {
  if (!Number.isFinite(requested)) return DEFAULT_MAX_COMPLETION_TOKENS;
  return Math.min(DEFAULT_MAX_COMPLETION_TOKENS, Math.max(MIN_MAX_COMPLETION_TOKENS, Math.round(requested)));
}

/**
 * Normalize prompt input: collapse PDF-extraction whitespace bloat and cap the
 * length so oversized resumes/job descriptions cannot blow up input tokens.
 */
export function clipForPrompt(value, maxChars) {
  const text = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!Number.isFinite(maxChars) || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n[content truncated for length]`;
}

function formatDuration(seconds) {
  if (seconds < 90) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  return `${Math.ceil(seconds / 60)} minutes`;
}

/**
 * Extract a safe retry-after hint from provider rate-limit headers.
 * Supports `retry-after` (seconds or HTTP date) and Groq's
 * `x-ratelimit-reset-tokens` / `x-ratelimit-reset-requests` (seconds or "Ns").
 * Returns { seconds, source } or null. Never includes request/response bodies.
 */
function parseRetryHint(response) {
  const headers = response?.headers;
  const read = (name) => {
    if (!headers) return '';
    if (typeof headers.get === 'function') return headers.get(name) || '';
    return headers[name] || '';
  };
  const candidates = [
    ['tokens', read('x-ratelimit-reset-tokens')],
    ['retry-after', read('retry-after')],
    ['requests', read('x-ratelimit-reset-requests')]
  ];
  for (const [source, rawValue] of candidates) {
    const raw = String(rawValue || '').trim();
    if (!raw) continue;
    if (/^\d+$/.test(raw)) return { seconds: Math.max(1, parseInt(raw, 10)), source };
    const suffix = raw.match(/^([\d.]+)\s*s$/i);
    if (suffix) return { seconds: Math.max(1, Math.ceil(parseFloat(suffix[1]))), source };
    const timestamp = Date.parse(raw);
    if (!Number.isNaN(timestamp)) {
      const delta = Math.ceil((timestamp - Date.now()) / 1000);
      if (delta > 0 && delta <= 3600) return { seconds: delta, source };
    }
  }
  return null;
}

function mapHttpError(status, detail, label, retryHint = null) {
  const suffix = detail ? ` Provider message: ${detail}` : '';
  if (status === 429) {
    const basis = retryHint?.source === 'tokens' ? ' (tokens-per-minute limit)' : '';
    const when = retryHint
      ? ` Retry in about ${formatDuration(retryHint.seconds)}.`
      : ' Try again in a moment.';
    const error = new AiProviderError(
      `The ${label} AI provider rate-limited the request${basis} (HTTP 429). No automatic retries are performed.${when}${suffix}`,
      { statusCode: 429, code: 'AI_RATE_LIMITED' }
    );
    // Parsed retry-after hint powers the provider cooldown below (never exposed
    // to clients — it only drives internal skip decisions).
    if (retryHint && Number.isFinite(retryHint.seconds)) error.retryAfterSeconds = retryHint.seconds;
    return error;
  }
  if (status === 401 || status === 403) {
    return new AiProviderError(
      `The ${label} AI provider rejected the configured credentials (HTTP ${status}). Check the API key in backend/.env.${suffix}`,
      { statusCode: 503, code: 'AI_UNAUTHORIZED' }
    );
  }
  if (status === 408 || status === 504) {
    return new AiProviderError(
      `The ${label} AI provider timed out (HTTP ${status}). Try again.${suffix}`,
      { statusCode: 504, code: 'AI_TIMEOUT' }
    );
  }
  if (status >= 500) {
    return new AiProviderError(
      `The ${label} AI provider is currently unavailable (HTTP ${status}). Try again shortly.${suffix}`,
      { statusCode: 502, code: 'AI_UPSTREAM_ERROR' }
    );
  }
  return new AiProviderError(
    `The ${label} AI provider rejected the request (HTTP ${status}).${suffix}`,
    { statusCode: 502, code: 'AI_BAD_REQUEST' }
  );
}

function mapNetworkError(error, label, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (error instanceof AiProviderError) return error;
  const name = error?.name || '';
  const message = error?.message || '';
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|abort/i.test(message)) {
    return new AiProviderError(
      `The ${label} AI provider did not respond within ${Math.round(timeoutMs / 1000)} seconds. Try again.`,
      { statusCode: 504, code: 'AI_TIMEOUT' }
    );
  }
  return new AiProviderError(
    `Could not reach the ${label} AI provider (network error). Check connectivity and try again.${message ? ` ${truncateDetail(message)}` : ''}`,
    { statusCode: 502, code: 'AI_UNREACHABLE' }
    );
}

/**
 * Map an SDK/network failure to a safe AiProviderError. When the SDK exposes
 * a real HTTP status (ApiError.status) it is authoritative, so HTTP 400s map
 * to AI_BAD_REQUEST and are never treated as transient. Message-based
 * classification only remains for plain errors without a status.
 */
function mapGeminiError(error) {
  if (error instanceof AiProviderError) return error;
  const message = error?.message || '';
  const detail = truncateDetail(message);
  const suffix = detail ? ` Provider message: ${detail}` : '';
  const status = Number.isInteger(error?.status)
    ? error.status
    : Number.isInteger(error?.statusCode)
      ? error.statusCode
      : NaN;

  if (Number.isFinite(status)) {
    if (status === 429) {
      return new AiProviderError(
        `The Gemini AI provider rate-limited the request (HTTP 429). No automatic retries are performed.${suffix}`,
        { statusCode: 429, code: 'AI_RATE_LIMITED' }
      );
    }
    if (status === 401 || status === 403) {
      return new AiProviderError(
        `The Gemini AI provider rejected the configured credentials (HTTP ${status}). Check GEMINI_API_KEY in backend/.env.${suffix}`,
        { statusCode: 503, code: 'AI_UNAUTHORIZED' }
      );
    }
    if (status === 408 || status === 504) {
      return new AiProviderError(
        `The Gemini AI provider timed out (HTTP ${status}). Try again.${suffix}`,
        { statusCode: 504, code: 'AI_TIMEOUT' }
      );
    }
    if (status >= 500) {
      return new AiProviderError(
        `The Gemini AI provider is currently unavailable (HTTP ${status}). Try again shortly.${suffix}`,
        { statusCode: 502, code: 'AI_UPSTREAM_ERROR' }
      );
    }
    return new AiProviderError(
      `The Gemini AI provider rejected the request (HTTP ${status}).${suffix}`,
      { statusCode: 502, code: 'AI_BAD_REQUEST' }
    );
  }

  const name = error?.name || '';
  if (name === 'TimeoutError' || name === 'AbortError' || /timeout|timed out|abort|ETIMEDOUT|deadline/i.test(message)) {
    return new AiProviderError(
      `The Gemini AI provider did not respond in time. Try again.${suffix}`,
      { statusCode: 504, code: 'AI_TIMEOUT' }
    );
  }
  if (name === 'TypeError' || /fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|network/i.test(message)) {
    return new AiProviderError(
      `Could not reach the Gemini AI provider (network error). Check connectivity and try again.${suffix}`,
      { statusCode: 502, code: 'AI_UNREACHABLE' }
    );
  }
  if (/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(message)) {
    return new AiProviderError(
      `The Gemini AI provider rate-limited the request. No automatic retries are performed — wait a moment and try again.${suffix}`,
      { statusCode: 429, code: 'AI_RATE_LIMITED' }
    );
  }
  if (/401|403|API.?key|UNAUTHENTICATED|PERMISSION_DENIED/i.test(message)) {
    return new AiProviderError(
      `The Gemini AI provider rejected the configured credentials. Check GEMINI_API_KEY in backend/.env.${suffix}`,
      { statusCode: 503, code: 'AI_UNAUTHORIZED' }
    );
  }
  if (/INVALID_ARGUMENT|BAD_REQUEST|\b400\b|\b404\b|\b422\b/.test(message)) {
    return new AiProviderError(
      `The Gemini AI provider rejected the request.${suffix}`,
      { statusCode: 502, code: 'AI_BAD_REQUEST' }
    );
  }
  return new AiProviderError(
    `The Gemini AI provider returned an error.${suffix}`,
    { statusCode: 502, code: 'AI_UPSTREAM_ERROR' }
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function schemaTypeOf(schema) {
  if (!schema || typeof schema !== 'object') return '';
  if (typeof schema.type === 'string') return schema.type.toLowerCase();
  if (schema.properties) return 'object';
  if (schema.items) return 'array';
  return '';
}

/** Convert Gemini-style uppercase OpenAPI types to standard lowercase JSON Schema. */
function toStandardSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toStandardSchema);
  if (!isPlainObject(schema)) return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'type' && typeof value === 'string') {
      out.type = value.toLowerCase();
    } else if (key === 'properties' && isPlainObject(value)) {
      out.properties = {};
      for (const [propKey, propSchema] of Object.entries(value)) {
        out.properties[propKey] = toStandardSchema(propSchema);
      }
    } else if (key === 'required' && Array.isArray(value)) {
      out.required = [...value];
    } else if (key === 'items') {
      out.items = toStandardSchema(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Groq strict structured outputs: all keys required, additionalProperties false. */
function toStrictSchema(schema) {
  const std = toStandardSchema(schema);
  const enforce = (node) => {
    if (!isPlainObject(node)) return node;
    if (node.type === 'object' && isPlainObject(node.properties)) {
      node.required = Object.keys(node.properties);
      node.additionalProperties = false;
      for (const propSchema of Object.values(node.properties)) enforce(propSchema);
    }
    if (node.items) enforce(node.items);
    return node;
  };
  return enforce(std);
}

function buildDefault(schema) {
  const type = schemaTypeOf(schema);
  if (type === 'object') {
    const out = {};
    for (const [key, propSchema] of Object.entries(schema?.properties || {})) {
      out[key] = buildDefault(propSchema);
    }
    return out;
  }
  if (type === 'array') return [];
  if (type === 'integer' || type === 'number') return 0;
  if (type === 'boolean') return false;
  if (type === 'string') return '';
  return null;
}

/**
 * Coerce a parsed AI payload to the shape described by the Gemini-style schema.
 * With fillDefaults (default true) missing/null fields become safe defaults;
 * with fillDefaults false missing fields stay missing so callers can fall back.
 */
function normalizeBySchema(value, schema, fillDefaults, path = '$') {
  const type = schemaTypeOf(schema);
  if (type === 'object') {
    if (!isPlainObject(value)) return fillDefaults ? buildDefault(schema) : undefined;
    const out = {};
    const properties = schema?.properties || {};
    for (const [key, propSchema] of Object.entries(properties)) {
      const raw = value[key];
      if (raw === undefined || raw === null) {
        if (fillDefaults) out[key] = buildDefault(propSchema);
        continue;
      }
      const normalized = normalizeBySchema(raw, propSchema, fillDefaults, `${path}.${key}`);
      if (normalized !== undefined) out[key] = normalized;
    }
    return out;
  }
  if (type === 'array') {
    if (!Array.isArray(value)) {
      if (!fillDefaults) return undefined;
      const singleType = schemaTypeOf(schema?.items);
      const isScalar = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
      if (isScalar && ['string', 'number', 'integer', 'boolean'].includes(singleType)) {
        return [normalizeBySchema(value, schema.items, true, `${path}[0]`)];
      }
      return [];
    }
    const itemSchema = schema?.items;
    if (!itemSchema) return [...value];
    const itemType = schemaTypeOf(itemSchema);
    const out = [];
    for (const item of value) {
      if (item === null || item === undefined) continue;
      if (itemType === 'object' && !isPlainObject(item)) continue;
      if (itemType === 'array' && !Array.isArray(item)) continue;
      const normalized = normalizeBySchema(item, itemSchema, fillDefaults, `${path}[]`);
      if (normalized !== undefined) out.push(normalized);
    }
    return out;
  }
  if (type === 'string') {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return fillDefaults ? '' : undefined;
  }
  if (type === 'integer' || type === 'number') {
    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return 0;
    return type === 'integer' ? Math.round(num) : num;
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    return false;
  }
  return value;
}

function parseJsonContent(content) {
  if (Array.isArray(content)) {
    content = content.map((part) => (typeof part === 'string' ? part : part?.text || '')).join('');
  }
  let text = typeof content === 'string' ? content.trim() : '';
  if (!text) {
    throw new AiProviderError('The AI provider returned an empty response.', {
      statusCode: 502,
      code: 'AI_EMPTY_RESPONSE'
    });
  }
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // fall through to the shared error below
      }
    }
    throw new AiProviderError('The AI provider returned malformed JSON.', {
      statusCode: 502,
      code: 'AI_INVALID_JSON'
    });
  }
}

function sanitizeSchemaName(name) {
  return String(name || 'response').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'response';
}

async function readProviderDetail(response) {
  try {
    const text = await response.text();
    try {
      const payload = JSON.parse(text);
      return truncateDetail(payload?.error?.message || payload?.message || text);
    } catch {
      return truncateDetail(text);
    }
  } catch {
    return '';
  }
}

async function callGroq({ prompt, systemInstruction, schema, schemaName, temperature, maxCompletionTokens, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const apiKey = env('GROQ_API_KEY');
  if (!apiKey) throw notConfiguredError('GROQ_API_KEY');
  const chatUrl = env('GROQ_API_URL') || GROQ_CHAT_URL;

  const model = env('GROQ_MODEL') || DEFAULT_GROQ_MODEL;
  const strict = STRICT_OUTPUT_MODELS.has(model);
  const standardSchema = toStandardSchema(schema);
  const systemContent = strict
    ? systemInstruction
    : `${systemInstruction}\n\nRespond with ONLY a single JSON object (no markdown fences, no commentary) that conforms to this JSON Schema:\n${JSON.stringify(standardSchema)}`;

  const body = {
    model,
    messages: [
      { role: 'system', content: systemContent },
      { role: 'user', content: prompt }
    ],
    temperature,
    max_completion_tokens: clampMaxCompletionTokens(maxCompletionTokens),
    response_format: strict
      ? {
          type: 'json_schema',
          json_schema: { name: sanitizeSchemaName(schemaName), strict: true, schema: toStrictSchema(standardSchema) }
        }
      : { type: 'json_object' }
  };

  let response;
  try {
    response = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw mapNetworkError(error, 'Groq', timeoutMs);
  }

  if (!response.ok) {
    const retryHint = response.status === 429 ? parseRetryHint(response) : null;
    const detail = await readProviderDetail(response);
    throw mapHttpError(response.status, detail, 'Groq', retryHint);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AiProviderError('The Groq AI provider returned an unreadable response.', {
      statusCode: 502,
      code: 'AI_INVALID_JSON'
    });
  }
  return parseJsonContent(payload?.choices?.[0]?.message?.content);
}

function getGeminiClient() {
  if (geminiClient) return geminiClient;
  const apiKey = env('GEMINI_API_KEY');
  if (!apiKey) throw notConfiguredError('GEMINI_API_KEY');
  try {
    geminiClient = new GoogleGenAI({ apiKey });
  } catch (error) {
    throw new AiProviderError(`Failed to initialize the Gemini client: ${truncateDetail(error?.message)}`, {
      statusCode: 503,
      code: 'AI_NOT_CONFIGURED'
    });
  }
  return geminiClient;
}

async function callGemini({ prompt, systemInstruction, schema, temperature, maxCompletionTokens, timeoutMs = REQUEST_TIMEOUT_MS }) {
  const client = getGeminiClient();
  const model = env('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL;
  let response;
  try {
    response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: { parts: [{ text: systemInstruction }] },
        responseMimeType: 'application/json',
        responseSchema: schema,
        temperature,
        maxOutputTokens: clampMaxCompletionTokens(maxCompletionTokens),
        // Same per-attempt budget as the Groq path (AbortSignal.timeout).
        // Without it a stalled Gemini request held the chain open until the
        // client's own deadline, so the fallback provider never got its turn.
        httpOptions: { timeout: timeoutMs }
      }
    });
  } catch (error) {
    throw mapGeminiError(error);
  }
  return parseJsonContent(response?.text);
}

/**
 * Failure codes that mean the request itself was unavailable or the generated
 * output was unusable: rate limits, transient upstream/network/timeout
 * failures, and identifiable JSON/schema validation problems.
 *
 * This set gates the LOCAL deterministic takeover only (localFallbackEligible
 * on the exhaustion error, consulted by runAiTask): a formula may replace AI
 * only when both providers failed for these availability/generation reasons —
 * never for credential or configuration errors, which must surface as errors
 * so a misconfiguration can never masquerade as an AI result.
 */
const ELIGIBLE_FALLBACK_CODES = new Set([
  'AI_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_UPSTREAM_ERROR',
  'AI_UNREACHABLE',
  'AI_INVALID_JSON',
  'AI_EMPTY_RESPONSE',
  'AI_SCHEMA_MISMATCH'
]);

/**
 * Provider-specific rejection codes. They say the *primary* endpoint refused
 * the request — a bad primary API key, a missing key, or an HTTP 400/404 the
 * primary model produced (wrong model name, provider-side schema rejection).
 * They reveal nothing about the fallback provider, which is a different
 * endpoint with its own key, model, and request format — so a single attempt
 * there is the entire point of the fallback. These codes NEVER authorize a
 * local rule-based takeover (see ELIGIBLE_FALLBACK_CODES above).
 */
const PROVIDER_SPECIFIC_CODES = new Set([
  'AI_UNAUTHORIZED',
  'AI_NOT_CONFIGURED',
  'AI_BAD_REQUEST'
]);

/** True when a deterministic local result may replace the AI answer. */
export function isEligibleForFallback(error) {
  return Boolean(error) && ELIGIBLE_FALLBACK_CODES.has(error.code);
}

/**
 * True when a primary failure is worth exactly one attempt on the fallback
 * provider: availability/generation failures plus provider-specific
 * rejections (bad primary key, missing key, primary-only HTTP 400/404).
 */
export function canTryFallbackProvider(error) {
  return Boolean(error) &&
    (ELIGIBLE_FALLBACK_CODES.has(error.code) || PROVIDER_SPECIFIC_CODES.has(error.code));
}

const PROVIDER_LABELS = { gemini: 'Gemini', groq: 'Groq' };

function logOutcome(task, { primary, fallback, usedFallback, finalProvider, error, elapsedMs }) {
  // Duration only — never prompt, answer, or provider response content, so a
  // log line can always be printed safely during manual testing.
  const duration = Number.isFinite(elapsedMs) ? ` in ${elapsedMs}ms` : '';
  const fallbackLabel = fallback || 'none';
  if (error) {
    console.warn(
      `[aiProvider] task=${task} primary=${primary} fallback=${fallbackLabel} used_fallback=${usedFallback} outcome=error code=${error.code} status=${error.statusCode}${duration}`
    );
    return;
  }
  console.log(
    `[aiProvider] task=${task} primary=${primary} fallback=${fallbackLabel} used_fallback=${usedFallback} served_by=${finalProvider} outcome=ok${duration}`
  );
}

// Identical concurrent structured calls (e.g. StrictMode double-mounts or
// duplicate submissions) share one upstream request. Keyed on a hash of the
// full request so unrelated calls never coalesce.
const inFlightCalls = new Map();

// ---------------------------------------------------------------------------
// Result cache (deterministic dedup of identical successful calls)
// ---------------------------------------------------------------------------
// Successful structured results are served from memory for
// AI_RESULT_CACHE_TTL_MS (default 5 minutes; 0 disables the cache), so page
// remounts and duplicate submissions never re-hit a provider. Failures are
// never cached. Every entry remembers which provider produced it, so the
// `source` label stays truthful on cache hits. FIFO eviction above
// AI_RESULT_CACHE_MAX (default 100).
const DEFAULT_RESULT_CACHE_TTL_MS = 300_000;
const DEFAULT_RESULT_CACHE_MAX = 100;
const resultCache = new Map(); // callKey -> { data, provider, expires }

function positiveEnvNumber(name, fallback, min = 0) {
  const raw = env(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) return fallback;
  return value;
}

/** Test hook: drop all cached provider results. */
export function clearAiResultCache() {
  resultCache.clear();
}

function readCachedResult(callKey) {
  const entry = resultCache.get(callKey);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    resultCache.delete(callKey);
    return null;
  }
  return entry;
}

function storeCachedResult(callKey, data, provider) {
  const ttl = positiveEnvNumber('AI_RESULT_CACHE_TTL_MS', DEFAULT_RESULT_CACHE_TTL_MS);
  if (ttl <= 0) return;
  const max = Math.max(1, positiveEnvNumber('AI_RESULT_CACHE_MAX', DEFAULT_RESULT_CACHE_MAX, 1));
  if (resultCache.size >= max) {
    const oldest = resultCache.keys().next().value;
    if (oldest !== undefined) resultCache.delete(oldest);
  }
  resultCache.set(callKey, { data, provider, expires: Date.now() + ttl });
}

// ---------------------------------------------------------------------------
// Provider cooldowns (hint-based; consulted only when a fallback exists)
// ---------------------------------------------------------------------------
// A 429 that carries a parsed retry-after hint marks that provider as cooling
// down. While cooling, the layer skips it and moves to the other provider
// instead of burning a guaranteed-failing request; if the *fallback* is
// cooling, a synthetic AI_RATE_LIMITED failure is reported without any
// provider call. Cooldowns are only ever set or read when a fallback is
// configured, so single-provider setups keep their exact previous behavior.
const providerCooldowns = new Map(); // provider -> expiry (epoch ms)

/** Test hook: forget all provider cooldowns. */
export function clearProviderCooldowns() {
  providerCooldowns.clear();
}

function isCoolingDown(provider) {
  const expires = providerCooldowns.get(provider);
  if (!expires) return false;
  if (expires <= Date.now()) {
    providerCooldowns.delete(provider);
    return false;
  }
  return true;
}

function noteProviderCooldown(provider, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const ttlMs = Math.min(seconds * 1000, 60 * 60 * 1000);
  const current = providerCooldowns.get(provider) || 0;
  providerCooldowns.set(provider, Math.max(current, Date.now() + ttlMs));
}

function cooldownError(provider) {
  const expires = providerCooldowns.get(provider) || Date.now();
  const remaining = Math.max(1, Math.ceil((expires - Date.now()) / 1000));
  return new AiProviderError(
    `${PROVIDER_LABELS[provider]} is cooling down after an earlier rate limit (about ${remaining}s remaining). ` +
      'No request was sent to it this time.',
    { statusCode: 429, code: 'AI_RATE_LIMITED' }
  );
}

// ---------------------------------------------------------------------------
// Bounded jittered backoff before the fallback attempt
// ---------------------------------------------------------------------------
// Only transient availability failures wait (rate limit, timeout, upstream,
// unreachable); generated-output problems (AI_INVALID_JSON, AI_EMPTY_RESPONSE,
// AI_SCHEMA_MISMATCH) retry immediately. Base delay comes from
// AI_FALLBACK_BACKOFF_MS (default 200ms, 0 disables — tests set it to 0) and
// is capped by AI_FALLBACK_BACKOFF_MAX_MS (default 1500ms).
const TRANSIENT_BACKOFF_CODES = new Set([
  'AI_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_UPSTREAM_ERROR',
  'AI_UNREACHABLE'
]);
const DEFAULT_BACKOFF_BASE_MS = 200;
const DEFAULT_BACKOFF_MAX_MS = 1500;

/**
 * Jittered backoff in [0.5 * base, base], capped at max.
 * `random` is injectable so tests are deterministic; returns 0 when base <= 0.
 */
export function computeFallbackBackoffMs(base, max, random = Math.random) {
  const baseMs = Number.isFinite(base) && base > 0 ? base : 0;
  if (baseMs === 0) return 0;
  const cap = Number.isFinite(max) && max > baseMs ? max : baseMs;
  const jitter = Math.min(1, Math.max(0, Number(random()) || 0));
  return Math.min(cap, Math.round(baseMs * (0.5 + 0.5 * jitter)));
}

function fallbackBackoffDelayMs(primaryCode) {
  if (!TRANSIENT_BACKOFF_CODES.has(primaryCode)) return 0;
  const base = positiveEnvNumber('AI_FALLBACK_BACKOFF_MS', DEFAULT_BACKOFF_BASE_MS);
  const max = positiveEnvNumber('AI_FALLBACK_BACKOFF_MAX_MS', DEFAULT_BACKOFF_MAX_MS);
  return computeFallbackBackoffMs(base, max);
}

// ---------------------------------------------------------------------------
// Provider concurrency cap (AI_MAX_CONCURRENT_PROVIDER_CALLS, default 4)
// ---------------------------------------------------------------------------
// Serializes the actual provider HTTP calls so a burst of feature requests can
// never open an unbounded number of simultaneous upstream connections. The
// slot is handed directly to the next queued caller on release.
let activeProviderCalls = 0;
const providerSlotQueue = [];

function acquireProviderSlot() {
  const max = Math.max(1, positiveEnvNumber('AI_MAX_CONCURRENT_PROVIDER_CALLS', 4, 1));
  if (activeProviderCalls < max) {
    activeProviderCalls += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => providerSlotQueue.push(resolve));
}

function releaseProviderSlot() {
  const next = providerSlotQueue.shift();
  if (next) next();
  else activeProviderCalls -= 1;
}

async function withProviderSlot(run) {
  await acquireProviderSlot();
  try {
    return await run();
  } finally {
    releaseProviderSlot();
  }
}

/**
 * Call the primary AI provider (Gemini) and, on a retry-worthy failure, the
 * configured fallback (Groq) exactly once. Retry-worthy means availability or
 * generated-output failures (rate limit, timeout, upstream/network, invalid
 * JSON, empty response, schema mismatch) PLUS primary-side rejections
 * (AI_UNAUTHORIZED / AI_NOT_CONFIGURED / AI_BAD_REQUEST) — those only condemn
 * the primary endpoint, and the fallback uses its own key, model, and request
 * format. Returns a schema-normalized JSON object. Throws AiProviderError
 * (safe status/message) on any failure — never mock data when AI is
 * configured. Both-fail outcomes are reported as a single structured
 * AI_PROVIDERS_EXHAUSTED error naming each provider's safe error code.
 * `maxCompletionTokens` is an optional task-specific output budget,
 * clamped to [256, 4096] before being sent to the provider.
 * `onSource` is an optional callback invoked with the provider that served
 * the result ('gemini' | 'groq') — on success, cache hit, or coalesced call —
 * so task layers can attach an honest `source` label.
 * The failure error carries `localFallbackEligible: true` (plus
 * `primaryCode`/`fallbackCode`) only when BOTH providers failed with
 * availability/generation errors (isEligibleForFallback), which lets
 * runAiTask (ruleBasedFallback.js) serve a deterministic local result instead
 * of an error. Credential and configuration failures never authorize that
 * takeover — they keep propagating as errors.
 */
export async function generateStructured({
  prompt,
  systemInstruction,
  schema,
  schemaName = 'response',
  temperature = 0.2,
  fillDefaults = true,
  maxCompletionTokens,
  onSource
}) {
  const primary = getAiProvider();
  if (primary === 'none') {
    throw new AiProviderError('AI provider is disabled (AI_PROVIDER=none).', {
      statusCode: 503,
      code: 'AI_DISABLED'
    });
  }
  const fallback = getFallbackProvider();

  const tokens = clampMaxCompletionTokens(maxCompletionTokens);
  const callKey = createHash('sha256')
    .update([primary, fallback, schemaName, tokens, temperature, fillDefaults, JSON.stringify(schema), systemInstruction, prompt].join(String.fromCharCode(0)))
    .digest('hex');

  const cached = readCachedResult(callKey);
  if (cached) {
    console.log(`[aiProvider] task=${schemaName} served_from=cache provider=${cached.provider}`);
    if (typeof onSource === 'function') onSource(cached.provider);
    return structuredClone(cached.data);
  }

  const existing = inFlightCalls.get(callKey);
  if (existing) {
    const { data, provider: served } = await existing;
    if (typeof onSource === 'function') onSource(served);
    return structuredClone(data);
  }

  const work = (async () => {
    const chainStart = Date.now();
    // The primary attempt runs on the tight fail-fast budget; the fallback
    // attempt gets the full per-attempt budget.
    const timeoutMsFor = (provider) => (provider === primary ? PRIMARY_TIMEOUT_MS : REQUEST_TIMEOUT_MS);
    const callOne = async (provider) => {
      const attemptStart = Date.now();
      try {
        const raw =
          provider === 'gemini'
            ? await callGemini({ prompt, systemInstruction, schema, temperature, maxCompletionTokens: tokens, timeoutMs: timeoutMsFor(provider) })
            : await callGroq({ prompt, systemInstruction, schema, schemaName, temperature, maxCompletionTokens: tokens, timeoutMs: timeoutMsFor(provider) });

        if (!isPlainObject(raw)) {
          throw new AiProviderError('The AI provider returned a JSON payload that is not an object.', {
            statusCode: 502,
            code: 'AI_INVALID_JSON'
          });
        }
        const normalized = normalizeBySchema(raw, schema, fillDefaults);
        if (normalized === undefined) {
          throw new AiProviderError('The AI provider output failed schema validation.', {
            statusCode: 502,
            code: 'AI_SCHEMA_MISMATCH'
          });
        }
        console.log(`[aiProvider] task=${schemaName} provider=${provider} attempt=ok in ${Date.now() - attemptStart}ms`);
        return normalized;
      } catch (error) {
        // Code/name only: attempt diagnostics must never carry request or
        // response content.
        console.log(
          `[aiProvider] task=${schemaName} provider=${provider} attempt=error in ${Date.now() - attemptStart}ms code=${error?.code || error?.name || 'unknown'}`
        );
        throw error;
      }
    };
    const callProvider = (provider) => withProviderSlot(() => callOne(provider));

    let primaryError;
    if (fallback && isCoolingDown(primary)) {
      primaryError = cooldownError(primary);
      console.log(
        `[aiProvider] task=${schemaName} primary=${primary} cooling down (${primaryError.code}); skipping straight to fallback ${fallback}`
      );
    } else {
      try {
        const result = await callProvider(primary);
        logOutcome(schemaName, { primary, fallback, usedFallback: false, finalProvider: primary, elapsedMs: Date.now() - chainStart });
        return { data: result, provider: primary };
      } catch (error) {
        primaryError =
          error instanceof AiProviderError
            ? error
            : primary === 'groq'
              ? mapNetworkError(error, 'Groq', timeoutMsFor(primary))
              : mapGeminiError(error);
      }
    }

    if (!fallback || !canTryFallbackProvider(primaryError)) {
      logOutcome(schemaName, { primary, fallback, usedFallback: false, error: primaryError, elapsedMs: Date.now() - chainStart });
      throw primaryError;
    }
    console.log(
      `[aiProvider] task=${schemaName} primary=${primary} failed with ${primaryError.code}; trying fallback ${fallback} once`
    );
    if (primaryError.code === 'AI_RATE_LIMITED' && Number.isFinite(primaryError.retryAfterSeconds)) {
      noteProviderCooldown(primary, primaryError.retryAfterSeconds);
    }

    const backoffMs = fallbackBackoffDelayMs(primaryError.code);
    if (backoffMs > 0) {
      console.log(`[aiProvider] task=${schemaName} waiting ${backoffMs}ms before the fallback attempt`);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }

    let fallbackError;
    if (fallback && isCoolingDown(fallback)) {
      fallbackError = cooldownError(fallback);
      console.log(
        `[aiProvider] task=${schemaName} fallback=${fallback} cooling down (${fallbackError.code}); no request sent`
      );
    } else {
      try {
        const result = await callProvider(fallback);
        logOutcome(schemaName, { primary, fallback, usedFallback: true, finalProvider: fallback, elapsedMs: Date.now() - chainStart });
        return { data: result, provider: fallback };
      } catch (error) {
        fallbackError =
          error instanceof AiProviderError
            ? error
            : fallback === 'groq'
              ? mapNetworkError(error, 'Groq', timeoutMsFor(fallback))
              : mapGeminiError(error);
        if (fallbackError.code === 'AI_RATE_LIMITED' && Number.isFinite(fallbackError.retryAfterSeconds)) {
          noteProviderCooldown(fallback, fallbackError.retryAfterSeconds);
        }
      }
    }

    const statusCode =
      primaryError.statusCode === 429 || fallbackError.statusCode === 429
        ? 429
        : fallbackError.statusCode || 502;
    const exhausted = new AiProviderError(
      `Both AI providers failed for this request. ` +
        `${PROVIDER_LABELS[primary]} (${primaryError.code}): ${primaryError.message} ` +
        `${PROVIDER_LABELS[fallback]} (${fallbackError.code}): ${fallbackError.message}`,
      { statusCode, code: 'AI_PROVIDERS_EXHAUSTED' }
    );
    exhausted.primaryCode = primaryError.code;
    exhausted.fallbackCode = fallbackError.code;
    // Both sides failed on availability/generation grounds → a deterministic
    // local result may take over in the task layer. Credential, config, and
    // invalid-request failures keep propagating as errors.
    exhausted.localFallbackEligible =
      isEligibleForFallback(primaryError) && isEligibleForFallback(fallbackError);
    logOutcome(schemaName, { primary, fallback, usedFallback: true, error: exhausted, elapsedMs: Date.now() - chainStart });
    throw exhausted;
  })();

  inFlightCalls.set(callKey, work);
  try {
    const { data, provider: served } = await work;
    storeCachedResult(callKey, data, served);
    if (typeof onSource === 'function') onSource(served);
    return structuredClone(data);
  } finally {
    inFlightCalls.delete(callKey);
  }
}

const activeProvider = getAiProvider();
const activeFallback = getFallbackProvider();
if (activeProvider === 'none') {
  console.log('AI provider: none — local fallback mode (set GEMINI_API_KEY or GROQ_API_KEY in backend/.env to enable AI).');
} else {
  const primaryLabel = `${PROVIDER_LABELS[activeProvider]} (model: ${activeProvider === 'gemini' ? env('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL : env('GROQ_MODEL') || DEFAULT_GROQ_MODEL})`;
  const fallbackLabel = activeFallback
    ? `${PROVIDER_LABELS[activeFallback]} (model: ${activeFallback === 'gemini' ? env('GEMINI_MODEL') || DEFAULT_GEMINI_MODEL : env('GROQ_MODEL') || DEFAULT_GROQ_MODEL})`
    : 'disabled';
  console.log(`AI provider: ${primaryLabel} primary; fallback: ${fallbackLabel}.`);
}
