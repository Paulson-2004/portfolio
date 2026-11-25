import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

export const AUTHORITATIVE_RESUME_ID = '01a212bc-0b8d-72a3-aa40-dd750c244798';
export const FORBIDDEN_PRIMARY_RESUME_ID = '01a2129f-8069-714f-bf9b-b2e2410b7f26';
export const DEFAULT_API_BASE_URL = 'https://rxresu.me/api/openapi';

export const REL_PATHS = Object.freeze({
  pdf: 'docs/Paulson_J_Resume.pdf',
  webp: 'img/resume-preview.webp',
  jpg: 'img/resume-preview.jpg',
  manifest: '.github/resume-sync/manifest.json',
  indexHtml: 'index.html',
});

const DEFAULT_TIMEOUTS = Object.freeze({
  metaMs: 20_000,
  pdfMs: 60_000,
  pdftoppmMs: 30_000,
});

const PDF_LIMITS = Object.freeze({
  minBytes: 10_000,
  maxBytes: 5 * 1024 * 1024,
  minPages: 1,
  maxPages: 4,
  minExtractedChars: 300,
});

const PREVIEW_LIMITS = Object.freeze({
  targetWidth: 1440,
  minHeight: 1000,
  maxHeight: 3200,
  minBytes: 15_000,
  maxBytes: 2 * 1024 * 1024,
  minChannelStdDev: 10,
  minInkPixelRatio: 0.02,
});

const FORBIDDEN_SECRET_PATTERNS = [
  /x-api-key/i,
  /REACTIVE_RESUME_API_KEY/i,
  /PORTFOLIO_PUSH_TOKEN/i,
  /CLOUDFLARE_DEPLOY_HOOK_URL/i,
  /better-auth\.session_token/i,
  /\bgh[pous]_[A-Za-z0-9_]{16,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\b(?:bearer\s+)[A-Za-z0-9._-]{20,}\b/i,
];

const RESUME_SECTION_RE = /\b(?:experience|projects|skills|education|certifications|summary)\b/i;
const OWNER_NAME_RE = /\bPaulson\s+J\b/i;

export class SyncError extends Error {
  constructor(category, message, { retryable = false, status = null, cause = null } = {}) {
    super(message);
    this.name = 'SyncError';
    this.category = category;
    this.retryable = retryable;
    this.status = status;
    if (cause) this.cause = cause;
  }
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function sanitizeText(value, secrets = []) {
  let out = String(value ?? '');
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.trim().length >= 4) {
      out = out.split(secret).join('[REDACTED]');
    }
  }
  out = out.replace(/(https?:\/\/[^\s/?#]+\/[^\s?#]*)\?[^\s#)]*/gi, '$1?[REDACTED]');
  return out;
}

export function assertSafeResumeId(resumeId) {
  const normalized = String(resumeId ?? '').trim();
  if (!normalized) {
    throw new SyncError('CONFIG_ERROR', 'Missing Reactive Resume ID.');
  }
  if (normalized === FORBIDDEN_PRIMARY_RESUME_ID) {
    throw new SyncError(
      'SAFETY_VIOLATION',
      `Refusing to target forbidden primary Reactive Resume ID (${FORBIDDEN_PRIMARY_RESUME_ID}).`,
    );
  }
  if (normalized !== AUTHORITATIVE_RESUME_ID) {
    throw new SyncError(
      'SAFETY_VIOLATION',
      `Refusing to target non-authoritative Reactive Resume ID "${normalized}". Expected "${AUTHORITATIVE_RESUME_ID}".`,
    );
  }
  return normalized;
}

export function assertSafeBaseUrl(baseUrl) {
  const raw = String(baseUrl ?? DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '');
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new SyncError('CONFIG_ERROR', 'Invalid Reactive Resume API base URL.');
  }
  const isLoopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && isLoopback)) {
    throw new SyncError('CONFIG_ERROR', `Refusing insecure API protocol "${parsed.protocol}" for host "${parsed.hostname}".`);
  }
  return parsed.toString().replace(/\/+$/, '');
}

export function canonicalizeValue(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    const val = value[key];
    if (val !== undefined) {
      sorted[key] = canonicalizeValue(val);
    }
  }
  return sorted;
}

export function computeContentHash(resumePayload) {
  const canonicalPayload = canonicalizeValue({
    id: resumePayload.id,
    name: resumePayload.name ?? '',
    data: resumePayload.data ?? {},
  });
  return `sha256:${sha256Buffer(Buffer.from(JSON.stringify(canonicalPayload), 'utf8'))}`;
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerVal) {
  if (!headerVal) return null;
  const seconds = Number(headerVal);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 30_000);
  }
  const timestamp = Date.parse(headerVal);
  if (!Number.isNaN(timestamp)) {
    return Math.min(Math.max(0, timestamp - Date.now()), 30_000);
  }
  return null;
}

export async function fetchWithRetry({
  url,
  headers = {},
  responseType = 'json',
  timeoutMs = DEFAULT_TIMEOUTS.metaMs,
  maxAttempts = 4,
  retryBaseMs = 1500,
  fetchImpl = globalThis.fetch,
  sleepImpl = defaultSleep,
  randomImpl = Math.random,
  secrets = [],
}) {
  if (typeof fetchImpl !== 'function') {
    throw new SyncError('CONFIG_ERROR', 'Fetch implementation is unavailable.');
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'paulsonj-portfolio-resume-sync/1.0',
          ...headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const isAbort = err?.name === 'AbortError' || err?.name === 'TimeoutError';
      lastErr = new SyncError(
        isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        sanitizeText(
          isAbort ? `Request timed out after ${timeoutMs}ms` : `Network request failed: ${err?.message || 'unknown error'}`,
          secrets,
        ),
        { retryable: true, cause: err },
      );
      if (attempt < maxAttempts) {
        const delayMs = Math.round(retryBaseMs * (2 ** (attempt - 1)) + randomImpl() * 400);
        await sleepImpl(delayMs);
        continue;
      }
      throw lastErr;
    }

    const status = response.status;
    if (status === 401 || status === 403) {
      throw new SyncError(
        'AUTH_ERROR',
        `Reactive Resume rejected API authentication (HTTP ${status}). Verify REACTIVE_RESUME_API_KEY.`,
        { retryable: false, status },
      );
    }
    if (status === 404) {
      throw new SyncError(
        'NOT_FOUND',
        `Reactive Resume resource not found (HTTP 404).`,
        { retryable: false, status },
      );
    }
    if (status === 400) {
      throw new SyncError('BAD_REQUEST', 'Reactive Resume rejected the request (HTTP 400).', {
        retryable: false,
        status,
      });
    }
    if (status === 408 || status === 429 || (status >= 500 && status <= 599)) {
      const category = status === 429 ? 'RATE_LIMIT' : 'UPSTREAM_ERROR';
      lastErr = new SyncError(category, `Reactive Resume temporary error (HTTP ${status}).`, {
        retryable: true,
        status,
      });
      if (attempt < maxAttempts) {
        const retryAfterMs = status === 429 ? parseRetryAfterMs(response.headers?.get?.('retry-after')) : null;
        const backoffMs = retryAfterMs ?? Math.round(retryBaseMs * (2 ** (attempt - 1)) + randomImpl() * 500);
        await sleepImpl(backoffMs);
        continue;
      }
      throw lastErr;
    }
    if (!response.ok) {
      throw new SyncError('UPSTREAM_ERROR', `Reactive Resume returned unexpected HTTP ${status}.`, {
        retryable: false,
        status,
      });
    }

    const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
    if (responseType === 'json') {
      if (contentType && !contentType.includes('application/json')) {
        throw new SyncError('INVALID_RESPONSE', `Expected JSON response but received "${contentType}".`);
      }
      try {
        return await response.json();
      } catch (err) {
        throw new SyncError('INVALID_RESPONSE', `Failed to parse JSON metadata: ${sanitizeText(err?.message, secrets)}`, {
          cause: err,
        });
      }
    }

    if (contentType && (contentType.includes('text/html') || contentType.includes('application/json'))) {
      throw new SyncError('INVALID_PDF', `Expected PDF binary but received content-type "${contentType}".`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  throw lastErr || new SyncError('UPSTREAM_ERROR', 'Exhausted retry attempts.');
}

function normalizeIsoTimestamp(rawValue) {
  if (!rawValue) return null;
  const parsed = Date.parse(rawValue);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export async function fetchAuthoritativeResumeMeta({
  baseUrl = DEFAULT_API_BASE_URL,
  resumeId = AUTHORITATIVE_RESUME_ID,
  apiKey,
  fetchImpl = globalThis.fetch,
  sleepImpl = defaultSleep,
  randomImpl = Math.random,
  timeoutMs = DEFAULT_TIMEOUTS.metaMs,
  maxAttempts = 4,
  retryBaseMs = 1500,
}) {
  const safeId = assertSafeResumeId(resumeId);
  const safeBaseUrl = assertSafeBaseUrl(baseUrl);
  if (!apiKey || !String(apiKey).trim()) {
    throw new SyncError('CONFIG_ERROR', 'Missing REACTIVE_RESUME_API_KEY credential.');
  }
  const cleanKey = String(apiKey).trim();
  const secrets = [cleanKey];

  const payload = await fetchWithRetry({
    url: `${safeBaseUrl}/resumes/${encodeURIComponent(safeId)}`,
    headers: { 'x-api-key': cleanKey, Accept: 'application/json' },
    responseType: 'json',
    timeoutMs,
    maxAttempts,
    retryBaseMs,
    fetchImpl,
    sleepImpl,
    randomImpl,
    secrets,
  });

  if (!payload || typeof payload !== 'object' || payload.id !== safeId) {
    throw new SyncError('INVALID_RESPONSE', 'Fetched resume payload ID does not match authoritative target ID.');
  }
  const basicsName = String(payload?.data?.basics?.name || '').trim();
  if (!basicsName) {
    throw new SyncError('INVALID_RESPONSE', 'Fetched resume payload is missing basics.name.');
  }

  let updatedAt = normalizeIsoTimestamp(payload.updatedAt);
  if (!updatedAt) {
    // Fallback to list summary if single-resume endpoint omits updatedAt on an instance version.
    const listPayload = await fetchWithRetry({
      url: `${safeBaseUrl}/resumes`,
      headers: { 'x-api-key': cleanKey, Accept: 'application/json' },
      responseType: 'json',
      timeoutMs,
      maxAttempts,
      retryBaseMs,
      fetchImpl,
      sleepImpl,
      randomImpl,
      secrets,
    });
    if (Array.isArray(listPayload)) {
      const matched = listPayload.find((entry) => entry && entry.id === safeId);
      updatedAt = normalizeIsoTimestamp(matched?.updatedAt);
    }
  }
  if (!updatedAt) {
    throw new SyncError('INVALID_RESPONSE', 'Reactive Resume API did not provide a valid updatedAt timestamp.');
  }

  return {
    resumeId: safeId,
    resumeName: String(payload.name || 'Paulson J - Portfolio Proposed (2026)'),
    updatedAt,
    contentHash: computeContentHash(payload),
    ownerName: basicsName,
    isPublic: Boolean(payload.isPublic),
    isLocked: Boolean(payload.isLocked),
  };
}

export async function downloadAuthoritativePdf({
  baseUrl = DEFAULT_API_BASE_URL,
  resumeId = AUTHORITATIVE_RESUME_ID,
  apiKey,
  fetchImpl = globalThis.fetch,
  sleepImpl = defaultSleep,
  randomImpl = Math.random,
  timeoutMs = DEFAULT_TIMEOUTS.pdfMs,
  maxAttempts = 4,
  retryBaseMs = 2000,
}) {
  const safeId = assertSafeResumeId(resumeId);
  const safeBaseUrl = assertSafeBaseUrl(baseUrl);
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) {
    throw new SyncError('CONFIG_ERROR', 'Missing REACTIVE_RESUME_API_KEY credential.');
  }
  return fetchWithRetry({
    url: `${safeBaseUrl}/resumes/${encodeURIComponent(safeId)}/pdf`,
    headers: { 'x-api-key': cleanKey, Accept: 'application/pdf' },
    responseType: 'buffer',
    timeoutMs,
    maxAttempts,
    retryBaseMs,
    fetchImpl,
    sleepImpl,
    randomImpl,
    secrets: [cleanKey],
  });
}

let cachedPdfjs = null;
async function loadPdfjs() {
  if (!cachedPdfjs) {
    cachedPdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return cachedPdfjs;
}

const requireFromHere = createRequire(import.meta.url);
function loadSharp() {
  return requireFromHere('sharp');
}

export async function validatePdfBuffer(pdfBuffer, expectedMeta = {}) {
  if (!Buffer.isBuffer(pdfBuffer)) {
    throw new SyncError('INVALID_PDF', 'PDF artifact is not a valid Buffer.');
  }
  if (pdfBuffer.length < PDF_LIMITS.minBytes || pdfBuffer.length > PDF_LIMITS.maxBytes) {
    throw new SyncError(
      'INVALID_PDF',
      `PDF size ${pdfBuffer.length} bytes is outside valid bounds (${PDF_LIMITS.minBytes}-${PDF_LIMITS.maxBytes}).`,
    );
  }

  const head = pdfBuffer.subarray(0, 64).toString('utf8');
  if (head.trimStart().startsWith('<') || head.trimStart().startsWith('{')) {
    throw new SyncError('INVALID_PDF', 'PDF download contains HTML or JSON instead of a PDF document.');
  }
  if (!head.startsWith('%PDF-1.')) {
    throw new SyncError('INVALID_PDF', 'PDF file is missing valid "%PDF-1." header signature.');
  }
  const tail = pdfBuffer.subarray(Math.max(0, pdfBuffer.length - 2048)).toString('latin1');
  if (!tail.includes('%%EOF')) {
    throw new SyncError('INVALID_PDF', 'PDF file appears truncated (missing "%%EOF" marker).');
  }

  const pdfjs = await loadPdfjs();
  let pdfDoc = null;
  try {
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(pdfBuffer),
      verbosity: 0,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    pdfDoc = await loadingTask.promise;

    const numPages = pdfDoc.numPages;
    if (numPages < PDF_LIMITS.minPages || numPages > PDF_LIMITS.maxPages) {
      throw new SyncError(
        'INVALID_PDF',
        `PDF page count ${numPages} is outside expected bounds (${PDF_LIMITS.minPages}-${PDF_LIMITS.maxPages}).`,
      );
    }

    const pageTexts = [];
    for (let pageNo = 1; pageNo <= numPages; pageNo += 1) {
      const page = await pdfDoc.getPage(pageNo);
      const content = await page.getTextContent();
      const strings = content.items.map((item) => (typeof item.str === 'string' ? item.str : '')).filter(Boolean);
      pageTexts.push(strings.join(' '));
      page.cleanup();
    }

    const combinedText = pageTexts.join(' ').replace(/\s+/g, ' ').trim();
    if (combinedText.length < PDF_LIMITS.minExtractedChars) {
      throw new SyncError(
        'INVALID_PDF',
        `PDF extracted text is too short (${combinedText.length} chars; minimum ${PDF_LIMITS.minExtractedChars}).`,
      );
    }

    const ownerPattern = expectedMeta.ownerName
      ? new RegExp(expectedMeta.ownerName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i')
      : OWNER_NAME_RE;
    if (!ownerPattern.test(combinedText)) {
      throw new SyncError('INVALID_PDF', 'PDF extracted text does not contain expected resume owner name.');
    }
    if (!RESUME_SECTION_RE.test(combinedText)) {
      throw new SyncError('INVALID_PDF', 'PDF extracted text does not contain expected résumé sections.');
    }

    const metadata = await pdfDoc.getMetadata().catch(() => ({ info: {} }));
    const serializedMeta = JSON.stringify(metadata?.info || {});
    for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
      if (pattern.test(combinedText) || pattern.test(serializedMeta)) {
        throw new SyncError('SECURITY_VIOLATION', 'Generated PDF appears to contain forbidden token/credential material.');
      }
    }

    return {
      bytes: pdfBuffer.length,
      sha256: sha256Buffer(pdfBuffer),
      pageCount: numPages,
      extractedChars: combinedText.length,
    };
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError('INVALID_PDF', `Failed to parse PDF document: ${err?.message || 'unknown error'}`, {
      cause: err,
    });
  } finally {
    if (pdfDoc && typeof pdfDoc.destroy === 'function') {
      await pdfDoc.destroy().catch(() => {});
    }
  }
}

export async function validateImageBuffer(imageBuffer, expectedFormat) {
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new SyncError('INVALID_PREVIEW', `Preview (${expectedFormat}) is not a valid Buffer.`);
  }
  if (imageBuffer.length < PREVIEW_LIMITS.minBytes || imageBuffer.length > PREVIEW_LIMITS.maxBytes) {
    throw new SyncError(
      'INVALID_PREVIEW',
      `Preview (${expectedFormat}) byte size ${imageBuffer.length} is outside bounds (${PREVIEW_LIMITS.minBytes}-${PREVIEW_LIMITS.maxBytes}).`,
    );
  }

  const sharp = loadSharp();
  try {
    const image = sharp(imageBuffer);
    const meta = await image.metadata();
    if (meta.format !== expectedFormat) {
      throw new SyncError('INVALID_PREVIEW', `Preview image format is "${meta.format}", expected "${expectedFormat}".`);
    }
    if (meta.width !== PREVIEW_LIMITS.targetWidth) {
      throw new SyncError(
        'INVALID_PREVIEW',
        `Preview (${expectedFormat}) width is ${meta.width}px, expected ${PREVIEW_LIMITS.targetWidth}px.`,
      );
    }
    if (!meta.height || meta.height < PREVIEW_LIMITS.minHeight || meta.height > PREVIEW_LIMITS.maxHeight) {
      throw new SyncError(
        'INVALID_PREVIEW',
        `Preview (${expectedFormat}) height ${meta.height}px is outside bounds (${PREVIEW_LIMITS.minHeight}-${PREVIEW_LIMITS.maxHeight}).`,
      );
    }
    if (meta.channels !== 3 || meta.hasAlpha) {
      throw new SyncError(
        'INVALID_PREVIEW',
        `Preview (${expectedFormat}) must be opaque 3-channel RGB (got channels=${meta.channels}, hasAlpha=${meta.hasAlpha}).`,
      );
    }

    const stats = await image.stats();
    const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length;
    if (!Number.isFinite(avgStdDev) || avgStdDev < PREVIEW_LIMITS.minChannelStdDev) {
      throw new SyncError(
        'INVALID_PREVIEW',
        `Preview (${expectedFormat}) lacks visual variance (stdev=${avgStdDev.toFixed(2)}), indicating a blank or broken render.`,
      );
    }

    // Check ink pixel ratio across a downsampled grid to reject nearly empty pages reliably.
    const sample = await sharp(imageBuffer)
      .resize({ width: 180, kernel: sharp.kernel.nearest })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let nonWhitePixels = 0;
    const totalPixels = sample.info.width * sample.info.height;
    for (let idx = 0; idx < sample.data.length; idx += 3) {
      if (sample.data[idx] < 245 || sample.data[idx + 1] < 245 || sample.data[idx + 2] < 245) {
        nonWhitePixels += 1;
      }
    }
    const inkRatio = totalPixels > 0 ? nonWhitePixels / totalPixels : 0;
    if (inkRatio < PREVIEW_LIMITS.minInkPixelRatio) {
      throw new SyncError(
        'INVALID_PREVIEW',
        `Preview (${expectedFormat}) contains too little ink (${(inkRatio * 100).toFixed(2)}%), rejecting blank render.`,
      );
    }

    return {
      format: meta.format,
      width: meta.width,
      height: meta.height,
      bytes: imageBuffer.length,
      sha256: sha256Buffer(imageBuffer),
      inkRatio: Number(inkRatio.toFixed(4)),
    };
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError('INVALID_PREVIEW', `Failed validating ${expectedFormat} preview: ${err?.message || 'unknown error'}`, {
      cause: err,
    });
  }
}

export async function renderAndValidatePreview(pdfBuffer, tempDir, options = {}) {
  const { pdftoppmBin = 'pdftoppm', renderOverride = null } = options;

  let webpBuffer;
  let jpgBuffer;

  if (typeof renderOverride === 'function') {
    const overridden = await renderOverride(pdfBuffer, tempDir);
    webpBuffer = overridden.webpBuffer;
    jpgBuffer = overridden.jpgBuffer;
  } else {
    const pdfPath = path.join(tempDir, 'resume-render.pdf');
    const outPrefix = path.join(tempDir, 'resume-page-1');
    fs.writeFileSync(pdfPath, pdfBuffer);

    try {
      execFileSync(
        pdftoppmBin,
        ['-png', '-r', '200', '-f', '1', '-l', '1', '-singlefile', pdfPath, outPrefix],
        {
          timeout: DEFAULT_TIMEOUTS.pdftoppmMs,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
    } catch (err) {
      throw new SyncError(
        'RENDER_ERROR',
        `pdftoppm failed rendering PDF page 1: ${err?.message || 'unknown error'}`,
        { cause: err },
      );
    }

    const renderedPngPath = `${outPrefix}.png`;
    if (!fs.existsSync(renderedPngPath)) {
      throw new SyncError('RENDER_ERROR', 'pdftoppm exited cleanly without creating resume-page-1.png.');
    }

    const sharp = loadSharp();
    const basePipeline = sharp(renderedPngPath)
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .removeAlpha()
      .resize({ width: PREVIEW_LIMITS.targetWidth, kernel: sharp.kernel.lanczos3 });

    webpBuffer = await basePipeline.clone().webp({ quality: 90, effort: 6 }).toBuffer();
    jpgBuffer = await basePipeline.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  }

  const webpInfo = await validateImageBuffer(webpBuffer, 'webp');
  const jpgInfo = await validateImageBuffer(jpgBuffer, 'jpeg');
  if (webpInfo.width !== jpgInfo.width || webpInfo.height !== jpgInfo.height) {
    throw new SyncError(
      'INVALID_PREVIEW',
      `WebP (${webpInfo.width}x${webpInfo.height}) and JPEG (${jpgInfo.width}x${jpgInfo.height}) preview dimensions do not match.`,
    );
  }

  return {
    webpBuffer,
    jpgBuffer,
    webpInfo,
    jpgInfo,
  };
}

export function buildShortRevisionTag(updatedAtIso, pdfSha256) {
  const datePart = String(updatedAtIso).slice(0, 10).replace(/-/g, '');
  const hashPart = String(pdfSha256).slice(0, 6);
  return `${datePart}-${hashPart}`;
}

export function updateIndexHtmlResumeRefs(indexHtmlContent, { shortVersion, width, height }) {
  if (typeof indexHtmlContent !== 'string' || !indexHtmlContent.includes('id="resumeModal"')) {
    throw new SyncError('INTEGRATION_ERROR', 'index.html is missing #resumeModal section.');
  }

  let nextHtml = indexHtmlContent;
  let pdfHrefMatches = 0;
  let webpMatches = 0;
  let jpgMatches = 0;

  nextHtml = nextHtml.replace(
    /<a\b([^>]*?)href="docs\/Paulson_J_Resume\.pdf(?:\?v=[^"]+)?"([^>]*?)>/g,
    (fullMatch, before, after) => {
      pdfHrefMatches += 1;
      const combined = `${before}href="docs/Paulson_J_Resume.pdf?v=${shortVersion}"${after}`;
      if (/\bdownload(?:="[^"]*")?/.test(combined)) {
        return `<a${combined.replace(/\bdownload(?:="[^"]*")?/, 'download="Paulson_J_Resume.pdf"')}>`;
      }
      return `<a${combined}>`;
    },
  );

  nextHtml = nextHtml.replace(
    /<source\b([^>]*?)data-srcset="img\/resume-preview\.webp(?:\?v=[^"]+)?"([^>]*?)>/g,
    (fullMatch, before, after) => {
      webpMatches += 1;
      return `<source${before}data-srcset="img/resume-preview.webp?v=${shortVersion}"${after}>`;
    },
  );

  nextHtml = nextHtml.replace(
    /<img\b([^>]*?)id="resume-preview-img"([^>]*?)>/g,
    (fullMatch, before, after) => {
      jpgMatches += 1;
      let attrs = `${before}id="resume-preview-img"${after}`;
      attrs = attrs.replace(/data-src="img\/resume-preview\.jpg(?:\?v=[^"]+)?"/, `data-src="img/resume-preview.jpg?v=${shortVersion}"`);
      attrs = attrs.replace(/\bwidth="\d+"/, `width="${width}"`);
      attrs = attrs.replace(/\bheight="\d+"/, `height="${height}"`);
      return `<img${attrs}>`;
    },
  );

  if (pdfHrefMatches !== 2 || webpMatches !== 1 || jpgMatches !== 1) {
    throw new SyncError(
      'INTEGRATION_ERROR',
      `Unexpected #resumeModal reference counts in index.html (pdf=${pdfHrefMatches}, webp=${webpMatches}, jpg=${jpgMatches}).`,
    );
  }

  return nextHtml;
}

export function readSyncManifest(repoRoot) {
  const manifestPath = path.join(repoRoot, REL_PATHS.manifest);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    throw new SyncError('MANIFEST_ERROR', `Invalid sync manifest JSON: ${err?.message || 'parse error'}`, {
      cause: err,
    });
  }
}

export function verifyPortfolioAssetConsistency(repoRoot) {
  const manifest = readSyncManifest(repoRoot);
  if (!manifest) {
    return { valid: false, reason: 'Sync manifest does not exist yet.', manifest: null };
  }

  const checks = [
    ['pdf', REL_PATHS.pdf, manifest.artifacts?.pdf?.sha256],
    ['previewWebp', REL_PATHS.webp, manifest.artifacts?.previewWebp?.sha256],
    ['previewJpg', REL_PATHS.jpg, manifest.artifacts?.previewJpg?.sha256],
  ];

  for (const [label, relPath, expectedSha] of checks) {
    const absPath = path.join(repoRoot, relPath);
    if (!fs.existsSync(absPath)) {
      return { valid: false, reason: `Missing active asset "${relPath}" (${label}).`, manifest };
    }
    const actualSha = sha256Buffer(fs.readFileSync(absPath));
    if (!expectedSha || actualSha !== expectedSha) {
      return { valid: false, reason: `Checksum mismatch for "${relPath}".`, manifest };
    }
  }

  const indexHtmlPath = path.join(repoRoot, REL_PATHS.indexHtml);
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
  const expectedVer = manifest.sync?.shortVersion;
  if (
    !expectedVer ||
    !indexHtml.includes(`docs/Paulson_J_Resume.pdf?v=${expectedVer}`) ||
    !indexHtml.includes(`img/resume-preview.webp?v=${expectedVer}`) ||
    !indexHtml.includes(`img/resume-preview.jpg?v=${expectedVer}`)
  ) {
    return {
      valid: false,
      reason: `index.html #resumeModal references do not match manifest version "${expectedVer}".`,
      manifest,
    };
  }

  return { valid: true, reason: 'All active artifacts and index.html match the sync manifest.', manifest };
}

export function writeFilesAtomically(targetWrites) {
  const backups = [];
  const tempPaths = [];
  const stamp = `${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

  try {
    for (const { targetPath, content } of targetWrites) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      if (fs.existsSync(targetPath)) {
        backups.push({ targetPath, existed: true, content: fs.readFileSync(targetPath) });
      } else {
        backups.push({ targetPath, existed: false, content: null });
      }
      const tmpPath = path.join(path.dirname(targetPath), `.${path.basename(targetPath)}.tmp-${stamp}`);
      fs.writeFileSync(tmpPath, content);
      tempPaths.push({ tmpPath, targetPath });
    }

    for (const { tmpPath, targetPath } of tempPaths) {
      fs.renameSync(tmpPath, targetPath);
    }
  } catch (err) {
    for (const { tmpPath } of tempPaths) {
      if (fs.existsSync(tmpPath)) {
        fs.rmSync(tmpPath, { force: true });
      }
    }
    for (const backup of backups) {
      try {
        if (backup.existed) {
          fs.writeFileSync(backup.targetPath, backup.content);
        } else if (fs.existsSync(backup.targetPath)) {
          fs.rmSync(backup.targetPath, { force: true });
        }
      } catch {
        // Best-effort rollback recovery.
      }
    }
    throw new SyncError('ATOMIC_WRITE_ERROR', `Failed committing synced assets cleanly: ${err?.message || 'unknown'}`, {
      cause: err,
    });
  }
}

export async function runSyncPipeline(options = {}) {
  const {
    repoRoot,
    resumeId = AUTHORITATIVE_RESUME_ID,
    baseUrl = DEFAULT_API_BASE_URL,
    apiKey = '',
    force = false,
    dryRun = false,
    verifyOnly = false,
    trigger = 'cli',
    fromFiles = null,
    fetchImpl = globalThis.fetch,
    sleepImpl = defaultSleep,
    randomImpl = Math.random,
    pdftoppmBin = 'pdftoppm',
    renderOverride = null,
    consistencyHook = null,
    nowFn = () => new Date(),
  } = options;

  if (!repoRoot) {
    throw new SyncError('CONFIG_ERROR', 'Missing repoRoot option.');
  }
  const safeId = assertSafeResumeId(resumeId);

  if (verifyOnly) {
    const consistency = verifyPortfolioAssetConsistency(repoRoot);
    if (!consistency.valid) {
      throw new SyncError('VERIFICATION_FAILED', consistency.reason);
    }
    const pdfBuf = fs.readFileSync(path.join(repoRoot, REL_PATHS.pdf));
    const webpBuf = fs.readFileSync(path.join(repoRoot, REL_PATHS.webp));
    const jpgBuf = fs.readFileSync(path.join(repoRoot, REL_PATHS.jpg));
    const pdfMeta = await validatePdfBuffer(pdfBuf);
    const webpMeta = await validateImageBuffer(webpBuf, 'webp');
    const jpgMeta = await validateImageBuffer(jpgBuf, 'jpeg');
    if (webpMeta.width !== jpgMeta.width || webpMeta.height !== jpgMeta.height) {
      throw new SyncError('VERIFICATION_FAILED', 'Existing preview WebP and JPEG dimensions mismatch.');
    }
    return {
      status: 'verified',
      changed: false,
      manifest: consistency.manifest,
      pdfMeta,
      webpMeta,
      jpgMeta,
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'portfolio-resume-sync-'));
  try {
    let sourceMeta;
    let pdfBuffer;

    if (fromFiles) {
      const rawJson = JSON.parse(fs.readFileSync(fromFiles.metaPath, 'utf8'));
      const rawId = rawJson.id || safeId;
      assertSafeResumeId(rawId);
      const updatedAt = normalizeIsoTimestamp(fromFiles.updatedAt || rawJson.updatedAt);
      if (!updatedAt) {
        throw new SyncError('INVALID_RESPONSE', 'Pre-fetched metadata is missing valid updatedAt.');
      }
      sourceMeta = {
        resumeId: safeId,
        resumeName: String(fromFiles.resumeName || rawJson.name || 'Paulson J - Portfolio Proposed (2026)'),
        updatedAt,
        contentHash: computeContentHash({ id: safeId, name: fromFiles.resumeName || rawJson.name, data: rawJson.data || rawJson }),
        ownerName: String(rawJson?.data?.basics?.name || rawJson?.basics?.name || 'Paulson J'),
        isPublic: Boolean(rawJson.isPublic),
        isLocked: Boolean(rawJson.isLocked),
      };
      pdfBuffer = fs.readFileSync(fromFiles.pdfPath);
    } else {
      const preMeta = await fetchAuthoritativeResumeMeta({
        baseUrl,
        resumeId: safeId,
        apiKey,
        fetchImpl,
        sleepImpl,
        randomImpl,
      });

      const consistency = verifyPortfolioAssetConsistency(repoRoot);
      const manifest = consistency.manifest;
      const unchangedMeta =
        manifest &&
        manifest.source?.resumeId === safeId &&
        manifest.source?.updatedAt === preMeta.updatedAt &&
        manifest.source?.contentHash === preMeta.contentHash;

      if (!force && unchangedMeta && consistency.valid) {
        return {
          status: 'up-to-date',
          changed: false,
          sourceMeta: preMeta,
          manifest,
        };
      }

      // Guard against mid-export concurrent saves by confirming updatedAt before and after PDF fetch.
      let activeMeta = preMeta;
      for (let guardAttempt = 1; guardAttempt <= 2; guardAttempt += 1) {
        pdfBuffer = await downloadAuthoritativePdf({
          baseUrl,
          resumeId: safeId,
          apiKey,
          fetchImpl,
          sleepImpl,
          randomImpl,
        });
        if (typeof consistencyHook === 'function') {
          await consistencyHook(guardAttempt);
        }
        const postMeta = await fetchAuthoritativeResumeMeta({
          baseUrl,
          resumeId: safeId,
          apiKey,
          fetchImpl,
          sleepImpl,
          randomImpl,
        });
        if (postMeta.updatedAt === activeMeta.updatedAt && postMeta.contentHash === activeMeta.contentHash) {
          break;
        }
        activeMeta = postMeta;
        if (guardAttempt === 2) {
          throw new SyncError(
            'CONCURRENT_EDIT_CONFLICT',
            'Resume continued changing during PDF export; deferring publish until edits settle.',
            { retryable: true },
          );
        }
      }
      sourceMeta = activeMeta;
    }

    // Check short-circuit cleanly for fromFiles or unchanged post-export check when bytes are already synced.
    const existingConsistency = verifyPortfolioAssetConsistency(repoRoot);
    if (
      !force &&
      existingConsistency.valid &&
      existingConsistency.manifest?.source?.updatedAt === sourceMeta.updatedAt &&
      existingConsistency.manifest?.source?.contentHash === sourceMeta.contentHash
    ) {
      return {
        status: 'up-to-date',
        changed: false,
        sourceMeta,
        manifest: existingConsistency.manifest,
      };
    }

    const pdfValidation = await validatePdfBuffer(pdfBuffer, { ownerName: sourceMeta.ownerName });
    const previewResult = await renderAndValidatePreview(pdfBuffer, tempDir, {
      pdftoppmBin,
      renderOverride,
    });

    const shortVersion = buildShortRevisionTag(sourceMeta.updatedAt, pdfValidation.sha256);
    const indexHtmlAbs = path.join(repoRoot, REL_PATHS.indexHtml);
    const nextIndexHtml = updateIndexHtmlResumeRefs(fs.readFileSync(indexHtmlAbs, 'utf8'), {
      shortVersion,
      width: previewResult.webpInfo.width,
      height: previewResult.webpInfo.height,
    });

    const nowIso = nowFn().toISOString();
    const newManifest = {
      schemaVersion: 1,
      source: {
        provider: 'reactive-resume',
        resumeId: sourceMeta.resumeId,
        resumeName: sourceMeta.resumeName,
        updatedAt: sourceMeta.updatedAt,
        contentHash: sourceMeta.contentHash,
        isPublic: sourceMeta.isPublic,
      },
      sync: {
        revision: `${sourceMeta.updatedAt}#${pdfValidation.sha256.slice(0, 12)}`,
        shortVersion,
        lastSuccessfulSyncAt: nowIso,
        exportTimestamp: nowIso,
        trigger,
      },
      artifacts: {
        pdf: {
          path: REL_PATHS.pdf,
          sha256: pdfValidation.sha256,
          bytes: pdfValidation.bytes,
          pageCount: pdfValidation.pageCount,
          extractedChars: pdfValidation.extractedChars,
        },
        previewWebp: {
          path: REL_PATHS.webp,
          sha256: previewResult.webpInfo.sha256,
          bytes: previewResult.webpInfo.bytes,
          width: previewResult.webpInfo.width,
          height: previewResult.webpInfo.height,
          inkRatio: previewResult.webpInfo.inkRatio,
        },
        previewJpg: {
          path: REL_PATHS.jpg,
          sha256: previewResult.jpgInfo.sha256,
          bytes: previewResult.jpgInfo.bytes,
          width: previewResult.jpgInfo.width,
          height: previewResult.jpgInfo.height,
          inkRatio: previewResult.jpgInfo.inkRatio,
        },
      },
    };

    if (dryRun) {
      return {
        status: 'dry-run-ready',
        changed: true,
        sourceMeta,
        manifest: newManifest,
      };
    }

    writeFilesAtomically([
      { targetPath: path.join(repoRoot, REL_PATHS.pdf), content: pdfBuffer },
      { targetPath: path.join(repoRoot, REL_PATHS.webp), content: previewResult.webpBuffer },
      { targetPath: path.join(repoRoot, REL_PATHS.jpg), content: previewResult.jpgBuffer },
      { targetPath: indexHtmlAbs, content: Buffer.from(nextIndexHtml, 'utf8') },
      {
        targetPath: path.join(repoRoot, REL_PATHS.manifest),
        content: Buffer.from(`${JSON.stringify(newManifest, null, 2)}\n`, 'utf8'),
      },
    ]);

    return {
      status: 'synchronized',
      changed: true,
      sourceMeta,
      manifest: newManifest,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
